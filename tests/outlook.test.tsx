import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {outlook} from '../src/projection/outlook';
import {emptyOptions,type Input} from '../src/projection/engine';
import {ProjectionView} from '../src/components/ProjectionView';
const input=():Input=>({scope:'personal',asOf:'2026-10-22',opening:100000,reserve:10000,debts:{},missing:[],assumptions:[],goals:[],events:[{id:'salary',label:'Salaris',date:'2026-10-23',amount:200000,source:'income',basis:'assumption'}]});
test('three outcomes reuse cent-based forecast with dated one-off changes at 7/30/90 days',()=>{
 const data=input(),before=JSON.stringify(data);
 const r=outlook(data,{amount:20000,date:'2026-11-01',monthly:false},{amount:50000,date:'2026-10-25',monthly:false});
 assert.deepEqual(r.current.horizons.slice(0,3).map(h=>h.available),[290000,290000,290000]);
 assert.deepEqual(r.best!.horizons.slice(0,3).map(h=>h.available),[290000,310000,310000]);
 assert.deepEqual(r.worst!.horizons.slice(0,3).map(h=>h.available),[240000,240000,240000]);
 assert.equal(r.current.timeline.length,365);assert.equal(JSON.stringify(data),before);
});
test('recurring assumptions, explicit zero, blank reset and scope isolation',()=>{
 const r=outlook(input(),{amount:20000,date:'2026-10-23',monthly:true},{amount:0,date:'2026-10-23',monthly:false});
 assert.equal(r.best!.horizons[2].available,350000);
 assert.equal(r.worst!.horizons[2].available,r.current.horizons[2].available);
 assert.equal(outlook(input(),null,null).best,null);assert.equal(outlook(input(),null,null).worst,null);
 const business={...input(),scope:'business-real' as const,opening:50000,events:[]};
 assert.equal(outlook(business,null,null).current.horizons[0].available,40000);
});
test('unknown baseline stays unknown in best and worst cases; date/amount validation',()=>{
 const r=outlook({...input(),opening:null},{amount:90000,date:'2026-10-23',monthly:false},{amount:100,date:'2026-10-23',monthly:false});
 assert.equal(r.best!.horizons[1].available,null);assert.equal(r.worst!.horizons[1].available,null);
 for(const a of [{amount:-1,date:'2026-10-23',monthly:false},{amount:10,date:'2026-10-22',monthly:false},{amount:1.5,date:'2026-10-23',monthly:false}])assert.throws(()=>outlook(input(),a,null));
});
test('existing custom scenario stays the shared base and source facts never change',()=>{
 const r=outlook(input(),{amount:20000,date:'2026-10-23',monthly:false},{amount:50000,date:'2026-10-23',monthly:false},{kind:'purchase',amount:10000,date:'2026-10-24'});
 assert.equal(r.current.horizons[0].available,280000);assert.equal(r.best!.horizons[0].available,300000);assert.equal(r.worst!.horizons[0].available,230000);
});
test('overview leads with the baseline; scenario controls and details are on demand',()=>{
 const html=renderToStaticMarkup(<ProjectionView input={input()} options={emptyOptions()} onOptions={()=>{}} scenario={null} onScenario={()=>{}}/>);
 assert.match(html,/data-outlook/);assert.match(html,/Best case/);assert.match(html,/Worst case/);assert.doesNotMatch(html,/Stel hieronder in/);assert.match(html,/Scenario’s en extra inkomsten onderzoeken/);assert.match(html,/<svg/);assert.match(html,/<details[^>]*><summary[^>]*>Basis aanvullen/);
 const unknown=renderToStaticMarkup(<ProjectionView input={{...input(),opening:null}} options={emptyOptions()} onOptions={()=>{}} scenario={null} onScenario={()=>{}}/>);
 assert.match(unknown,/Je vooruitblik heeft nog een basis nodig/);assert.doesNotMatch(unknown,/<svg/);
});
test('requested fictional contingency is 150 monthly, separate from real records',()=>{
 const data=input(),copy=JSON.stringify(data);
 const r=outlook(data,null,{amount:15000,date:'2026-10-29',monthly:true});
 assert.equal(r.current.horizons[2].available!-r.worst!.horizons[2].available!,45000);assert.equal(JSON.stringify(data),copy);
 const html=renderToStaticMarkup(<ProjectionView input={data} options={emptyOptions()} onOptions={()=>{}} scenario={null} onScenario={()=>{}}/>);
 assert.match(html,/fictief budget van €150 per maand/);assert.match(html,/value="150"/);
});
test('income coach encourages website/app work without importing financial or foreign data',async()=>{
 const {buildChatRequest}=await import('../src/ai/context');
 for(const scope of ['personal','business-real']){
  const r=buildChatRequest({scope,purpose:'income-ideas',context:{month:'2026-10',private:'DO_NOT_FORWARD',business:{secret:'DO_NOT_FORWARD'}}});
  assert.equal(r.scope,scope);assert.equal(r.qualitativeOnly,true);assert.match(r.messages[0].content,/websites en apps/);assert.match(r.messages[0].content,/gegarandeerde inkomsten/);assert.ok(!JSON.stringify(r.messages).includes('DO_NOT_FORWARD'));
 }
 assert.throws(()=>buildChatRequest({scope:'business-demo',purpose:'income-ideas',context:{month:'2026-10'}}));
});
