import test from 'node:test';
import assert from 'node:assert/strict';
import {personalExpectations} from '../src/bank/expectations';
import {makePeriodPlan,reconcilePeriod} from '../src/bank/periodReconciliation';
import {emptyBankRules} from '../src/bank/classificationRules';
import {emptyDebtLedger} from '../src/bank/debtPayments';
import {personalInput} from '../src/projection/adapters';
import {emptyOptions} from '../src/projection/engine';
import type {FixedCostManualItem,MoneylithTransaction} from '../src/types';
const cost:FixedCostManualItem={id:'tool',naam:'Werktool',bedrag:0,amountEntered:false,dagVanMaand:5,monthlyVariable:true,monthlyAmounts:{},paymentRoute:'card',bankObservedOnly:true};
const tx=(id:string,date:string,value:number):MoneylithTransaction=>({id,accountId:'a',provider:'bunq',currency:'EUR',date,amount:-value,description:'Werktool',bankPatternKind:'fixed',category:'Werktool',bankRuleLabel:'Werktool'});
const history=[tx('aug','2026-08-05',40),tx('sep','2026-09-05',60),tx('oct','2026-10-05',50)];
const data=(fixed=cost,transactions=history)=>({fixedCosts:[fixed],transactions,debts:[],income:[],bankRules:emptyBankRules,debtPayments:emptyDebtLedger()});
function estimate(fixed=cost,transactions=history){return personalExpectations(data(fixed,transactions),'2026-10-29');}
test('variable costs use a cents-based three-period expectation without changing the source',()=>{
 const source=data(),before=JSON.stringify(source);const e=personalExpectations(source,'2026-10-29');const c=(e.data.fixedCosts as FixedCostManualItem[])[0];
 assert.equal(c.monthlyAmounts?.['2026-11'],50);assert.equal(c.bankEstimate?.samples,3);assert.equal(c.bankEstimate?.settlesOnPayment,true);assert.equal(JSON.stringify(source),before);assert.equal(e.notes.length,1);
});
test('explicit month amount and explicit zero override a bank estimate',()=>{
 const e=estimate({...cost,monthlyAmounts:{'2026-11':0,'2026-12':144.95}});const c=(e.data.fixedCosts as FixedCostManualItem[])[0];assert.equal(c.monthlyAmounts?.['2026-11'],0);assert.equal(c.monthlyAmounts?.['2026-12'],144.95);assert.equal(c.bankEstimate?.months.includes('2026-11'),false);
});
test('one-off credits and a single observed purchase do not become subscriptions',()=>{
 assert.equal(estimate({...cost,costKind:'credits'}).notes.length,0);assert.equal(estimate(cost,[history[2]]).notes.length,0);
});
test('business payments, transfers and reversed payments do not establish a personal baseline',()=>{
 const source=data();source.bankRules={...emptyBankRules,accountRoles:{a:'business'}};assert.equal(personalExpectations(source,'2026-10-29').notes.length,0);
 assert.equal(estimate(cost,history.map(t=>({...t,bankPatternKind:'transfer'}))).notes.length,0);
 const reversed=history.flatMap(t=>[t,{...t,id:t.id+'-reversal',amount:-t.amount,description:'Terugboeking',counterparty:'Werktool'}]).map(t=>({...t,counterparty:'Werktool'}));assert.equal(estimate(cost,reversed).notes.length,0);
});
test('a concrete variable payment replaces the estimated amount, with no residual phantom bill',()=>{
 const transactions=[...history,tx('nov','2026-11-05',32)];const e=personalExpectations(data(cost,transactions),'2026-11-06');const fixed=e.data.fixedCosts as FixedCostManualItem[];
 const report=reconcilePeriod('2026-10','2026-11-06',makePeriodPlan([],fixed,[],[],'2026-11-06'),true,transactions,emptyDebtLedger(),emptyBankRules);
 assert.equal(report.rows[0].expected,5000);assert.equal(report.rows[0].actual,3200);assert.equal(report.rows[0].forecast,3200);
 const input=personalInput(data(cost,transactions),emptyOptions(),'2026-11-06');assert.equal(input.commitments?.find(c=>c.label==='Werktool')?.remaining,0);
});
test('an explicitly entered bill keeps a partial payment outstanding',()=>{
 const transactions=[...history,tx('nov','2026-11-05',32)];const input=personalInput(data({...cost,bankObservedOnly:false,monthlyAmounts:{'2026-11':60}},transactions),emptyOptions(),'2026-11-06');assert.equal(input.commitments?.find(c=>c.label==='Werktool')?.remaining,2800);
});
test('multiple purchases remain a flexible estimate, not proof that the month is complete',()=>{
 const e=estimate(cost,[...history,tx('extra','2026-10-06',20)]);assert.equal((e.data.fixedCosts as FixedCostManualItem[])[0].bankEstimate?.settlesOnPayment,false);
});

test('changing work tools and one-off credits share one envelope without duplicate subscriptions',()=>{
 const tools=[{...cost,id:'tool-a',naam:'Tool A',costGroup:'work-tools' as const,costKind:'credits' as const},{...cost,id:'tool-b',naam:'Tool B',costGroup:'work-tools' as const}];
 const transactions=[{...tx('a','2026-09-05',60),category:'Tool A',bankRuleLabel:'Tool A'},{...tx('b','2026-10-05',100),category:'Tool B',bankRuleLabel:'Tool B'},{...tx('c','2026-10-28',25),category:'Tool A',bankRuleLabel:'Tool A'}];
 const source={...data(),fixedCosts:tools,transactions};const e=personalExpectations(source,'2026-10-29');const fixed=e.data.fixedCosts as FixedCostManualItem[];
 assert.equal(fixed.length,1);assert.equal(fixed[0].id,'automatic-work-tools');assert.equal(fixed[0].bedrag,80);
 const input=personalInput(source,emptyOptions(),'2026-10-29');const c=input.commitments?.find(c=>c.label==='Flexibele werktools en credits');assert.equal(c?.paid,2500);assert.equal(c?.remaining,5500);
 assert.equal(input.events.filter(e=>e.id.startsWith('fixed:tool-a')||e.id.startsWith('fixed:tool-b')).length,0);
 assert.equal(tools[0].bankObservedOnly,true);
});
test('payment dates can be inferred from repeated matched bookings; explicit unknown stays unknown',()=>{
 const inferred=estimate({...cost,dagVanMaand:0});assert.equal((inferred.data.fixedCosts as FixedCostManualItem[])[0].dagVanMaand,5);
 const explicit=estimate({...cost,monthlyAmounts:{'2026-11':null}});assert.equal((explicit.data.fixedCosts as FixedCostManualItem[])[0].monthlyAmounts?.['2026-11'],null);
});
test('changing actuals recalculates expectations without rewriting a captured starting plan',async()=>{
 const {capturePeriodPlan}=await import('../src/bank/periodReconciliation');
 const first=estimate();const initial=makePeriodPlan([],first.data.fixedCosts as FixedCostManualItem[],[],[],'2026-10-29');
 const saved=capturePeriodPlan({},initial,'2026-10-29');const before=JSON.stringify(saved);
 const revised=personalExpectations(data(cost,[...history,tx('nov','2026-11-05',32)]),'2026-11-06');
 assert.equal(capturePeriodPlan(saved,makePeriodPlan([],revised.data.fixedCosts as FixedCostManualItem[],[],[],'2026-11-06'),'2026-11-06'),saved);assert.equal(JSON.stringify(saved),before);
});
