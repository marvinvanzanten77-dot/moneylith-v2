import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateMonitoring,emptyMonitoring,reconcileNotices,updateMonitoring,amsterdamDate} from '../src/monitoring/engine';
import {monitoringAdvice,monitoringAdviceRequest} from '../server/monitoring/advice';
import {monitorAccount,getMonitoring} from '../server/monitoring/store';
import {encryptCloudPayload,setCloudSession} from '../server/utils/cloudAuth';
import handler from '../api/cloud';
import type {CloudState} from '../src/storage/cloudState';
import type {MoneylithTransaction} from '../src/types';
import type {VercelRequest,VercelResponse} from '@vercel/node';
const now=new Date('2026-10-22T12:00:00Z');
const tx=(id:string,amount=-40,category:string|null='Boodschappen',date='2026-10-10'):MoneylithTransaction=>({id,date,amount,category,accountId:'private',description:'SECRET DESCRIPTION',provider:'lunchflow',currency:'EUR',bankPatternKind:'variable'});
function fixture(rows:MoneylithTransaction[]=[tx('one'),tx('two'),tx('three')]):CloudState{return {
 'moneylith.personal.transactions':JSON.stringify(rows),
 'moneylith.personal.accounts':JSON.stringify([{id:'private',active:true,bankProvider:'lunchflow',bankLastSync:now.toISOString()}]),
 'moneylith.personal.fixedCosts':JSON.stringify([{id:'budget',naam:'Boodschappen',bedrag:100,amountEntered:true,budgetCategory:'Boodschappen',budgetSince:'2026-09'}]),
 'moneylith.personal.bankRules.v1':JSON.stringify({rules:[],accountRoles:{private:'personal',business:'business'}}),
 'moneylith.business.real.v1':JSON.stringify({secret:'BUSINESS SECRET'}),
};}
const prefs=emptyMonitoring().preferences;
test('monitoring uses exact cents and existing budget, without changing actual data',()=>{
 const state=fixture(),before=JSON.stringify(state);const r=evaluateMonitoring(state,prefs,now);
 assert.equal(r.signals.length,1);assert.equal(r.signals[0].kind,'budget');assert.equal(r.signals[0].observedCents,12000);assert.equal(r.signals[0].referenceCents,10000);assert.match(r.signals[0].title,/boven/);assert.equal(JSON.stringify(state),before);
 assert.ok(!JSON.stringify(r).includes('SECRET'));
 const near=evaluateMonitoring(fixture([tx('a',-80)]),prefs,now);assert.match(near.signals[0].title,/in zicht/);
});
test('business, fixed costs, loans, topups, future transactions and duplicate ids are excluded',()=>{
 const rows=[tx('a',-10),tx('a',-10),{...tx('b'),accountId:'business'}, {...tx('c'),bankPatternKind:'fixed' as const},{...tx('d'),bankPatternKind:'transfer' as const},{...tx('e'),bankPatternKind:'financing' as const},tx('f',-100,'Boodschappen','2026-10-23')];
 assert.equal(evaluateMonitoring(fixture(rows),prefs,now).signals.length,0);
});
test('missing, ambiguous and unentered budgets do not become zero; explicit zero is a valid budget',()=>{
 const state=fixture([tx('a',-10)]);const base={id:'b',naam:'Food',budgetCategory:'Boodschappen',budgetSince:'2026-09'};
 for(const items of [[base],[{...base,bedrag:0,amountEntered:false}],[{...base,bedrag:0},{...base,id:'c',bedrag:0}]]){
 state['moneylith.personal.fixedCosts']=JSON.stringify(items);assert.equal(evaluateMonitoring(state,prefs,now).signals.length,0);}
 state['moneylith.personal.fixedCosts']=JSON.stringify([{...base,bedrag:0,amountEntered:true}]);assert.equal(evaluateMonitoring(state,prefs,now).signals[0].referenceCents,0);
});
test('stale or missing bank fetch timestamps and paused monitoring suppress new signals',()=>{
 assert.equal(evaluateMonitoring(fixture(),prefs,new Date('2026-10-26T12:00:00Z')).signals.length,0);
 const state=fixture();state['moneylith.personal.accounts']='[{"id":"private","bankProvider":"lunchflow"}]';
 assert.equal(evaluateMonitoring(state,prefs,now).signals.length,0);
 assert.equal(evaluateMonitoring(fixture(),{...prefs,enabled:false},now).signals.length,0);
 assert.equal(evaluateMonitoring(fixture(),{...prefs,mutedLabels:['Boodschappen']},now).signals.length,0);
});
test('pace compares matching elapsed dates with enough observations, never annualizes missing data',()=>{
 const rows=[1,2,3].flatMap(n=>[tx('c'+n,-30,'Koffie'),tx('p'+n,-10,'Koffie','2026-09-10')]);
 rows.push(tx('late',-1000,'Koffie','2026-09-22'));
 const r=evaluateMonitoring(fixture(rows),prefs,now);assert.equal(r.signals[0].kind,'pace');assert.equal(r.signals[0].referenceCents,3000);
 assert.equal(evaluateMonitoring(fixture(rows.filter(r=>r.id!=='p3')),prefs,now).signals.length,0);
 const positive=evaluateMonitoring(fixture([1,2,3].flatMap(n=>[tx('c'+n,-10,'Koffie'),tx('p'+n,-30,'Koffie','2026-09-10')])),prefs,now);
 assert.equal(positive.signals[0].kind,'progress');assert.match(positive.signals[0].message,/geen vastgestelde besparing/);
});
test('unknown purchases ask for classification rather than assigning a judgment',()=>{
 const r=evaluateMonitoring(fixture([1,2,3].map(n=>tx('u'+n,-10,null))),prefs,now);
 assert.equal(r.signals[0].kind,'classification');assert.equal(r.signals[0].observedCents,3000);
});
test('dedup, read, dismiss, reclassification, mute and month rollover retain history',()=>{
 const signals=evaluateMonitoring(fixture(),prefs,now).signals;
 const notices=reconcileNotices([],signals,now.toISOString());assert.deepEqual(reconcileNotices(notices,signals,now.toISOString()),notices);
 let state={...emptyMonitoring(),notices};state=updateMonitoring(state,{action:'read',id:signals[0].id},now.toISOString());state=updateMonitoring(state,{action:'dismiss',id:signals[0].id},now.toISOString());
 const repeated=reconcileNotices(state.notices,signals,now.toISOString());assert.ok(repeated[0].readAt);assert.ok(repeated[0].dismissedAt);assert.equal(repeated.length,1);
 assert.equal(reconcileNotices(repeated,[],now.toISOString())[0].active,false);
 assert.throws(()=>updateMonitoring(state,{action:'preferences',enabled:true,mutedLabels:[123]},now.toISOString()));
 assert.equal(amsterdamDate(new Date('2026-10-31T23:30:00Z')),'2026-11-01');
});
test('AI context contains only the trusted signal kind and label, no amounts or raw banking data',()=>{
 const notice=reconcileNotices([],evaluateMonitoring(fixture(),prefs,now).signals,now.toISOString())[0];const r=monitoringAdvice(notice);
 assert.equal(r.qualitativeOnly,true);assert.match(r.messages[0].content,/bemoedigende/);assert.ok(!r.messages[1].content.includes('12000'));assert.ok(!JSON.stringify(r).includes('SECRET'));
});

