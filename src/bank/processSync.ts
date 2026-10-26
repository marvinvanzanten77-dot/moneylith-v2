import {periodPlansKey,capturePeriodPlan,makePeriodPlan,type PeriodPlans} from "./periodReconciliation.js";
import {reconcileDebtPayments,debtLedgerKey,emptyDebtLedger,validateDebtLedger} from './debtPayments.js';
import {mergeLunchflow,type LunchMapping} from './lunchflowMerge.js';
import {classifyBankTransactions,type PatternDecisions} from './patterns.js';
import {prefillFinancialImport,refreshLatestIncome} from './financialImport.js';
import {emptyBankRules,validateBankRules} from './classificationRules.js';
import type {LunchSnapshot} from './lunchflowTypes.js';
import type {CloudState} from '../storage/cloudState.js';
import type {MoneylithAccount,MoneylithTransaction,IncomeItem,FixedCostManualItem,FixedCostItem} from '../types.js';
export type BankScan={lastSuccessfulAt?:string;updatedTransactions?:number;id:string;at:string;ok:number;failed:number;added:number;updatedIncome:number;message:string};
const read=<T>(state:CloudState,key:string,fallback:T):T=>state[key]?JSON.parse(state[key]) as T:fallback;
/** One transformation for browser imports and server scans. Existing manual values and business books are preserved. */
export function processBankSync(state:CloudState,snapshots:LunchSnapshot[],mappings:LunchMapping[],asOf:string){
 const accounts=read<MoneylithAccount[]>(state,'moneylith.personal.accounts',[]);
 const txs=read<MoneylithTransaction[]>(state,'moneylith.personal.transactions',[]);
 const income=read<IncomeItem[]>(state,'moneylith.personal.income',[]);
 const fixed=read<FixedCostManualItem[]>(state,'moneylith.personal.fixedCosts',[]);
 const seen=read<string[]>(state,'moneylith.personal.bankImportSeen',[]);
 const rules=read(state,'moneylith.personal.bankRules.v1',emptyBankRules);
 const decisions=read<PatternDecisions>(state,'moneylith.personal.bankPatterns.v1',{});
 const detected=read<FixedCostItem[]>(state,'fixed-cost-items',[]);
 if(![accounts,txs,income,fixed,seen,detected].every(Array.isArray)||!validateBankRules(rules))throw Error('Bankadministratie is ongeldig; eerdere gegevens blijven behouden.');
 const result=mergeLunchflow(accounts,txs,snapshots,mappings);
 result.transactions=classifyBankTransactions(result.transactions,decisions,rules);
 const financial=result.reports.some(r=>r.ok)?prefillFinancialImport(result.transactions.filter(t=>rules.accountRoles[t.accountId]!=='business'),income,fixed,seen,asOf,detected.some(i=>i.isFixed&&!i.isIgnored)):undefined;
 // An explicitly linked personal salary may arrive on a business-designated bank account.
 // Respect that opt-in link without auto-importing other business income into Personal.
 if(financial){
  financial.income=refreshLatestIncome(result.transactions,financial.income,asOf);
  financial.updatedIncome=income.filter((item,index)=>JSON.stringify(item)!==JSON.stringify(financial.income[index])).length;
 }
 const next={...state};
 const periodPlans=financial?capturePeriodPlan(read<PeriodPlans>(state,periodPlansKey,{}),makePeriodPlan(income,fixed,detected,read<import('../types').SchuldItem[]>(state,'moneylith.personal.debts',[]),asOf),asOf):undefined;
 if(periodPlans)next[periodPlansKey]=JSON.stringify(periodPlans);
 const ledger=read(state,debtLedgerKey,emptyDebtLedger());
 if(!validateDebtLedger(ledger))throw Error('Ongeldige aflossingshistorie; synchronisatie niet opgeslagen.');
 const debtPayments=result.reports.some(r=>r.ok)?reconcileDebtPayments(read<import('../types').SchuldItem[]>(state,'moneylith.personal.debts',[]),result.transactions,ledger,asOf,Object.entries(rules.accountRoles).filter(([,role])=>role==='business').map(([id])=>id)):undefined;
 if(debtPayments&&debtPayments.applied){next['moneylith.personal.debts']=JSON.stringify(debtPayments.debts);next[debtLedgerKey]=JSON.stringify(debtPayments.ledger);}

 next['moneylith.personal.accounts']=JSON.stringify(result.accounts);
 next['moneylith.personal.transactions']=JSON.stringify(result.transactions);
 if(financial){next['moneylith.personal.income']=JSON.stringify(financial.income);next['moneylith.personal.fixedCosts']=JSON.stringify(financial.fixedCosts);next['moneylith.personal.bankImportSeen']=JSON.stringify(financial.seen);}
 return {state:next,result,financial:financial?{...financial,periodPlans}:undefined,debtPayments};
}
