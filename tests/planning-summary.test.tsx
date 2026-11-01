import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceModel} from '../src/redesign/workspaceModel';
import {planningSummary} from '../src/redesign/planningSummary';
const state=Object.fromEntries(Object.entries({income:[{id:'salary',naam:'Salaris',bedrag:1844.40,amountEntered:true,dagVanMaand:23}],fixedCosts:[{id:'rent',naam:'Huur',bedrag:369,amountEntered:true,dagVanMaand:28},{id:'tool',naam:'Wisselend abonnement',bedrag:0,amountEntered:false,dagVanMaand:19}],debts:[{id:'debt',naam:'Regeling',saldo:200,minimaleMaandlast:100}]}).map(([k,v])=>['moneylith.personal.'+k,JSON.stringify(v)]));
test('one unknown cost does not hide known totals in current and future periods',()=>{
 for(const period of ['2026-10','2026-11','2026-12']){
 const report=workspaceModel(state,period,'2026-11-01').report;const before=JSON.stringify(report);
 const s=planningSummary(report,{income:true,fixed:false});
 assert.equal(s.income,184440);assert.equal(s.out,46900);assert.equal(s.remaining,137540);assert.equal(s.partial,true);
 assert.ok(s.issues.some(i=>i.id==='fixed:tool'));assert.equal(report.forecast.fixed,null);assert.equal(JSON.stringify(report),before);
 }
});
test('unreviewed complete values are visible but clearly provisional',()=>{
 const report=workspaceModel({...state,'moneylith.personal.fixedCosts':JSON.stringify([{id:'rent',naam:'Huur',bedrag:369,amountEntered:true}])},'2026-10','2026-11-01').report;
 assert.equal(planningSummary(report,{income:false,fixed:false}).remaining,137540);
 assert.equal(planningSummary(report,{income:true,fixed:true}).partial,false);
});
test('empty unconfirmed and historical unknown sections are never invented zero totals',()=>{
 const empty=workspaceModel({},'2026-10','2026-11-01').report;
 assert.equal(planningSummary(empty).out,null);assert.equal(planningSummary(empty).remaining,null);
 const confirmed=planningSummary(empty,{income:true,fixed:true});assert.equal(confirmed.remaining,0);
 const historic=planningSummary(workspaceModel(state,'2026-08','2026-11-01').report);
 assert.equal(historic.remaining,null);assert.ok(historic.issues.some(i=>i.reason.includes('betaald bedrag')));
});
test('payroll deductions are not deducted twice',()=>{
 const report=workspaceModel({...state,'moneylith.personal.fixedCosts':JSON.stringify([{id:'withheld',naam:'Inhouding',bedrag:100,amountEntered:true,paymentRoute:'withheld'}])},'2026-10','2026-11-01').report;
 const s=planningSummary(report,{income:true,fixed:true});assert.equal(s.out,10000);assert.equal(s.remaining,174440);
});
test('observed bunq billing counts once when paid, without inventing a recurring price',()=>{
 const fee={id:'fee',naam:'bunq-bankkosten',bedrag:0,amountEntered:false,dagVanMaand:0,paymentRoute:'card',bankObservedOnly:true};
 const debit={id:'fee-debit',accountId:'bunq',provider:'bunq',currency:'EUR',date:'2026-10-26',amount:-9.99,counterparty:'bunq bv',description:'Bankkosten',bankPatternKind:'fixed',bankRuleLabel:'bunq-bankkosten',providerData:{paymentSubType:'BILLING'}};
 const s={...state,'moneylith.personal.fixedCosts':JSON.stringify([fee]),'moneylith.personal.transactions':JSON.stringify([debit,debit])};const before=JSON.stringify(s);
 const report=workspaceModel(s,'2026-10','2026-11-01').report;
 const row=report.rows.find(r=>r.id==='fixed:fee')!;
 assert.equal(row.actual,999);assert.equal(row.forecast,999);assert.equal(row.expected,null);
 const summary=planningSummary(report,{income:true,fixed:false},{fixed:'previous-signature'});
 assert.equal(summary.out,10999);assert.ok(!summary.issues.some(i=>i.id==='fixed:fee'));
 assert.match(summary.issues.find(i=>i.id==='review-fixed')!.reason,/Eerder bevestigd/);
 assert.equal(workspaceModel(s,'2026-11','2026-11-01').report.rows.find(r=>r.id==='fixed:fee')!.forecast,null);
 const refund={...debit,id:'refund',date:'2026-10-27',amount:9.99,description:'Terugboeking incasso',providerData:{paymentSubType:'REVERSAL'}};
 const reversed=workspaceModel({...s,'moneylith.personal.transactions':JSON.stringify([debit,refund])},'2026-10','2026-11-01').report.rows.find(r=>r.id==='fixed:fee')!;
 assert.equal(reversed.reversed,true);assert.equal(reversed.forecast,null);assert.equal(JSON.stringify(s),before);
});
