import test from 'node:test';
import assert from 'node:assert/strict';
import {costForMonth,setCostMonth,currentCostMonth} from '../src/logic/monthlyCosts';
import {manualReviewRows,recordReview,reviewSection} from '../src/logic/inputReadiness';
import {personalInput} from '../src/projection/adapters';
import {emptyOptions} from '../src/projection/engine';
import type {FixedCostManualItem} from '../src/types';
const item:FixedCostManualItem={id:'card',naam:'Telefoon via bunq',paymentRoute:'card',bedrag:14,amountEntered:true,dagVanMaand:27,monthlyAmounts:{'2026-10':14,'2026-11':42.35,'2026-12':0}};
test('bunq monthly costs preserve each month, unknown and explicit zero without mutating records',()=>{
 const before=JSON.stringify(item);assert.equal(costForMonth(item,'2026-10').bedrag,14);assert.equal(costForMonth(item,'2026-11').bedrag,42.35);
 assert.equal(costForMonth(item,'2026-12').amountEntered,true);assert.equal(costForMonth(item,'2027-01').amountEntered,false);
 const updated=setCostMonth(item,'2026-11',65.5);assert.equal(updated.monthlyAmounts?.['2026-10'],14);assert.equal(updated.monthlyAmounts?.['2026-12'],0);
 assert.equal(costForMonth(setCostMonth(item,'2026-10',null),'2026-10').amountEntered,false);
 assert.equal(JSON.stringify(item),before);assert.equal(costForMonth({...item,monthlyVariable:false},'2026-11').bedrag,14);assert.deepEqual(costForMonth({...item,monthlyVariable:false}).monthlyAmounts,item.monthlyAmounts);
 assert.throws(()=>setCostMonth(item,'2026-13',1));assert.throws(()=>setCostMonth(item,'2026-11',-1));
 assert.equal(costForMonth({...item,monthlyAmounts:undefined},'2027-01').bedrag,14);
});
test('foundation review uses the requested month and invalidates a missing next month',()=>{
 const oct=manualReviewRows([item],'2026-10'),nov=manualReviewRows([item],'2026-11');
 assert.equal(oct[0].amount,14);assert.equal(nov[0].amount,42.35);
 assert.equal(reviewSection('fixed','Vaste lasten',manualReviewRows([item],'2027-01'),{}).valid,false);
 assert.equal(reviewSection('fixed','Vaste lasten',manualReviewRows([item],'2026-12'),{}).valid,true);
 const current=setCostMonth(item,currentCostMonth(),21);const receipt=recordReview(current).signature;
 assert.ok(recordReview({...current,reviewedInput:receipt}).ready);
 assert.equal(recordReview({...setCostMonth(current,currentCostMonth(),22),reviewedInput:receipt}).ready,false);
});
test('projection schedules varying card charges once on the corresponding dates, with missing months unknown',()=>{
 const p=personalInput({fixedCosts:[item],transactions:[{id:'topup',amount:-100,bankPatternKind:'transfer'}]}, {...emptyOptions(),monthlyDay:27},'2026-10-24');
 const events=p.events.filter(e=>e.id.startsWith('fixed:card:'));
 assert.equal(events.find(e=>e.date==='2026-10-27')?.amount,-1400);
 assert.equal(events.find(e=>e.date==='2026-11-27')?.amount,-4235);
 assert.equal(events.find(e=>e.date==='2026-12-27')?.amount,0);
 assert.equal(events.find(e=>e.date==='2027-01-27')?.amount,null);
 assert.equal(events.filter(e=>e.date==='2026-11-27').length,1);assert.ok(events.every(e=>e.basis==='input'));
});
