import test from 'node:test';
import assert from 'node:assert/strict';
import {returnedPayments} from '../src/bank/returnedPayments';
import {emptyBankRules} from '../src/bank/classificationRules';
import {personalInput} from '../src/projection/adapters';
import {emptyOptions} from '../src/projection/engine';
import type {MoneylithTransaction} from '../src/types';
const debit={id:'d',accountId:'a',provider:'bunq',currency:'EUR',amount:-60,date:'2026-09-25',description:'Incasso factuur INV12345',counterparty:'Testbedrijf',bankPatternKind:'fixed',bankRuleLabel:'Abonnement'} as MoneylithTransaction;
const credit={...debit,id:'c',amount:60,date:'2026-09-27',description:'Storno incasso factuur INV12345'};
const asOf='2026-10-29';
test('explicit reversal stays outstanding across periods without modifying bank data',()=>{
 const txs=[debit,credit];const before=JSON.stringify(txs);
 const rows=returnedPayments(txs,emptyBankRules,asOf);
 assert.equal(rows[0].status,'pending');assert.equal(rows[0].cents,6000);
 assert.equal(JSON.stringify(txs),before);
 const p=personalInput({transactions:txs},emptyOptions(),asOf);
 assert.equal(p.events.find(e=>e.source==='returned-payment')?.amount,-6000);
 assert.match(p.commitments?.find(c=>c.remaining===6000)?.note??'',/geen aangekondigde/);
 assert.deepEqual(returnedPayments([...txs,...txs],emptyBankRules,asOf),rows);
});
test('retail refund never creates a new bill',()=>{
 assert.deepEqual(returnedPayments([debit,{...credit,description:'Refund retour aankoop'}],emptyBankRules,asOf),[]);
});
test('multiple possible original payments require review, not automatic obligations',()=>{
 const txs=[debit,{...debit,id:'other',date:'2026-09-24'},credit];
 assert.equal(returnedPayments(txs,emptyBankRules,asOf)[0].status,'review');
 assert.equal(personalInput({transactions:txs},emptyOptions(),asOf).events.filter(e=>e.source==='returned-payment').length,0);
});
test('unique re-payment with same invoice closes obligation; another invoice does not',()=>{
 const retry={...debit,id:'retry',date:'2026-10-01'};
 assert.equal(returnedPayments([debit,credit,retry],emptyBankRules,asOf)[0].status,'repaid');
 assert.equal(returnedPayments([debit,credit,{...retry,description:'Incasso factuur INV99999'}],emptyBankRules,asOf)[0].status,'pending');
});
test('reversed replacement does not close original obligation',()=>{
 const retry={...debit,id:'retry',date:'2026-10-01'};
 const bounced={...credit,id:'again',date:'2026-10-02'};
 assert.notEqual(returnedPayments([debit,credit,retry,bounced],emptyBankRules,asOf)[0].status,'repaid');
});
test('business and future transactions cannot affect personal obligations',()=>{
 assert.deepEqual(returnedPayments([debit,credit],{...emptyBankRules,accountRoles:{a:'business'}},asOf),[]);
 assert.deepEqual(returnedPayments([debit,credit],emptyBankRules,'2026-09-26'),[]);
});
test('known current fixed cost is reopened once, not a duplicate new bill',()=>{
 const txs=[{...debit,date:'2026-10-24'},{...credit,date:'2026-10-25'}];
 const p=personalInput({transactions:txs,fixedCosts:[{id:'sub',naam:'Abonnement',bedrag:60,amountEntered:true,dagVanMaand:24}]},emptyOptions(),asOf);
 const events=p.events.filter(e=>e.date&&e.date<'2026-11-23'&&e.amount===-6000);
 assert.equal(events.length,1);assert.match(events[0].label,/opnieuw te betalen/);
});
