import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboard} from '../src/redesign/dashboard';
import {emptyOptions} from '../src/projection/engine';
import {reviewSection,manualReviewRows} from '../src/logic/inputReadiness';
const asOf='2026-10-28';
const account=(id:string,balance:number)=>({id,name:id,type:'betaalrekening',active:true,bankProvider:'lunchflow',currency:'EUR',bankBalance:balance,bankBalanceFetchedAt:asOf+'T08:00:00Z'});
const state=(values:Record<string,unknown>)=>Object.fromEntries(Object.entries(values).map(([key,value])=>['moneylith.personal.'+key,JSON.stringify(value)]));
test('empty dashboard never fabricates balances, spendable money or zero spending',()=>{
 const d=dashboard({},asOf);assert.equal(d.bank,undefined);assert.equal(d.view.available,null);assert.equal(d.planned,null);assert.equal(d.spending.totalCents,null);assert.deepEqual(d.accounts,[]);
});
test('dashboard sums personal provider balances in cents and isolates business data',()=>{
 const s=state({accounts:[account('ing',100.11),account('bunq',25.09),account('business',9999)],'bankRules.v1':{rules:[],accountRoles:{business:'business'}}});
 s['moneylith.business.accounts']=JSON.stringify([account('foreign',123456)]);
 const before=JSON.stringify(s);const d=dashboard(s,asOf);assert.equal(d.bank?.cents,12520);assert.equal(d.accounts.length,2);assert.equal(d.input.opening,12520);assert.equal(d.view.available,null);assert.equal(JSON.stringify(s),before);
});
test('one missing account balance keeps the bank sum unknown',()=>{
 const d=dashboard(state({accounts:[account('one',500),{...account('two',20),bankBalance:null}]}),asOf);assert.equal(d.bank?.cents,null);assert.equal(d.input.opening,null);
});
test('spending uses the salary period and only budget excess, without internal transfers',()=>{
 const tx=(id:string,date:string,amount:number,kind='variable')=>({id,date,amount,accountId:'ing',provider:'lunchflow',currency:'EUR',bankPatternKind:kind,category:'Boodschappen'});
 const s=state({accounts:[account('ing',1000)],fixedCosts:[{id:'food',naam:'Boodschappen',bedrag:100,amountEntered:true,dagVanMaand:23,budgetCategory:'Boodschappen',budgetSince:'2026-10'}],transactions:[tx('old','2026-10-22',-100),tx('a','2026-10-24',-80),tx('b','2026-10-25',-50),tx('transfer','2026-10-26',-400,'transfer')]});
 const before=JSON.stringify(s);const d=dashboard(s,asOf);assert.equal(d.spending.totalCents,3000);assert.equal(d.period.start,'2026-10-23');assert.equal(d.period.end,'2026-11-22');assert.equal(JSON.stringify(s),before);
});
test('confirmed input reuses the projection and does not deduct already paid purchases twice',()=>{
 const income=[{id:'salary',naam:'Salaris',bedrag:2000,amountEntered:true,dagVanMaand:23}];
 const fixed=[{id:'rent',naam:'Huur',bedrag:600,amountEntered:true,dagVanMaand:1}];
 const s=state({accounts:[account('ing',1000)],income,fixedCosts:fixed,debts:[],transactions:[],'inputReviews.v1':{income:reviewSection('income','Inkomen',manualReviewRows(income),{}).signature,fixed:reviewSection('fixed','Vaste lasten',manualReviewRows(fixed),{}).signature,debts:reviewSection('debts','Schulden',[],{}).signature}});
 const d=dashboard(s,asOf,{...emptyOptions(),reservedNow:0});assert.equal(d.input.missing.length,0);assert.equal(d.view.available,40000);assert.equal(d.protected,60000);assert.equal(d.view.until,'2026-11-22');assert.ok(d.view.outgoing.some(e=>e.label.includes('Huur')&&e.amount===-60000));
});
test('explicitly confirmed empty obligations remain valid zero rather than unknown',()=>{
 const s=state({accounts:[account('ing',500)],'inputReviews.v1':{income:reviewSection('income','Inkomen',[],{}).signature,fixed:reviewSection('fixed','Vaste lasten',[],{}).signature,debts:reviewSection('debts','Schulden',[],{}).signature}});
 const d=dashboard(s,asOf,{...emptyOptions(),reservedNow:0});assert.equal(d.planned,0);assert.equal(d.view.available,50000);
});

