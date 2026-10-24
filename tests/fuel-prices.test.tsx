import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTinqE10,mergeFuel,fuelSignals,fuelOverview,emptyFuel,scanFuel,type FuelSample} from '../server/fuel/prices';
import {reconcileNotices} from '../src/monitoring/engine';
const station='arnhem-eduard-van-beinumlaan',now=new Date('2026-10-24T12:00:00Z');
const block=(name:string,value:string)=>`<div class="node node--type-price"><div class="field--name-taxonomy-term-title"><p>${name}</p></div><div content="${value}" class="field--name-field-prices-price-pump"></div></div>`;
const html=block('Diesel B7','1.999')+block('Euro95 E10','2.259');
const sample=(day:string,milliEuros=2200):FuelSample=>({station,day,fetchedAt:day+'T12:00:00.000Z',milliEuros});
const history=Array.from({length:7},(_,i)=>sample('2026-10-'+(17+i)));
test('TinQ pump parser selects exact Euro95 E10, retains three decimals and rejects missing, duplicate and malformed prices',()=>{
 assert.equal(parseTinqE10(html),2259);
 assert.throws(()=>parseTinqE10(block('Diesel B7','1.999')));
 assert.throws(()=>parseTinqE10(html+html));
 assert.throws(()=>parseTinqE10(block('Euro95 E10','2.25')));
 assert.throws(()=>parseTinqE10(block('Euro95 E10','99.999')));
 assert.throws(()=>parseTinqE10(html.replaceAll('price-pump','price-advisory')));
});
test('fuel baseline requires seven distinct earlier days at the same station and never interprets failed fetch as a price',()=>{
 let state=mergeFuel({...emptyFuel(),samples:history.slice(0,6)},[sample('2026-10-24',2170)],0,now);
 assert.equal(fuelSignals(state,now).length,0);
 state=mergeFuel({...emptyFuel(),samples:history},[sample('2026-10-24',2181)],0,now);assert.equal(fuelSignals(state,now).length,0);
 state=mergeFuel(state,[sample('2026-10-24',2180)],0,now);assert.equal(fuelSignals(state,now).length,1);assert.match(fuelSignals(state,now)[0].title,/lager/);
 assert.equal(state.samples.length,8);assert.equal(fuelSignals(state,new Date('2026-10-25T10:00:00Z')).length,0);
 const high=mergeFuel(state,[sample('2026-10-24',2220)],0,now);assert.match(fuelSignals(high,now)[0].title,/hoger/);
 assert.equal(fuelSignals({...state,samples:history.map(s=>({...s,station:'bemmel-herckenrathweg'})).concat(sample('2026-10-24',2100))},now).length,0);
 const notices=reconcileNotices([],fuelSignals(state,now),now.toISOString());assert.equal(reconcileNotices(notices,fuelSignals(state,now),now.toISOString()).length,1);
 const failed=mergeFuel(state,[],4,new Date('2026-10-25T12:00:00Z'));assert.equal(failed.samples.length,8);assert.equal(fuelSignals(failed,new Date('2026-10-25T12:00:00Z')).length,0);assert.equal(fuelOverview(failed,new Date('2026-10-25T12:00:00Z')).stations[0].fresh,false);
});
test('server fuel scan stores public prices only, caches repeated scans and preserves history on partial/all failure',async()=>{
 const env={...process.env},original=globalThis.fetch;Object.assign(process.env,{KV_REST_API_URL:'https://redis.test',KV_REST_API_TOKEN:'test'});const redis=new Map<string,string>();let calls=0;
 globalThis.fetch=(async(_url,init)=>{const [op,k,v,...args]=JSON.parse(String(init?.body));let result:unknown=null;if(op==='GET')result=redis.get(k)??null;if(op==='SET'){if(args.includes('NX')&&redis.has(k))result=null;else{redis.set(k,v);result='OK';}}if(op==='DEL'){redis.delete(k);result=1;}return new Response(JSON.stringify({result}));}) as typeof fetch;
 const fetcher=(async()=>{calls++;return new Response(html,{headers:{'content-type':'text/html'}});}) as typeof fetch;
 try{
  const first=await scanFuel(now,fetcher);assert.equal(first.samples.length,4);assert.equal(calls,4);
  await scanFuel(now,fetcher);assert.equal(calls,4);
  const later=new Date('2026-10-25T12:00:00Z');let i=0;
  const partial=await scanFuel(later,(async()=>{i++;return i===1?new Response(html,{headers:{'content-type':'text/html'}}):new Response('',{status:503});}) as typeof fetch);
  assert.equal(partial.failed,3);assert.equal(partial.samples.length,5);
  const failed=await scanFuel(new Date('2026-10-26T12:00:00Z'),(async()=>{throw Error('offline');}) as typeof fetch);assert.equal(failed.failed,4);assert.deepEqual(failed.samples,partial.samples);
 }finally{globalThis.fetch=original;process.env=env;}
});
