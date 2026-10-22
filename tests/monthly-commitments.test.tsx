import test from 'node:test';
import assert from 'node:assert/strict';
import { spendingAboveBudgets, observedBudgetAverage, spendingSummary, type SpendingRow } from '../src/bank/spending';
import { refreshLatestIncome } from '../src/bank/financialImport';
import { personalInput } from '../src/projection/adapters';
import { emptyOptions } from '../src/projection/engine';
import { manualReviewRows } from '../src/logic/inputReadiness';
import { matchingBankRule, validateBankRules, type BankRuleSettings } from '../src/bank/classificationRules';
import type { FixedCostManualItem, IncomeItem, MoneylithTransaction } from '../src/types';
const budget:FixedCostManualItem={id:'budget',naam:'Boodschappen',bedrag:50,amountEntered:true,dagVanMaand:0,paymentRoute:'bank',budgetCategory:'Boodschappen',budgetSince:'2026-10'};
const rows:SpendingRow[]=[{id:'a',date:'2026-10-01',cents:4000,label:'Boodschappen'},{id:'b',date:'2026-10-02',cents:2000,label:'Boodschappen'},{id:'c',date:'2026-10-03',cents:500,label:'Koffie'},{id:'d',date:'2026-10-03',cents:300,label:null}];
test('monthly budgets allocate only excess, preserve facts, reset each month and respect start month',()=>{
 const original=JSON.stringify(rows);const visible=spendingAboveBudgets(rows,[budget]);
 assert.equal(JSON.stringify(rows),original);assert.equal(visible.find(r=>r.id==='b')?.cents,1000);assert.equal(visible.find(r=>r.id==='b')?.label,'Boodschappen — boven maandbudget');assert.equal(visible.length,3);
 assert.equal(spendingSummary(visible,'2026-10','2026-10-22').totalCents,1800);
 assert.equal(spendingAboveBudgets([{...rows[0],date:'2026-09-01'}],[budget])[0].cents,4000);
 assert.equal(spendingAboveBudgets([...rows,{...rows[0],id:'nov',date:'2026-11-01'}],[budget]).some(r=>r.id==='nov'),false);
 assert.equal(spendingAboveBudgets(rows,[{...budget,bedrag:0}])[0].cents,4000);
 assert.deepEqual(spendingAboveBudgets(rows,[budget,{...budget,id:'duplicate'}]),rows);
 assert.deepEqual(spendingAboveBudgets(rows,[{...budget,amountEntered:false}]),rows);
});
test('average excludes current and missing months, no history is unknown',()=>{
 assert.deepEqual(observedBudgetAverage(rows,'Boodschappen','2026-10-22'),{months:[],cents:null});
 const r=[{...rows[0],date:'2026-09-01'},{...rows[1],date:'2026-07-01'},...rows];
 assert.deepEqual(observedBudgetAverage(r,'Boodschappen','2026-10-22'),{months:['2026-07','2026-09'],cents:3000});
});
const tx=(id:string,date:string,amount:number):MoneylithTransaction=>({id,date,amount,accountId:'personal',provider:'lunchflow',currency:'EUR',counterparty:'Werkgever',description:'Salaris'});
const income:IncomeItem={id:'salary',naam:'Salaris',bedrag:2000,dagVanMaand:23,bankEvidence:{key:'salary',transactionIds:['sep'],through:'2026-09-23'},followLatestBank:true,payrollDeductions:{'2026-10':300},opmerking:'bewaren'};
test('latest salary updates only opted-in income from same source; never subtract payroll notes',()=>{
 const transactions=[tx('sep','2026-09-23',2000),tx('oct','2026-10-23',1900),{...tx('business','2026-10-24',9000),accountId:'business'}];
 const next=refreshLatestIncome(transactions,[income],'2026-10-24');
 assert.equal(next[0].bedrag,1900);assert.equal(next[0].opmerking,'bewaren');assert.deepEqual(next[0].payrollDeductions,income.payrollDeductions);
 assert.deepEqual(refreshLatestIncome(transactions,next,'2026-10-24'),next);
 assert.equal(income.bedrag,2000);
 assert.equal(refreshLatestIncome([tx('sep','2026-09-23',1950)],[income],'2026-10-22')[0].bedrag,1950);
 assert.equal(refreshLatestIncome(transactions,[{...income,followLatestBank:false}],'2026-10-24')[0].bedrag,2000);
 assert.equal(refreshLatestIncome(transactions,[income],'2026-10-22')[0].bedrag,2000);
 assert.equal(refreshLatestIncome([...transactions,tx('ambiguous','2026-10-23',150)],[income],'2026-10-24')[0].bedrag,2000);
});
test('informational payroll deduction never changes readiness total or projection',()=>{
 assert.deepEqual(manualReviewRows([income]),manualReviewRows([{...income,payrollDeductions:{'2026-10':999}}]));
 const input=personalInput({income:[income]},emptyOptions(),'2026-10-22');
 const changed=personalInput({income:[{...income,payrollDeductions:{'2026-10':999}}]},emptyOptions(),'2026-10-22');
 assert.deepEqual(input.events,changed.events);assert.equal(input.events.find(e=>e.id==='income:salary:2026-10-23')?.amount,200000);
});
test('withheld fixed cost remains recorded but no second cash debit; unknown amount is not confirmed',()=>{
 const withheld:FixedCostManualItem={id:'cak',naam:'Inhouding',bedrag:100,amountEntered:true,dagVanMaand:23,paymentRoute:'withheld'};
 assert.equal(manualReviewRows([withheld])[0].amount,0);
 assert.equal(manualReviewRows([{...withheld,amountEntered:false}])[0].complete,false);
 const input=personalInput({fixedCosts:[withheld,budget]}, {...emptyOptions(),monthlyDay:23},'2026-10-22');
 assert.equal(input.events.find(e=>e.id==='fixed:cak:2026-10-23')?.amount,0);
 assert.equal(input.events.find(e=>e.id==='fixed:budget:2026-10-23')?.amount,-5000);
});
test('remaining debt schedules start on exact date and stop after two and three payments',()=>{
 const debts=[{id:'a',naam:'Lening A',openBedrag:200,minBetaling:100,firstPaymentDate:'2026-10-23',remainingPayments:2},{id:'b',naam:'Lening B',openBedrag:300,minBetaling:100,firstPaymentDate:'2026-10-23',remainingPayments:3}];
 const input=personalInput({debts},emptyOptions(),'2026-10-22');
 assert.deepEqual(input.events.filter(e=>e.debtId==='a').map(e=>e.date),['2026-10-23','2026-11-23']);
 assert.deepEqual(input.events.filter(e=>e.debtId==='b').map(e=>e.date),['2026-10-23','2026-11-23','2026-12-23']);
 assert.equal(personalInput({debts},emptyOptions(),'2026-12-24').events.filter(e=>e.source==='debt').length,0);
 assert.equal(personalInput({debts:[{...debts[0],firstPaymentDate:undefined}]},emptyOptions(),'2026-10-22').missing.some(m=>m.includes('aflosschema')),true);
});
test('specific third party fixed payments can precede general family financing without using name alone',()=>{
 const rules:BankRuleSettings={accountRoles:{},rules:[{id:'insurance',label:'Verzekering',kind:'fixed',terms:['Test Family'],direction:'out',aboveCents:5299,belowCents:5301},{id:'loan',label:'Lening',kind:'financing',terms:['Test Family']}]};
 assert.equal(validateBankRules(rules),true);
 const transfer={...tx('x','2026-10-23',-53),counterparty:'Test Family',description:'overboeking'};
 assert.equal(matchingBankRule(transfer,rules)?.kind,'fixed');assert.equal(matchingBankRule({...transfer,amount:-100},rules)?.kind,'financing');assert.equal(matchingBankRule({...transfer,amount:53},rules)?.kind,'financing');
});
test('budget and withheld manual costs still count correctly alongside legacy detected costs',()=>{
 const input=personalInput({fixedCosts:[budget,{id:'health',naam:'Inhouding',bedrag:100,amountEntered:true,paymentRoute:'withheld',dagVanMaand:23}],detectedFixedCosts:[{id:'rent',descriptionPattern:'Huur',estimatedMonthlyAmount:500,isFixed:true,isIgnored:false}]},{...emptyOptions(),monthlyDay:23},'2026-10-22');
 const due=input.events.filter(e=>e.date==='2026-10-23'&&e.id.startsWith('fixed:'));
 assert.equal(due.reduce((s,e)=>s+(e.amount??0),0),-55000);
});
test('AI context explicitly treats salary withholdings as notes and distinguishes budget excess',async()=>{
 const {buildChatRequest}=await import('../src/ai/context');
 const readiness=Object.fromEntries(['income','fixed','debts','assets'].map(k=>[k,{ready:false,valid:false,hasRows:true}]));
 const result=buildChatRequest({scope:'personal',question:'Wat betekent mijn looninhouding?',history:[],context:{month:'2026-10',readiness,data:{income:[income],fixedCosts:[budget],debts:[]}}});
 assert.match(result.messages[0].content,/trek deze nooit opnieuw af/);
 assert.match(result.messages.at(-1)!.content,/payrollDeductions/);
 assert.match(result.messages.at(-1)!.content,/followLatestBank/);
 const coach=buildChatRequest({scope:'personal',purpose:'spending-coach',context:{month:'2026-10',rows:spendingAboveBudgets(rows,[budget])}});
 assert.match(coach.messages[0].content,/uitsluitend de delen boven een bevestigd budget/);
 assert.match(coach.messages[1].content,/Boodschappen — boven maandbudget/);
 assert.ok(!coach.messages[1].content.includes('payrollDeductions'));
});
