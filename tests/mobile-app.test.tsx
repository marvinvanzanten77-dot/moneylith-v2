import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {compactRequested} from '../src/mobile/useCompactMode';
import {MobileOverview} from '../src/mobile/MobileOverview';
import type {Input} from '../src/projection/engine';
const fixture=():Input=>({scope:'personal',asOf:'2026-10-22',opening:100000,reserve:10000,events:[{id:'income',label:'Test inkomen',date:'2026-10-23',amount:200000,source:'income',basis:'assumption'},{id:'cost',label:'Test kosten',date:'2026-10-25',amount:-50000,source:'fixed',basis:'input'}],debts:{},missing:[],assumptions:[],goals:[]});
test('compact on phones, standalone and app links; full view preference wins',()=>{
 assert.equal(compactRequested(390,false,false,null),true);assert.equal(compactRequested(1440,false,false,null),false);assert.equal(compactRequested(1440,true,false,null),true);assert.equal(compactRequested(1440,false,true,null),true);assert.equal(compactRequested(390,true,true,'full'),false);assert.equal(compactRequested(1440,false,false,'compact'),true);
});
test('essential overview uses existing projection cents and preserves unknown input',()=>{
 const input=fixture(),copy=JSON.stringify(input);const html=renderToStaticMarkup(<MobileOverview input={input} onNavigate={()=>{}}/>);
 assert.match(html,/900,00/);assert.match(html,/2.400,00/);assert.match(html,/Test inkomen/);assert.match(html,/Aanname/);assert.match(html,/Ingevoerd/);assert.equal(JSON.stringify(input),copy);
 const unknown=renderToStaticMarkup(<MobileOverview input={{...input,opening:null,reserve:null,events:[]}} onNavigate={()=>{}}/>);assert.match(unknown,/Nog onbekend/);assert.doesNotMatch(unknown,/900,00/);assert.match(unknown,/Geen gedateerde betalingen bekend/);
 const zero=renderToStaticMarkup(<MobileOverview input={{...input,opening:0,reserve:0,events:[]}} onNavigate={()=>{}}/>);assert.match(zero,/0,00/);assert.doesNotMatch(zero,/Nog onbekend/);
});
test('business view uses its own input, and missing dates do not masquerade as no upcoming costs',()=>{
 const business={...fixture(),scope:'business-real' as const,opening:20000,reserve:0,events:[{id:'b',label:'Zakelijke factuur',amount:-1000,date:null,source:'invoice',basis:'input' as const}]};
 const html=renderToStaticMarkup(<MobileOverview input={business} onNavigate={()=>{}}/>);assert.match(html,/200,00/);assert.doesNotMatch(html,/Test inkomen/);assert.match(html,/betaaldatum/);assert.match(html,/Bankstatus/);
});
test('PWA manifest, icon sizes and hosting routes provide a standalone scoped app',()=>{
 const manifest=JSON.parse(fs.readFileSync('public/manifest.webmanifest','utf8'));assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/?app=1');assert.equal(manifest.scope,'/');
 for(const icon of manifest.icons){const bytes=fs.readFileSync('public'+icon.src);const n=Number(icon.sizes.split('x')[0]);assert.equal(bytes.readUInt32BE(16),n);assert.equal(bytes.readUInt32BE(20),n);}
 const host=JSON.parse(fs.readFileSync('vercel.json','utf8'));const rewrite=new RegExp('^'+host.rewrites.at(-1).source+'$');for(const route of ['/sw.js','/manifest.webmanifest','/offline.html','/icons/moneylith-192.png','/api/cloud'])assert.equal(rewrite.test(route),false);
 assert.match(fs.readFileSync('index.html','utf8'),/rel="manifest"/);
});
test('service worker caches only the public fallback and never handles private or API responses',async()=>{
 const handlers=new Map<string,(event:any)=>void>(),cached:string[]=[],deleted:string[]=[];
 const context=vm.createContext({URL,Response,Promise,self:{location:{origin:'https://www.moneylith.nl'},addEventListener:(name:string,fn:(event:any)=>void)=>handlers.set(name,fn),skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>({add:async(path:string)=>{cached.push(path);}}),keys:async()=>['moneylith-public-old','unrelated-app'],delete:async(key:string)=>{deleted.push(key);},match:async(path:string)=>path==='/offline.html'?new Response('Public offline page'):undefined},fetch:async()=>{throw Error('offline');}});
 vm.runInContext(fs.readFileSync('public/sw.js','utf8'),context);
 let task:Promise<unknown>=Promise.resolve();handlers.get('install')!({waitUntil:(p:Promise<unknown>)=>task=p});await task;assert.deepEqual(cached,['/offline.html']);
 handlers.get('activate')!({waitUntil:(p:Promise<unknown>)=>task=p});await task;assert.deepEqual(deleted,['moneylith-public-old']);
 for(const [url,method,mode] of [['https://www.moneylith.nl/api/cloud','GET','navigate'],['https://www.moneylith.nl/api/moneylith/analyse','POST','cors'],['https://other.test/','GET','navigate'],['https://www.moneylith.nl/assets/app.js','GET','same-origin']]){let handled=false;handlers.get('fetch')!({request:{url,method,mode},respondWith:()=>handled=true});assert.equal(handled,false);}
 let response=Promise.resolve(new Response());handlers.get('fetch')!({request:{url:'https://www.moneylith.nl/?app=1',method:'GET',mode:'navigate'},respondWith:(p:Promise<Response>)=>response=p});assert.equal(await (await response).text(),'Public offline page');
});
test('phone shows retrieved personal bank balance separately from unknown spendable space',async()=>{
 const {mobileBankBalance}=await import('../src/mobile/bankBalance');
 const accounts=[{id:'p',active:true,name:'Personal',type:'betaalrekening' as const,bankProvider:'lunchflow' as const,currency:'EUR',bankBalance:123.45,bankLastSync:'2026-10-22T10:00:00Z'},{id:'b',active:true,name:'Business',type:'betaalrekening' as const,bankProvider:'lunchflow' as const,currency:'EUR',bankBalance:900}];
 const rules={rules:[],accountRoles:{b:'business' as const}};const bank=mobileBankBalance(accounts,rules);
 assert.equal(bank?.cents,12345);assert.equal(mobileBankBalance([],rules),undefined);
 assert.equal(mobileBankBalance([{...accounts[0],bankBalance:undefined}],rules)?.cents,null);
 const html=renderToStaticMarkup(<MobileOverview input={{...fixture(),opening:null}} bank={bank} onNavigate={()=>{}}/>);assert.match(html,/123,45/);assert.match(html,/Laatst opgehaald banksaldo/);assert.match(html,/Nog onbekend/);assert.doesNotMatch(html,/900,00/);
});
