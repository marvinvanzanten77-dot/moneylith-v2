import test from 'node:test';
import assert from 'node:assert/strict';
import {salaryPeriod,periodBounds,makePeriodPlan,capturePeriodPlan,reconcilePeriod} from '../src/bank/periodReconciliation';
import {emptyDebtLedger,reconcileDebtPayments} from '../src/bank/debtPayments';
import {emptyBankRules} from '../src/bank/classificationRules';
import type {MoneylithTransaction} from '../src/types';
const tx=(id:string,date:string,amount:number,party='Rent'):MoneylithTransaction=>({id,date,amount,counterparty:party,description:'Monthly payment',accountId:'p',provider:'lunchflow',currency:'EUR'});
const fixed=[{id:'rent',naam:'Rent',bedrag:500,dagVanMaand:1,amountEntered:true,bankEvidence:{key:'rent',transactionIds:['anchor'],through:'2026-09-01'}}];
const income=[{id:'salary',naam:'Salary',bedrag:2000,dagVanMaand:23,amountEntered:true,bankEvidence:{key:'salary',transactionIds:['salary-anchor'],through:'2026-09-23'}}];
const plan=makePeriodPlan(income,fixed,[],[],'2026-10-23');
const history=[tx('anchor','2026-09-01',-500),tx('salary-anchor','2026-09-23',2000,'Employer')];
test('salary periods include late month and first week once, across year and leap boundaries',()=>{
 assert.equal(salaryPeriod('2026-10-22'),'2026-09');assert.equal(salaryPeriod('2026-10-23'),'2026-10');assert.equal(salaryPeriod('2026-11-07'),'2026-10');
 assert.deepEqual(periodBounds('2026-12'),{start:'2026-12-23',end:'2027-01-22'});assert.equal(salaryPeriod('2024-02-29'),'2024-02');assert.throws(()=>salaryPeriod('2026-02-30'));
 const rows=[...history,tx('salary','2026-10-23',2100,'Employer'),tx('rent','2026-11-01',-525),tx('outside','2026-11-23',-700)];
 const r=reconcilePeriod('2026-10','2026-11-24',plan,true,rows,emptyDebtLedger(),emptyBankRules);
 assert.equal(r.rows[0].actual,210000);assert.equal(r.rows[1].actual,52500);assert.equal(r.rows[1].difference,2500);assert.equal(r.observedOut,52500);
});
test('frozen plans survive repeated captures; old periods do not invent historic expectations',()=>{
 const saved=capturePeriodPlan({},plan,'2026-10-23');const before=JSON.stringify(saved);
 const changed=makePeriodPlan([{...income[0],bedrag:2500}],fixed,[],[],'2026-10-24');assert.equal(capturePeriodPlan(saved,changed,'2026-10-24'),saved);assert.equal(JSON.stringify(saved),before);
 const r=reconcilePeriod('2026-09','2026-10-25',changed,false,history,emptyDebtLedger(),emptyBankRules);assert.equal(r.rows[0].expected,null);assert.equal(r.expected.income,null);
});
test('repeat sync, unlinked charges, ambiguity and missing amounts never create false paid evidence',()=>{
 const t=tx('rent','2026-11-01',-525);const r=reconcilePeriod('2026-10','2026-11-03',plan,true,[...history,t,t],emptyDebtLedger(),emptyBankRules);assert.equal(r.rows[1].actual,52500);
 const ambiguous={...plan,rows:[...plan.rows,{...plan.rows[1],id:'duplicate'}]};const a=reconcilePeriod('2026-10','2026-11-03',ambiguous,true,[...history,t],emptyDebtLedger(),emptyBankRules);assert.equal(a.rows[1].actual,null);assert.ok(a.unmatched.some(t=>t.ambiguous));
 const missing=reconcilePeriod('2026-10','2026-10-25',plan,true,history,emptyDebtLedger(),emptyBankRules);assert.equal(missing.rows[1].actual,null);assert.equal(missing.rows[1].forecast,50000);
});
test('reversals after period end invalidate a debit without counting a refund as earnings',()=>{
 const debit=tx('rent','2026-11-01',-500),refund={...tx('refund','2026-11-25',500),description:'Terugboeking incasso'};
 const r=reconcilePeriod('2026-10','2026-11-26',plan,true,[debit,refund],emptyDebtLedger(),emptyBankRules);
 // Match original explicitly, no historical anchor needed for this fixture.
 const linked={...plan,rows:plan.rows.map(row=>row.kind==='fixed'?{...row,evidence:{key:'r',transactionIds:['rent']}}:row)};
 const result=reconcilePeriod('2026-10','2026-11-26',linked,true,[debit,refund],emptyDebtLedger(),emptyBankRules);
 assert.equal(result.rows[1].actual,0);assert.equal(result.rows[1].reversed,true);assert.equal(result.observedOut,50000);assert.equal(r.observedIn,0);
});
test('bunq and cash remain funding flows, withheld costs are not subtracted twice, business is isolated',()=>{
 const p=makePeriodPlan([], [{id:'phone',naam:'Phone',bedrag:14,dagVanMaand:2,paymentRoute:'card'},{id:'health',naam:'Health',bedrag:120,dagVanMaand:20,paymentRoute:'withheld'}],[],[],'2026-10-23');
 const rows=[tx('bunq','2026-10-24',-100,'bunq'),{...tx('cash','2026-10-24',-50),description:'Geldopname geldautomaat'}, {...tx('biz','2026-10-24',-900),accountId:'business'}];
 const r=reconcilePeriod('2026-10','2026-10-25',p,true,rows,emptyDebtLedger(),{rules:[],accountRoles:{business:'business'}},{'fixed:phone':1900});
 assert.equal(r.cashMoves.length,2);assert.equal(r.observedOut,15000);assert.equal(r.rows[0].actual,1900);assert.equal(r.rows[1].forecast,0);assert.equal(r.forecast.fixed,1900);assert.equal(rows[0].amount,-100);
});
test('explicit one-off debt references work without schedules, stay idempotent and reject reversals or overpayment',()=>{
 const debts=[{id:'d',naam:'Collector',openBedrag:200,saldo:200,bankRepayment:{enabled:true,counterparty:'Collector',reference:'Dossier ABC12345',fromDate:'2026-10-23'}}];
 const debit={...tx('debt','2026-10-24',-100,'Collector'),description:'Dossier ABC12345'};
 const r=reconcileDebtPayments(debts,[debit],emptyDebtLedger(),'2026-10-25');assert.equal(r.applied,1);assert.equal(r.debts[0].saldo,100);
 assert.equal(reconcileDebtPayments(r.debts,[debit],r.ledger,'2026-10-25').applied,0);
 assert.equal(reconcileDebtPayments(debts,[{...debit,amount:-300}],emptyDebtLedger(),'2026-10-25').applied,0);
 const refund={...debit,id:'refund',amount:100,description:'Terugboeking',date:'2026-10-25'};
 assert.equal(reconcileDebtPayments(debts,[debit,refund],emptyDebtLedger(),'2026-10-25').applied,0);
 assert.ok(reconcileDebtPayments(r.debts,[debit,refund],r.ledger,'2026-10-25').questions.some(q=>q.reason.includes('teruggeboekt')));
});

