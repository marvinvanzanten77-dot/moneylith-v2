import type {MoneylithSnapshotDomain} from '../core/moneylithSnapshot.js';
import type {FixedCostManualItem,MoneylithTransaction,IncomeItem,FixedCostItem,SchuldItem} from '../types.js';
import {makePeriodPlan,reconcilePeriod,salaryPeriod,periodBounds} from './periodReconciliation.js';
import {emptyBankRules,validateBankRules} from './classificationRules.js';
import {emptyDebtLedger,validateDebtLedger} from './debtPayments.js';
const list=<T>(v:unknown):T[]=>Array.isArray(v)?v:[];
const month=(value:string,offset:number)=>{const d=new Date(value+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+offset);return d.toISOString().slice(0,7);};
/** Derived expectations only: never write estimates into the user's actual monthly amounts. */
export function personalExpectations(data:MoneylithSnapshotDomain,asOf:string){
 const fixed=list<FixedCostManualItem>(data.fixedCosts),transactions=list<MoneylithTransaction>(data.transactions);
 const rules=validateBankRules(data.bankRules)?data.bankRules:emptyBankRules;
 const ledger=validateDebtLedger(data.debtPayments)?data.debtPayments:emptyDebtLedger();
 const period=salaryPeriod(asOf),notes:string[]=[];
 const reports=[1,2,3].map(n=>{const p=month(period,-n),date=periodBounds(p).start;return reconcilePeriod(p,asOf,makePeriodPlan(list<IncomeItem>(data.income),fixed.map(f=>f.costKind==='credits'?{...f,costKind:undefined}:f),list<FixedCostItem>(data.detectedFixedCosts),list<SchuldItem>(data.debts),date),true,transactions,ledger,rules);});
 const derived=fixed.map(raw=>{
  // One-off credits, cash and payroll deductions are not recurring bank obligations.
  if(raw.costKind==='credits'||raw.paymentRoute==='cash'||raw.paymentRoute==='withheld')return raw;
  const history=reports.map(r=>r.rows.find(row=>row.id==='fixed:'+raw.id)).filter(r=>r&&r.actual!==null&&!r.reversed&&r.transactionIds.length) as NonNullable<typeof reports[number]['rows'][number]>[];
  const bankAmounts=history.map(r=>r.actual!);
  const explicit=Object.entries(raw.monthlyAmounts??{}).filter(([m,v])=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m)&&m<period&&m>=month(period,-3)&&typeof v==='number'&&Number.isFinite(v)&&v>=0).sort(([a],[b])=>b.localeCompare(a)).slice(0,3).map(([,v])=>Math.round(v!*100));
  const samples=bankAmounts.length>=2?bankAmounts:explicit;
  if(!samples.length||raw.bankObservedOnly&&bankAmounts.length<2)return raw;
  const average=Math.round(samples.reduce((a,b)=>a+b,0)/samples.length)/100;
  const ids=new Set(history.flatMap(r=>r.transactionIds));
  const dates=transactions.filter(t=>ids.has(t.id)).map(t=>t.date).sort();
  const day=raw.dagVanMaand|| (bankAmounts.length>=2?Number(dates.at(-1)?.slice(8)):0);
  if(!day&&!raw.budgetCategory)return raw;
  const amounts={...raw.monthlyAmounts};const estimatedMonths:string[]=[];
  if(raw.monthlyVariable||raw.bankObservedOnly||raw.amountEntered===false){
   for(let n=0;n<=13;n++){const m=month(period,n);if(!Object.hasOwn(amounts,m)){amounts[m]=average;estimatedMonths.push(m);}}
  }
  if(!estimatedMonths.length)return raw;
  notes.push(`${raw.naam}: voorlopig € ${average.toFixed(2).replace('.',',')} op basis van ${samples.length} eerdere ${bankAmounts.length>=2?'salarisperioden met herkende betalingen':'ingevulde maanden'}. Nieuwe afschrijvingen werken de verwachting bij.`);
  return {...raw,dagVanMaand:day,monthlyVariable:true,monthlyAmounts:amounts,bankObservedOnly:false,
   bankEstimate:{months:estimatedMonths,samples:samples.length,settlesOnPayment:bankAmounts.length>=2&&history.every(r=>r.transactionIds.length===1)&&!raw.budgetCategory}};
 });
 // Unplanned work-tool purchases share a flexible envelope. A new supplier or
 // one-off credit consumes this envelope; it does not become a subscription.
 const pooled=fixed.filter(f=>f.costGroup==='work-tools'&&f.bankObservedOnly&&f.paymentRoute!=='cash'&&f.paymentRoute!=='withheld'&&Object.keys(f.monthlyAmounts??{}).length===0);
 const pooledIds=new Set(pooled.map(f=>'fixed:'+f.id));
 const totals=reports.map(r=>r.rows.filter(row=>pooledIds.has(row.id)&&row.actual!==null&&!row.reversed&&row.transactionIds.length).reduce((sum,row)=>sum+row.actual!,0));
 const sampled=totals.filter(v=>v>0);
 let result=derived;
 if(pooled.length&&sampled.length>=2){
  const average=Math.round(sampled.reduce((a,b)=>a+b,0)/sampled.length)/100;
  const labels=pooled.map(f=>f.naam);
  for(let i=notes.length-1;i>=0;i--)if(labels.some(label=>notes[i].startsWith(label+':')))notes.splice(i,1);
  result=derived.filter(f=>!pooledIds.has('fixed:'+f.id));
  const months=Array.from({length:14},(_,n)=>month(period,n));
  result.push({id:'automatic-work-tools',naam:'Flexibele werktools en credits',bedrag:average,amountEntered:true,dagVanMaand:23,paymentRoute:'bank',costGroup:'work-tools',budgetCategory:'Flexibele werktools en credits',bankBudgetLabels:labels,bankEstimate:{months,samples:sampled.length,settlesOnPayment:false}});
  notes.push('Werktools en losse credits delen een voorlopig periodebudget op basis van eerdere salarisperioden met herkende betalingen. Werkelijke aankopen verlagen het restant; individuele tools zijn niet als abonnement aangenomen. Niet alle bankhistorie hoeft volledig te zijn.');
 }
 return {data:{...data,fixedCosts:result},notes};
}
