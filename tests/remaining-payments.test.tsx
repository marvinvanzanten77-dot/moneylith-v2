import test from 'node:test';
import assert from 'node:assert/strict';
import {personalInput} from '../src/projection/adapters';
import {emptyOptions,project} from '../src/projection/engine';
import {buildMoneylithSnapshot} from '../src/core/moneylithSnapshot';
import type {MoneylithTransaction} from '../src/types';
const tx=(id:string,date:string,amount:number,label='Huur'):MoneylithTransaction=>({id,date,amount,counterparty:label,description:label,accountId:'p',provider:'lunchflow',currency:'EUR',category:label});
const rent={id:'rent',naam:'Huur',bedrag:600,dagVanMaand:1,bankEvidence:{key:'rent',transactionIds:['anchor'],through:'2026-10-01'}};
const fuel={id:'fuel',naam:'Tanken',bedrag:200,dagVanMaand:23,budgetCategory:'Tanken'};
const food={id:'food',naam:'Boodschappen',bedrag:300,dagVanMaand:23,budgetCategory:'Boodschappen'};
const options={...emptyOptions(),confirmOpening:true};
const base={fixedCosts:[rent,fuel,food],accounts:[{id:'p',active:true,startBalance:2000}],transactions:[tx('anchor','2026-10-01',-600),tx('fuel','2026-10-24',-50,'Tanken'),tx('food','2026-10-24',-80,'Boodschappen')]};
test('forecast keeps upcoming rent and only remaining fuel/grocery budgets; 7/30/90 days share integer-cent events',()=>{
 const original=JSON.stringify(base),p=personalInput(base,options,'2026-10-25');
 assert.equal(p.commitments?.find(r=>r.label==='Huur')?.remaining,60000);
 assert.equal(p.commitments?.find(r=>r.label==='Huur')?.date,'2026-11-01');
 assert.equal(p.commitments?.find(r=>r.label==='Tanken')?.remaining,15000);
 assert.equal(p.commitments?.find(r=>r.label==='Boodschappen')?.remaining,22000);
 assert.equal(p.events.filter(e=>e.date!<='2026-11-22').reduce((s,e)=>s+e.amount!,0),-97000);
 // Input readiness is covered separately; verify engine arithmetic against independently summed commitments.
 const result=project({...p,missing:[]});
 for(const horizon of result.horizons)assert.equal(horizon.cash,200000+p.events.filter(e=>e.date&&e.date<=horizon.date).reduce((s,e)=>s+e.amount!,0));
 assert.equal(JSON.stringify(base),original);
});
test('partial and early manual payments reduce a pending bill only after bank evidence; overdue bills stay pending',()=>{
 const paid={...base,transactions:[...base.transactions,tx('paid','2026-10-25',-250)]};
 assert.equal(personalInput(paid,options,'2026-10-25').commitments?.[0].remaining,35000);
 const late=personalInput(base,options,'2026-11-04');assert.equal(late.commitments?.[0].remaining,60000);assert.equal(late.commitments?.[0].date,'2026-11-05');
 const full=personalInput({...base,transactions:[...base.transactions,tx('paid','2026-10-25',-600)]},options,'2026-10-25');
 assert.equal(full.commitments?.[0].remaining,0);assert.ok(!full.events.some(e=>e.id.startsWith('fixed:rent')&&e.date!<='2026-11-22'));
});
test('refunds restore commitments; business transactions cannot pay personal bills or budgets',()=>{
 const debit=tx('paid','2026-10-25',-600),refund={...tx('refund','2026-10-26',600),description:'Terugboeking incasso'};
 assert.equal(personalInput({...base,transactions:[...base.transactions,debit,refund]},options,'2026-10-26').commitments?.[0].remaining,60000);
 const isolated=personalInput({...base,bankRules:{rules:[],accountRoles:{biz:'business'}},transactions:[...base.transactions,{...debit,accountId:'biz'}]},options,'2026-10-25');
 assert.equal(isolated.commitments?.[0].remaining,60000);
});
test('budget excess is not charged again; pace is an explicit assumption; missing budget remains unknown',()=>{
 const p=personalInput({...base,transactions:[...base.transactions,tx('more','2026-10-30',-200,'Tanken')]},options,'2026-10-30');
 const row=p.commitments?.find(r=>r.label==='Tanken');assert.equal(row?.remaining,0);assert.match(row!.note,/aanname/);
 assert.equal(p.events.filter(e=>e.id.startsWith('fixed:fuel')&&e.date!<='2026-11-22').reduce((s,e)=>s+e.amount!,0),0);
 const unknown=personalInput({...base,fixedCosts:[{...fuel,amountEntered:false}]},options,'2026-10-25');assert.equal(unknown.commitments?.[0].remaining,null);
 assert.ok(unknown.events.some(e=>e.amount===null));
});
test('bunq funding is counted once without claiming the subscription was paid; confirmed off-bank amounts survive normalization',()=>{
 const data={fixedCosts:[{id:'phone',naam:'Telefoon',bedrag:50,dagVanMaand:27,paymentRoute:'card'}],transactions:[{...tx('topup','2026-10-24',-100,'bunq'),bankPatternKind:'transfer'}],periodPaid:{'2026-10':{'fixed:phone':2000}}};
 const snapshot=buildMoneylithSnapshot({personal:data});assert.deepEqual(snapshot.personal.periodPaid,data.periodPaid);
 const p=personalInput(snapshot.personal,options,'2026-10-25');assert.equal(p.commitments?.[0].remaining,0);assert.equal(p.commitments?.[0].paid,2000);assert.match(p.commitments![0].note,/niet bewezen/);
 assert.deepEqual(snapshot.business.periodPaid,{});
});
test('manual monthly debt stays pending until sync ledger proves allocation; no-arrangement debt adds no payment',()=>{
 const debt={id:'d',naam:'Schuld',openBedrag:500,minBetaling:100,afschrijfDag:23};
 const p=personalInput({debts:[debt]},options,'2026-10-25');assert.equal(p.events.find(e=>e.id==='debt:d:remaining:2026-10')?.amount,-10000);
 const booked=tx('repayment','2026-10-24',-100,'Schuld');
 const ledger={version:1,entries:[{transactionId:booked.id,accountId:'p',date:booked.date,paidCents:10000,allocations:[{debtId:'d',cents:10000}],source:'confirmed'}]};
 const paid=personalInput({debts:[{...debt,openBedrag:400}],transactions:[booked],debtPayments:ledger},options,'2026-10-25');assert.ok(!paid.events.some(e=>e.source==='debt'&&e.date!<='2026-11-22'));
 assert.ok(!personalInput({debts:[{...debt,minBetaling:0}]},options,'2026-10-25').events.some(e=>e.amount!<0));
});
test('AI rebuilds remaining commitments from the active personal evidence',async()=>{
 const {buildChatRequest}=await import('../src/ai/context');
 const {today}=await import('../src/projection/engine');
 const readiness=Object.fromEntries(['income','fixed','debts','assets'].map(k=>[k,{ready:false,valid:false,hasRows:true}]));
 const result=buildChatRequest({scope:'personal',question:'Welke betaling komt eraan?',history:[],projectionOptions:options,context:{readiness,data:{...base,transactions:[]}}});
 const context=result.messages.at(-1)!.content;
 assert.match(context,/remainingCommitments/);assert.match(context,/Huur/);assert.match(context,/resterende bedrag/);assert.ok(today());
});