test('authenticated API and encrypted CAS storage preserve cross-device actions and financial snapshot',async()=>{
 const previous={...process.env},originalFetch=globalThis.fetch,owner='owner@example.test';
 Object.assign(process.env,{LUNCHFLOW_PRIVATE_ENABLED:'true',LUNCHFLOW_API_KEY:'fake-key',LUNCHFLOW_OWNER_EMAIL:owner,LUNCHFLOW_OWNER_CODE_HASH:'a'.repeat(64),LUNCHFLOW_SESSION_SECRET:'b'.repeat(64),CLOUD_AUTH_SECRET:'c'.repeat(64),CLOUD_ENCRYPTION_KEY:'d'.repeat(64),KV_REST_API_URL:'https://redis.test',KV_REST_API_TOKEN:'fake',VERCEL_ENV:'production'});
 const redis=new Map<string,string>();let conflicts=1;
 redis.set('ml:cloud:user:'+owner,JSON.stringify({email:owner,hash:'hash',salt:'salt',bankOwnerVerified:true}));
 const snapshot=JSON.stringify({revision:'source-v1',encrypted:encryptCloudPayload(JSON.stringify(fixture()))});redis.set('ml:cloud:snapshot:'+owner,snapshot);
 globalThis.fetch=async(_url,init)=>{const a=JSON.parse(String(init?.body));let result:unknown=null;if(a[0]==='GET')result=redis.get(a[1])??null;else if(a[0]==='EVAL'){if(conflicts-->0)result=0;else {const rev=redis.has(a[3])?JSON.parse(redis.get(a[3])!).revision:'';result=rev===a[4]?1:0;if(result===1)redis.set(a[3],a[5]);}}else throw Error('Unexpected command');return new Response(JSON.stringify({result}));};
 const response=()=>{const result={status:200,body:{} as any,headers:new Map<string,unknown>()};const res={setHeader:(k:string,v:unknown)=>result.headers.set(k,v),getHeader:(k:string)=>result.headers.get(k),status(n:number){result.status=n;return this;},json(body:unknown){result.body=body;return this;}} as unknown as VercelResponse;return {result,res};};
 try{
 const session=response();setCloudSession(session.res,owner);const cookie=String(session.result.headers.get('Set-Cookie')).split(';')[0];
 const req=(authenticated=true)=>({method:'POST',query:{action:'monitoring'},body:{},headers:{cookie:authenticated?cookie:'',origin:'https://www.moneylith.nl','x-moneylith-cloud':'1'}} as unknown as VercelRequest);
 let reply=response();await handler(req(false),reply.res);assert.equal(reply.result.status,401);
 reply=response();const foreign=req();foreign.headers.origin='https://attacker.test';await handler(foreign,reply.res);assert.equal(reply.result.status,403);
 const first=await monitorAccount(owner,undefined,now);assert.equal(first.notices.length,1);
 assert.ok(!redis.get('ml:monitoring:v1:'+owner)!.includes('Boodschappen'));
 await Promise.all([monitorAccount(owner,{action:'read',id:first.notices[0].id},now),monitorAccount(owner,{action:'dismiss',id:first.notices[0].id},now)]);
 const restored=await getMonitoring(owner);assert.ok(restored.state.notices[0].readAt);assert.ok(restored.state.notices[0].dismissedAt);assert.equal(redis.get('ml:cloud:snapshot:'+owner),snapshot);
 await assert.rejects(()=>monitoringAdviceRequest({...req(false),body:{scope:'personal',noticeId:first.notices[0].id}} as VercelRequest),/Log in/);
 await assert.rejects(()=>monitoringAdviceRequest({...req(),body:{scope:'business-real',noticeId:first.notices[0].id}} as VercelRequest),/context/);
 await assert.rejects(()=>monitoringAdviceRequest({...req(),body:{scope:'personal',noticeId:first.notices[0].id}} as VercelRequest),/niet meer actief/);
 reply=response();await handler(req(),reply.res);assert.equal(reply.result.status,200);assert.equal(reply.result.body.monitoring.notices.length,1);
 const samples=Array.from({length:8},(_,i)=>{const day='2026-10-'+(15+i);return {station:'arnhem-eduard-van-beinumlaan',day,fetchedAt:day+'T12:00:00.000Z',milliEuros:i===7?2170:2200};});
 redis.set('ml:fuel:tinq-e10:v1',JSON.stringify({checkedAt:now.toISOString(),failed:0,samples}));
 const fuel=await monitorAccount(owner,undefined,now);assert.equal(fuel.notices.filter(n=>n.kind==='fuel'&&n.active).length,1);assert.equal(fuel.fuel?.stations[0].price,'2,170');
 const muted=await monitorAccount(owner,{action:'preferences',enabled:true,mutedLabels:['Brandstofprijzen']},now);assert.equal(muted.notices.filter(n=>n.kind==='fuel'&&n.active).length,0);
 assert.equal(redis.get('ml:cloud:snapshot:'+owner),snapshot);

 }finally{globalThis.fetch=originalFetch;for(const k of Object.keys(process.env))if(!(k in previous))delete process.env[k];Object.assign(process.env,previous);}
});