test('connected presentation consumes the same classified snapshot as the projection, without writes', async()=>{
 const {presentPersonal}=await import('../src/redesign/dashboard');
 const source={accounts:[account('personal',1000)],transactions:[{id:'purchase',accountId:'personal',date:asOf,amount:-24,currency:'EUR',provider:'lunchflow',description:'Aankoop',bankPatternKind:'variable',category:'Kleding en schoenen',bankPatternCategory:'Kleding en schoenen'}],income:[],fixedCosts:[],debts:[],assets:[],goals:[]};
 const before=JSON.stringify(source);
 const d=presentPersonal(source,asOf);
 assert.equal(d.bank?.cents,100000);
 assert.equal(d.spending.pots[0]?.label,'Kleding en schoenen');
 assert.equal(d.spending.pots[0]?.cents,2400);
 assert.equal(JSON.stringify(source),before);
});
test('incomplete input exposes a labelled known subtotal without changing strict projection',()=>{
 const s=state({accounts:[account('ing',519.19)],fixedCosts:[
  {id:'rent',naam:'Huur',bedrag:369,amountEntered:true,dagVanMaand:30},
  {id:'phone',naam:'Simyo',bedrag:144.95,amountEntered:true,dagVanMaand:19},
  {id:'unknown',naam:'Onbekende last',amountEntered:false,dagVanMaand:1},
 ],income:[{id:'salary',naam:'Salaris',bedrag:2000,amountEntered:true,dagVanMaand:23}]});
 const before=JSON.stringify(s),d=dashboard(s,asOf);
 assert.equal(d.view.available,null);assert.equal(d.planned,null);
 assert.equal(d.provisional,true);assert.equal(d.knownPlanned,51395);
 assert.equal(d.available,524);assert.equal(d.knownProtected,51395);
 assert.equal(d.input.reserve,null);
 assert.ok(d.view.missing.some(m=>m.includes('Onbekende last')));
 assert.equal(JSON.stringify(s),before);
});
test('provisional subtotal deducts declared reserves and preserves a negative remaining amount',()=>{
 const d=dashboard(state({accounts:[account('ing',100)],fixedCosts:[{id:'rent',naam:'Huur',bedrag:150,dagVanMaand:30,amountEntered:true}]}),asOf,{...emptyOptions(),reservedNow:2500});
 assert.equal(d.available,-7500);assert.equal(d.knownProtected,17500);
});
test('missing account balance never becomes a spendable estimate',()=>{
 const d=dashboard(state({accounts:[{...account('ing',100),bankBalance:null}],fixedCosts:[{id:'rent',naam:'Huur',bedrag:50,dagVanMaand:30,amountEntered:true}]}),asOf);
 assert.equal(d.available,null);assert.equal(d.knownPlanned,5000);
});
test('remaining budget enters known totals once and paid purchases are not deducted again',()=>{
 const s=state({accounts:[account('ing',500)],fixedCosts:[{id:'food',naam:'Boodschappen',bedrag:100,amountEntered:true,dagVanMaand:23,budgetCategory:'Boodschappen',budgetSince:'2026-10'}],income:[{id:'salary',naam:'Salaris',bedrag:1000,amountEntered:true,dagVanMaand:23}],transactions:[{id:'paid',date:'2026-10-24',amount:-40,accountId:'ing',provider:'lunchflow',currency:'EUR',bankPatternKind:'variable',category:'Boodschappen'}]});
 const d=dashboard(s,asOf);
 assert.equal(d.available,44000);assert.equal(d.knownProtected,6000);
 assert.ok(d.view.outgoing.some(e=>e.id.includes(':budget:')));
});
