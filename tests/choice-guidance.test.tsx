import test from 'node:test';
import assert from 'node:assert/strict';
import {choiceAssessment,choiceProfile,choiceLimitsKey,validateChoiceLimits} from '../src/bank/choiceGuidance';
import {buildSpendingCoach} from '../src/ai/spendingCoach';
import {evaluateMonitoring,emptyMonitoring,reconcileNotices} from '../src/monitoring/engine';
import {cloudKey} from '../src/storage/cloudState';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ChoiceGuidance} from '../src/components/ChoiceGuidance';
const pot={label:'Gezondheid en welzijn',cents:6000,count:2,share:1,previousCents:null};
test('wellbeing intention never overrides a financial limit; missing differs from zero',()=>{
 assert.equal(choiceAssessment(pot,{}).status,'unknown');
 assert.equal(choiceAssessment(pot,{[pot.label]:0}).status,'over');
 assert.equal(choiceAssessment(pot,{[pot.label]:5000}).remaining,0);
 assert.equal(choiceAssessment(pot,{[pot.label]:7000}).status,'near');
 assert.equal(choiceAssessment(pot,{[pot.label]:10000}).status,'within');
 assert.match(choiceProfile(pot.label).tip,/noodzakelijke zorg niet uit/);
 assert.match(choiceProfile('Coffeeshop').tip,/moment minder/);
 assert.match(choiceProfile('Koffie, snacks en rookwaar').tip,/geen onderscheid/);
});
test('choice limits are validated, isolated and not used as actual expenses',()=>{
 assert.ok(validateChoiceLimits({[pot.label]:0}));
 for(const value of [null,[],{[pot.label]:-1},{[pot.label]:1.5},{[pot.label]:null},{Tanken:1000},{Boodschappen:0}])assert.equal(validateChoiceLimits(value),false);
 assert.ok(cloudKey(choiceLimitsKey));assert.equal(cloudKey('moneylith.business.demo.spendingLimits'),false);
 const before=JSON.stringify(pot);choiceAssessment(pot,{[pot.label]:1000});assert.equal(JSON.stringify(pot),before);
});
test('AI calculates its own comparison and receives mixed-category and affordability safeguards',()=>{
 const body={scope:'personal',purpose:'spending-coach',context:{month:'2026-10',limits:{[pot.label]:5000},status:'within',rows:[{id:'x',date:'2026-10-01',label:pot.label,cents:6000}]}};
 const reply=buildSpendingCoach(body);const data=JSON.parse(reply.messages[1].content);
 assert.equal(data.pots[0].choice.status,'over');assert.equal(data.pots[0].choice.remaining,0);
 assert.match(reply.messages[0].content,/overschreden grens voor/);assert.match(reply.messages[0].content,/noodzakelijke zorg/);
 assert.throws(()=>buildSpendingCoach({...body,context:{...body.context,limits:{[pot.label]:-1}}}));
 assert.throws(()=>buildSpendingCoach({...body,scope:'business-real'}));
});
test('sauna spending triggers deduplicated limit alerts in scheduled monitoring; reset removes alert',()=>{
 const now=new Date('2026-10-24T12:00:00Z');
 const state={
 'moneylith.personal.accounts':JSON.stringify([{id:'p',active:true,bankProvider:'lunchflow',bankLastSync:now.toISOString()}]),
 'moneylith.personal.transactions':JSON.stringify([{id:'t',accountId:'p',date:'2026-10-24',amount:-60,currency:'EUR',provider:'lunchflow',category:pot.label,bankPatternKind:'variable'}]),
 [choiceLimitsKey]:JSON.stringify({[pot.label]:5000}),
 };
 const before=JSON.stringify(state);const prefs=emptyMonitoring().preferences;
 const first=evaluateMonitoring(state,prefs,now);assert.equal(first.signals.length,1);assert.match(first.signals[0].title,/boven je keuzegrens/);assert.equal(first.signals[0].referenceCents,5000);
 const near=evaluateMonitoring({...state,[choiceLimitsKey]:JSON.stringify({[pot.label]:7000})},prefs,now);
 assert.notEqual(near.signals[0].id,first.signals[0].id);
 const escalated=reconcileNotices(reconcileNotices([],near.signals,now.toISOString()),first.signals,now.toISOString());
 assert.equal(escalated.filter(n=>n.active).length,1);assert.equal(escalated.find(n=>n.active)?.readAt,null);
 const notices=reconcileNotices([],first.signals,now.toISOString());assert.equal(reconcileNotices(notices,first.signals,now.toISOString()).length,1);
 assert.equal(evaluateMonitoring(state,{...prefs,enabled:false},now).signals.length,0);
 assert.equal(evaluateMonitoring(state,{...prefs,mutedLabels:[pot.label]},now).signals.length,0);
 assert.equal(JSON.stringify(state),before);
 assert.equal(evaluateMonitoring({...state,[choiceLimitsKey]:'{}'},prefs,now).signals.length,0);
 assert.equal(evaluateMonitoring({...state,'moneylith.personal.bankRules.v1':'{"rules":[],"accountRoles":{"p":"business"}}'},prefs,now).signals.length,0);
});
test('visible guidance separates intention, affordability, historical periods and unknown limits',()=>{
 const html=(room:number|null,current=true,limits={})=>renderToStaticMarkup(React.createElement(ChoiceGuidance,{pot,limits,onSave:()=>{},room,current}));
 assert.match(html(null),/Betaalbaarheid is nog onbekend/);
 assert.match(html(-1),/geen ruimte voor extra uitgaven/);
 assert.match(html(50000),/geen vrij besteedbaar saldo/);
 assert.match(html(50000,true,{[pot.label]:5000}),/boven je maandgrens/);
 assert.match(html(50000,false),/terugblik/);
});
test('AI prioritizes an exceeded wellbeing limit over a larger discretionary pot',()=>{
 const body={scope:'personal',purpose:'spending-coach',context:{month:'2026-10',limits:{'Gezondheid en welzijn':1000},rows:[{id:'big',date:'2026-10-01',label:'Spullen en huishouden',cents:50000},{id:'small',date:'2026-10-01',label:'Gezondheid en welzijn',cents:2000}]}};
 const reply=buildSpendingCoach(body);const data=JSON.parse(reply.messages[1].content);
 assert.equal(data.pots[0].label,'Gezondheid en welzijn');assert.equal(data.pots[0].choice.status,'over');
});
