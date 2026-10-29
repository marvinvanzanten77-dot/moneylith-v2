import test from 'node:test';import assert from 'node:assert/strict';
import {applyEdits,undoReceipt,journalKey,type Receipt} from '../server/agent/actions';
import {readRecords,personalAgentState} from '../server/agent/service';
const state={
 'moneylith.personal.accounts':JSON.stringify([{id:'bank',name:'ING',type:'betaalrekening',active:true,bankProvider:'lunchflow',bankBalance:500}]),
 'moneylith.personal.debts':JSON.stringify([{id:'debt',naam:'Testschuld',openBedrag:1000,saldo:1000,minBetaling:0,minimaleMaandlast:0}]),
 'moneylith.business.accounts':JSON.stringify([{id:'business',name:'Zakelijk',bankBalance:9999}]),
};
const edit=(collection:string,id:string|null,changes:Record<string,unknown>)=>({collection,id,changes});
test('add manual account without inventing a bank connection or unknown zero balance',()=>{
 const before=JSON.stringify(state),r=applyEdits(state,[edit('accounts',null,{name:'Spaarrekening',type:'spaarrekening'})]);const a=r.changes[0].after;
 assert.equal(a.source,'manual');assert.equal(a.startBalance,undefined);assert.equal(a.bankProvider,undefined);assert.equal(a.active,true);assert.equal(JSON.stringify(state),before);assert.equal(r.state['moneylith.business.accounts'],state['moneylith.business.accounts']);
});
test('payment arrangement updates aliases and payment date without reducing debt principal',()=>{
 const r=applyEdits(state,[edit('debts','debt',{minBetaling:50,firstPaymentDate:'2026-11-05',remainingPayments:20})]);
 assert.equal(r.changes[0].after.minimaleMaandlast,50);assert.equal(r.changes[0].after.afschrijfDag,5);assert.equal(r.changes[0].after.saldo,1000);
});
test('reject arbitrary storage, bank balances, IDs, invalid money and impossible dates atomically',()=>{
 for(const action of [edit('business.accounts',null,{name:'x'}),edit('accounts','bank',{bankBalance:0}),edit('accounts','bank',{startBalance:0}),edit('debts','debt',{id:'replacement'}),edit('debts','debt',{minBetaling:-1}),edit('debts','debt',{firstPaymentDate:'2026-02-30'}),edit('debts','missing',{minBetaling:1})])assert.throws(()=>applyEdits(state,[edit('accounts',null,{name:'New',type:'contant'}),action]));
 assert.equal(JSON.parse(state['moneylith.personal.accounts']).length,1);
});
test('reject duplicate account name and missing goal fields',()=>{assert.throws(()=>applyEdits(state,[edit('accounts',null,{name:'ing',type:'betaalrekening'})]));assert.throws(()=>applyEdits(state,[edit('goals',null,{label:'Buffer'})]));});
test('monthly subscription patches preserve other months and mark explicit zero as entered',()=>{
 const s={...state,'moneylith.personal.fixedCosts':JSON.stringify([{id:'tool',naam:'Tool',bedrag:30,dagVanMaand:5,monthlyVariable:true,monthlyAmounts:{'2026-10':30},bankObservedOnly:true}])};
 const r=applyEdits(s,[edit('fixedCosts','tool',{monthlyAmounts:{'2026-11':0}})]);assert.deepEqual(r.changes[0].after.monthlyAmounts,{'2026-10':30,'2026-11':0});assert.equal(r.changes[0].after.bankObservedOnly,false);
});
test('undo restores original data and rejects a concurrent bank or user change',()=>{
 const r=applyEdits(state,[edit('debts','debt',{minBetaling:50})]);const receipt:Receipt={id:'test',questionHash:'hash',at:'2026-10-29',summary:r.summary,changes:r.changes,extras:r.extras};
 const next={...r.state,[journalKey]:JSON.stringify([receipt])};assert.equal(undoReceipt(next,'test')['moneylith.personal.debts'],state['moneylith.personal.debts']);
 const conflict={...next,'moneylith.personal.debts':JSON.stringify([{...r.changes[0].after,saldo:900}])};assert.throws(()=>undoReceipt(conflict,'test'));
});
test('categorisation updates existing classification decisions and is fully reversible',()=>{
 const s={...state,'moneylith.personal.transactions':JSON.stringify([{id:'tx',accountId:'bank',provider:'bunq',currency:'EUR',date:'2026-10-29',amount:-20,description:'Winkel',bankPatternKind:'variable'}])};
 const r=applyEdits(s,[edit('transactions','tx',{category:'Kleding en schoenen',notes:'Winterjas'})]);assert.equal(r.changes[0].after.amount,-20);assert.equal(JSON.parse(r.state['moneylith.personal.bankPatterns.v1'])['transaction:tx'].label,'Kleding en schoenen');
 const receipt:Receipt={id:'category',questionHash:'hash',at:'2026-10-29',summary:r.summary,changes:r.changes,extras:r.extras};const restored=undoReceipt({...r.state,[journalKey]:JSON.stringify([receipt])},'category');assert.equal(restored['moneylith.personal.transactions'],s['moneylith.personal.transactions']);assert.equal(restored['moneylith.personal.bankPatterns.v1'],undefined);
});
test('read tools paginate only personal data and business-designated accounts are inaccessible',()=>{
 const s={...state,'moneylith.personal.bankRules.v1':JSON.stringify({accountRoles:{bank:'business'}})};
 assert.equal(JSON.parse(personalAgentState(s)['moneylith.personal.accounts']).length,0);assert.equal(readRecords(s,{collection:'accounts',limit:1}).total,0);
 assert.throws(()=>readRecords(s,{collection:'../business.accounts'}));assert.throws(()=>readRecords(s,{collection:'agentActions.v1'}));assert.throws(()=>applyEdits(s,[edit('accounts','bank',{name:'Private'})]));
});

test('partial edits preserve incomplete historical records without inventing missing values',()=>{
 const s={...state,'moneylith.personal.income':JSON.stringify([{id:'income',naam:'Salaris',bedrag:2000}])};
 const r=applyEdits(s,[edit('income','income',{opmerking:'Netto ontvangen'})]);
 assert.equal(r.changes[0].after.dagVanMaand,undefined);
 assert.equal(r.changes[0].after.bedrag,2000);
 assert.throws(()=>applyEdits(s,[edit('income',null,{naam:'Nieuw',bedrag:100})]));
});
