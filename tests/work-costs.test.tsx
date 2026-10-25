import test from 'node:test';
import assert from 'node:assert/strict';
import {addWorkCost} from '../src/logic/workCosts';
import {costForMonth,costPlannedInMonth,setCostMonth} from '../src/logic/monthlyCosts';
import {makePeriodPlan,refreshWorkCostPlan} from '../src/bank/periodReconciliation';
test('work subscriptions share fixed records, preserve independent monthly amounts and avoid Grok duplicates',()=>{
 const original=addWorkCost([],'Grok','2026-10','grok').items;
 assert.equal(costForMonth(original[0],'2026-10').amountEntered,false);
 const updated=setCostMonth(original[0],'2026-10',24.95);
 const next=setCostMonth(updated,'2026-11',0);
 assert.equal(costForMonth(next,'2026-10').bedrag,24.95);
 assert.equal(costForMonth(next,'2026-11').amountEntered,true);
 assert.equal(costForMonth(next,'2026-11').bedrag,0);
 assert.equal(costForMonth(next,'2026-12').amountEntered,false);
 const result=addWorkCost([next],'Grok / grok.ai','2026-11','duplicate');
 assert.equal(result.items.length,1);assert.equal(result.id,'grok');
 assert.deepEqual(result.items[0].monthlyAmounts,next.monthlyAmounts);
 assert.equal(original[0].monthlyAmounts?.['2026-10'],null);
});
test('one-off credits only create obligations in explicitly selected months',()=>{
 const item=setCostMonth(addWorkCost([],'TikTok Promo','2026-10','credits','credits').items[0],'2026-10',15);
 assert.equal(costPlannedInMonth(item,'2026-10'),true);
 assert.equal(costPlannedInMonth(item,'2026-11'),false);
 assert.equal(makePeriodPlan([],[item],[],[],'2026-10-25').rows[0].expected,1500);
 assert.equal(makePeriodPlan([],[item],[],[],'2026-11-25').rows.length,0);
});
test('open period work estimates follow edits without mutating captured history or other costs',()=>{
 const original={capturedAt:'2026-10-23',rows:[{id:'fixed:rent',label:'Huur',kind:'fixed' as const,expected:50000}]};
 const item=addWorkCost([],'ChatGPT','2026-10','chat').items[0];
 const first=refreshWorkCostPlan(original,makePeriodPlan([],[item],[],[],'2026-10-25'));
 assert.equal(first.rows.length,2);assert.equal(first.rows[1].expected,null);
 const updated=refreshWorkCostPlan(first,makePeriodPlan([],[setCostMonth(item,'2026-10',23)],[],[],'2026-10-25'));
 assert.equal(updated.rows[1].expected,2300);assert.equal(updated.rows[0].expected,50000);
 assert.equal(first.rows[1].expected,null);assert.equal(original.rows.length,1);
 assert.equal(refreshWorkCostPlan(updated,makePeriodPlan([],[setCostMonth(item,'2026-10',23)],[],[],'2026-10-25')),updated);
 assert.equal(refreshWorkCostPlan(updated,{capturedAt:'2026-10-25',rows:[]}).rows.length,1);
});
test('forecast includes credits once and leaves subscription prices unknown in unfilled months',async()=>{
 const {personalInput}=await import('../src/projection/adapters');
 const {emptyOptions}=await import('../src/projection/engine');
 const credit={...setCostMonth(addWorkCost([],'Promo','2026-10','promo','credits').items[0],'2026-10',15),dagVanMaand:28,paymentRoute:'bank' as const};
 const subscription={...setCostMonth(addWorkCost([],'ChatGPT','2026-10','chat').items[0],'2026-10',23),dagVanMaand:28,paymentRoute:'bank' as const};
 const snapshot={fixedCosts:[credit,subscription]};const before=JSON.stringify(snapshot);
 const result=personalInput(snapshot,emptyOptions(),'2026-10-25');
 assert.equal(result.commitments?.find(r=>r.label==='Promo')?.remaining,1500);
 assert.ok(!result.events.some(e=>e.label==='Promo'&&e.date&&e.date>='2026-11-01'));
 assert.ok(result.events.some(e=>e.label==='ChatGPT'&&e.date==='2026-11-28'&&e.amount===null));
 assert.equal(JSON.stringify(snapshot),before);
});