test('confirmed mixed debt allocations preserve remainder, prevent double application and exceed neither payment nor principal', async()=>{
 const {confirmDebtAllocation}=await import('../src/bank/debtPayments');
 const ds=[{id:'a',naam:'A',openBedrag:200,saldo:200},{id:'b',naam:'B',openBedrag:300,saldo:300}];
 const t=tx('mixed','2026-10-24',-400,'Parent');
 const one=confirmDebtAllocation(ds,t,emptyDebtLedger(),'a',10000);
 const two=confirmDebtAllocation(one.debts,t,one.ledger,'b',10000);
 assert.equal(two.ledger.entries.length,1);assert.equal(two.debts[0].saldo,100);assert.equal(two.debts[1].saldo,200);
 assert.throws(()=>confirmDebtAllocation(two.debts,t,two.ledger,'a',10000));
 assert.throws(()=>confirmDebtAllocation(ds,t,emptyDebtLedger(),'a',25000));
 const p=makePeriodPlan([],[],[],ds,'2026-10-23');
 const r=reconcilePeriod('2026-10','2026-10-25',p,true,[t],two.ledger,emptyBankRules);
 assert.equal(r.actual.debt,20000);assert.equal(r.unmatched[0].cents,-20000);assert.equal(r.unmatched[0].partlyAllocated,true);
});
