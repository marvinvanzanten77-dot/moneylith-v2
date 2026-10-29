import {personalExpectations} from '../bank/expectations';
import type {CloudState} from '../storage/cloudState';
import type {IncomeItem,FixedCostManualItem,FixedCostItem,SchuldItem,MoneylithGoal,MoneylithTransaction} from '../types';
import {emptyBankRules,validateBankRules} from '../bank/classificationRules';
import {emptyDebtLedger,validateDebtLedger,debtLedgerKey} from '../bank/debtPayments';
import {makePeriodPlan,reconcilePeriod,periodBounds,salaryPeriod,periodPaidKey,periodPlansKey,type PeriodPlans,type PeriodPaid} from '../bank/periodReconciliation';
import {spendingRows,spendingAboveBudgets,spendingSummary} from '../bank/spending';
export function stored<T>(state:CloudState,key:string,fallback:T):T {try{return state[key]===undefined?fallback:JSON.parse(state[key]);}catch{return fallback;}}
export function workspaceModel(state:CloudState,period:string,asOf:string) {
 const get=<T,>(key:string,fallback:T)=>stored(state,'moneylith.personal.'+key,fallback);
 const income=get<IncomeItem[]>('income',[]),fixed=get<FixedCostManualItem[]>('fixedCosts',[]),debts=get<SchuldItem[]>('debts',[]),goals=get<MoneylithGoal[]>('goals',[]),storedTransactions=get<MoneylithTransaction[]>('transactions',[]);
 const rawRules=get('bankRules.v1',emptyBankRules),rules=validateBankRules(rawRules)?rawRules:emptyBankRules;
 const transactions=storedTransactions;
 const rawLedger=stored(state,debtLedgerKey,emptyDebtLedger()),ledger=validateDebtLedger(rawLedger)?rawLedger:emptyDebtLedger();
 const bounds=periodBounds(period),closed=bounds.end<asOf;
 const plans=stored<PeriodPlans>(state,periodPlansKey,{});
 const detected=stored<FixedCostItem[]>(state,'fixed-cost-items',[]);
 const expectations=personalExpectations({income,fixedCosts:fixed,detectedFixedCosts:detected,debts,transactions,bankRules:rules,debtPayments:ledger},closed?bounds.start:asOf);
 const latest=makePeriodPlan(income,expectations.data.fixedCosts as FixedCostManualItem[],detected,debts,closed?bounds.start:asOf);
 const plan=closed?(plans[period]??latest):latest;
 const report=reconcilePeriod(period,asOf,plan,!closed||!!plans[period],transactions,ledger,rules,stored<PeriodPaid>(state,periodPaidKey,{})[period]);
 const gross=spendingRows(transactions,rules,fixed,ledger).filter(r=>r.date<=asOf);
 const spending=spendingSummary(spendingAboveBudgets(gross,fixed,'salary'),period,asOf,'salary');
 return {baselinePlan:plans[period],income,fixed,debts,goals,transactions,rules,ledger,report,spending,gross,bounds,closed,estimatedFixed:expectations.data.fixedCosts as FixedCostManualItem[],expectationNotes:expectations.notes,latestPlan:latest};
}
export function moneyInput(raw:string):number {
 if(!/^\d+(?:[.,]\d{1,2})?$/.test(raw.trim()))throw Error('Vul een bedrag in met maximaal twee decimalen.');
 const value=Math.round(Number(raw.replace(',','.'))*100)/100;
 if(!Number.isFinite(value)||value>1e9)throw Error('Dit bedrag is te groot.');return value;
}
/** Patch only this record, against its latest stored version. Never overwrite a cloud update. */
export function saveRecord<T extends {id:string}>(storage:Pick<Storage,'getItem'|'setItem'>,key:'income'|'fixedCosts'|'goals',original:T|null,next:T) {
 const full='moneylith.personal.'+key;
 const raw=storage.getItem(full), rows:T[]=raw===null?[]:JSON.parse(raw);
 if(!Array.isArray(rows))throw Error('De opgeslagen gegevens zijn niet leesbaar. Er is niets gewijzigd.');
 const current=rows.find(r=>r.id===next.id);
 if(original?JSON.stringify(current)!==JSON.stringify(original):!!current)throw Error('Deze gegevens zijn intussen gewijzigd. Sluit dit venster en open het opnieuw.');
 const result=original?rows.map(r=>r.id===next.id?next:r):[...rows,next];
 storage.setItem(full,JSON.stringify(result));
}
export function notifySaved(){window.dispatchEvent(new Event('moneylith:local-change'));window.dispatchEvent(new Event('moneylith:cloud-restored'));}
export function paymentDate(period:string,day:number|undefined){if(!day)return null;const b=periodBounds(period),month=day>=23?b.start.slice(0,7):b.end.slice(0,7);const last=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();return month+'-'+String(Math.min(day,last)).padStart(2,'0');}

/** The existing review signatures used by the projection, not a separate completion flag. */
export function foundationChecks(state:CloudState,asOf:string){
 const income=stored<IncomeItem[]>(state,'moneylith.personal.income',[]),fixed=stored<FixedCostManualItem[]>(state,'moneylith.personal.fixedCosts',[]),detected=stored<FixedCostItem[]>(state,'fixed-cost-items',[]).filter(i=>i.isFixed&&!i.isIgnored);
 const reviews=stored<InputReviews>(state,'moneylith.personal.inputReviews.v1',{});
 return {income:reviewBankIncome(income,stored(state,'moneylith.personal.transactions',[]),reviews,asOf),fixed:reviewSection('fixed','Vaste lasten',detected.length?[...detected.map(r=>({id:r.id,name:r.customLabel||r.descriptionPattern,amount:r.customMonthlyAmount??r.estimatedMonthlyAmount,details:r})),...manualReviewRows(fixed.filter(r=>r.paymentRoute||r.budgetCategory),asOf.slice(0,7))]:manualReviewRows(fixed,asOf.slice(0,7)),reviews)};
}
import {manualReviewRows,reviewBankIncome,reviewSection,type InputReviews} from '../logic/inputReadiness';

/** Daily budget allocations are one period expectation, not dozens of bank debits. */
export function forecastMoments(events:import('../projection/engine').Event[],asOf:string,through:string){
 const groups=new Map<string,import('../projection/engine').Event>();
 for(const e of events.filter(e=>e.date&&e.date>asOf&&e.date<=through&&e.amount!==0)){
  const key=e.id.includes(':budget:')?e.id.split(':budget:')[0]+':'+salaryPeriod(e.date!):e.id;
  const old=groups.get(key);groups.set(key,old?{...old,date:e.date,amount:old.amount===null||e.amount===null?null:old.amount+e.amount}:{...e});
 }
 return [...groups.values()].sort((a,b)=>a.date!.localeCompare(b.date!));
}
