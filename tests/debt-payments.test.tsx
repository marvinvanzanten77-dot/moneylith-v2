import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileDebtPayments,emptyDebtLedger,applyConfirmedDebtPayment,debtLedgerKey,type DebtPayment} from '../src/bank/debtPayments';
import {processBankSync} from '../src/bank/processSync';
import {persistLunchflow} from '../src/bank/lunchflowMerge';
import type {SchuldItem,MoneylithTransaction} from '../src/types';
const debts:SchuldItem[]=[1,2].map((n)=>({id:'d'+n,naam:'Lening '+n,openBedrag:n*100,saldo:n*100,minBetaling:100,minimaleMaandlast:100,remainingPayments:n,firstPaymentDate:'2026-11-23',afschrijfDag:23,bankRepayment:{enabled:true,counterparty:'Testouder',reference:'Aflossing lening '+n,fromDate:'2026-10-24',accountId:'personal'}}));
const tx:MoneylithTransaction={id:'bank:tx',accountId:'personal',provider:'lunchflow',currency:'EUR',date:'2026-11-24',amount:-400,counterparty:'Testouder',description:'Aflossing lening 1; Aflossing lening 2; overig geleend geld',bankPatternKind:'financing'};
test('mixed booked payment reduces only linked principal, advances schedules, closes completed debt and never changes cash',()=>{
 const before=JSON.stringify({debts,tx});const r=reconcileDebtPayments(debts,[tx],emptyDebtLedger(),'2026-11-25');
 assert.equal(r.applied,2);assert.equal(r.appliedCents,20000);assert.equal(r.debts[0].saldo,0);assert.equal(r.debts[0].minimaleMaandlast,0);assert.equal(r.debts[0].remainingPayments,undefined);assert.equal(r.debts[1].saldo,100);assert.equal(r.debts[1].remainingPayments,1);assert.equal(r.debts[1].firstPaymentDate,'2026-12-23');
 assert.equal(r.ledger.entries[0].paidCents,40000);assert.equal(r.ledger.entries[0].allocations.reduce((n,a)=>n+a.cents,0),20000);assert.equal(JSON.stringify({debts,tx}),before);
 const repeat=reconcileDebtPayments(r.debts,[tx,tx],r.ledger,'2026-11-25');assert.equal(repeat.applied,0);assert.deepEqual(repeat.debts,r.debts);assert.deepEqual(repeat.ledger,r.ledger);
 const final=reconcileDebtPayments(r.debts,[{...tx,id:'dec',date:'2026-12-23',amount:-100,description:'Aflossing lening 2'}],r.ledger,'2026-12-24');assert.equal(final.debts[1].saldo,0);
});
test('no booking, unknown description, partial payment and duplicate references never silently reduce principal',()=>{
 assert.equal(reconcileDebtPayments(debts,[],emptyDebtLedger(),'2026-11-25').applied,0);
 for(const t of [{...tx,description:'Geld terug'},{...tx,amount:-150},{...tx,date:'2026-12-01'},{...tx,description:'Aflossing lening 12'}]){const r=reconcileDebtPayments(debts,[t],emptyDebtLedger(),'2026-12-02');assert.equal(r.applied,0);assert.ok(r.questions.length);assert.deepEqual(r.debts,debts);}
 const duplicate=debts.map(d=>({...d,bankRepayment:{...d.bankRepayment!,reference:'Aflossing lening 1'}}));assert.equal(reconcileDebtPayments(duplicate,[tx],emptyDebtLedger(),'2026-11-25').applied,0);
});
test('personal isolation, source identity, exact counterparty, currency, incoming and fixed charges are respected',()=>{
 for(const patch of [{amount:400},{currency:'USD'},{provider:undefined},{counterparty:'Andere Testouder'},{accountId:'business'},{bankPatternKind:'fixed'},{bankPatternKind:'transfer'},{date:'2026-11-31'},{date:'2026-12-24'}])assert.equal(reconcileDebtPayments(debts,[{...tx,...patch} as MoneylithTransaction],emptyDebtLedger(),'2026-11-25').applied,0);
 assert.equal(reconcileDebtPayments(debts,[tx],emptyDebtLedger(),'2026-11-25',['personal']).applied,0);
 assert.equal(reconcileDebtPayments(debts.map(d=>({...d,bankRepayment:{...d.bankRepayment!,enabled:false}})),[tx],emptyDebtLedger(),'2026-11-25').applied,0);
 const raw={...tx,description:'handmatig aangepast',amount:-1,providerData:{description:tx.description,amount:tx.amount,date:tx.date,counterparty:tx.counterparty}};assert.equal(reconcileDebtPayments(debts,[raw],emptyDebtLedger(),'2026-11-25').applied,2);
});
test('confirmed historic allocations prevent replay and changed source evidence requires review',()=>{
 const payment:DebtPayment={transactionId:tx.id,accountId:tx.accountId,date:tx.date,paidCents:40000,allocations:[{debtId:'d1',cents:10000},{debtId:'d2',cents:10000}],source:'confirmed'};
 const next=applyConfirmedDebtPayment(debts,payment),ledger={version:1 as const,entries:[payment]};
 const repeat=reconcileDebtPayments(next,[tx],ledger,'2026-11-25');assert.equal(repeat.applied,0);
 const changed=reconcileDebtPayments(next,[{...tx,amount:-300}],ledger,'2026-11-25');assert.equal(changed.applied,0);assert.equal(changed.questions.length,1);assert.deepEqual(changed.debts,next);
 assert.throws(()=>applyConfirmedDebtPayment(debts,{...payment,allocations:[{debtId:'d1',cents:50000}]}));
 assert.throws(()=>reconcileDebtPayments(debts,[tx],{version:1,entries:[payment,payment]},'2026-11-25'));
});
test('both sync paths persist debt balance and ledger together; failed import and repeated successful scan preserve data',()=>{
 const account={id:'personal',name:'Test',type:'betaalrekening' as const,active:true,bankProvider:'lunchflow' as const,bankAccountId:'p',currency:'EUR',bankBalance:500};
 const state={'moneylith.personal.accounts':JSON.stringify([account]),'moneylith.personal.transactions':'[]','moneylith.personal.debts':JSON.stringify(debts),'moneylith.business.debts':'[{"id":"untouched"}]'};
 const snapshot={account:{id:'p',label:'Test',institution:'ING',status:'ACTIVE',upstream:'test',currency:'EUR'},balance:{ok:true as const,value:{amount:500,currency:'EUR'}},transactions:{ok:true as const,value:[{id:'t',accountId:'p',amount:-400,currency:'EUR',date:tx.date,description:tx.description,merchant:tx.counterparty!}]},fetchedAt:'2026-11-25T12:00:00Z'};
 const r=processBankSync(state,[snapshot],[{providerId:'p',targetId:'personal'}],'2026-11-25');assert.equal(r.debtPayments?.applied,2);assert.equal(JSON.parse(r.state['moneylith.personal.accounts'])[0].bankBalance,500);assert.equal(r.state['moneylith.business.debts'],state['moneylith.business.debts']);
 const twice=processBankSync(r.state,[snapshot],[{providerId:'p',targetId:'personal'}],'2026-11-25');assert.equal(twice.debtPayments?.applied,0);assert.equal(twice.state[debtLedgerKey],r.state[debtLedgerKey]);
 const failed=processBankSync(state,[{...snapshot,balance:{ok:false as const,error:{code:'network' as const,message:'offline'}}}],[{providerId:'p',targetId:'personal'}],'2026-11-25');assert.equal(failed.state['moneylith.personal.debts'],state['moneylith.personal.debts']);
 const store=new Map(Object.entries(state));let fail=true;const storage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{if(k===debtLedgerKey&&fail){fail=false;throw Error('quota');}store.set(k,v);},removeItem:(k:string)=>{store.delete(k);}};
 assert.throws(()=>persistLunchflow(storage,r.result,r.financial,r.debtPayments));assert.equal(store.get('moneylith.personal.debts'),state['moneylith.personal.debts']);assert.equal(store.has(debtLedgerKey),false);
 persistLunchflow(storage,r.result,r.financial,r.debtPayments);assert.equal(store.get('moneylith.personal.debts'),r.state['moneylith.personal.debts']);assert.equal(store.get(debtLedgerKey),r.state[debtLedgerKey]);
});
