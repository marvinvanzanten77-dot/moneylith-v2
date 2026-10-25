import test from 'node:test';
import assert from 'node:assert/strict';
import {simulatePayoff} from '../src/logic/debtSimulator';
const debts=[{id:'a',naam:'Lening 1',saldo:100,minimaleMaandlast:100},{id:'b',naam:'Lening 2',saldo:200,minimaleMaandlast:100},{id:'c',naam:'Geen regeling',saldo:500,minimaleMaandlast:0}];
test('available money never automatically increases agreed repayments or rolls released payments into another debt',()=>{
 const before=JSON.stringify(debts);
 for(const strategy of ['balanced','snowball','avalanche','fullpay'] as const){
  const result=simulatePayoff(debts,2000,strategy);
  assert.equal(result.monthlyPressureNow,200);
  assert.deepEqual(result.pressureByMonth,[200,100]);
  assert.equal(result.totalDebtRemaining,500);
  assert.equal(result.monthsToZero,null);
 }
 assert.equal(JSON.stringify(debts),before);
});
test('extra repayment requires explicit opt-in; changing the actual agreed amount remains effective',()=>{
 assert.equal(simulatePayoff(debts,300,'balanced',{allowExtraPayments:true}).monthlyPressureNow,300);
 assert.equal(simulatePayoff(debts.map(d=>d.id==='b'?{...d,minimaleMaandlast:200}:d),300,'balanced').monthlyPressureNow,300);
 assert.equal(simulatePayoff([{id:'c',naam:'Geen regeling',saldo:500,minimaleMaandlast:0}],500,'balanced').monthlyPressureNow,0);
});
