import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import webpush from 'web-push';
import {validateSubscription,pendingNotices,registerDevice,removeDevice,deviceExists,dispatchPush,testDevice} from '../server/push/service';
import {emptyMonitoring,type Notice} from '../src/monitoring/engine';
import cron from '../api/monitoring-cron';
import cloud from '../api/cloud';
import {setCloudSession} from '../server/utils/cloudAuth';
import type {VercelRequest,VercelResponse} from '@vercel/node';
const point=crypto.createECDH('prime256v1');point.generateKeys();
const sub={endpoint:'https://fcm.googleapis.com/fcm/send/test-only',keys:{p256dh:point.getPublicKey().toString('base64url'),auth:crypto.randomBytes(16).toString('base64url')}};
const notice:Notice={id:'personal:budget:2026-10:food',scope:'personal',kind:'budget',month:'2026-10',label:'Private food',title:'Private title',message:'Private details',observedCents:12000,referenceCents:10000,createdAt:'2099-01-01T00:00:00.000Z',updatedAt:'2099-01-01T00:00:00.000Z',active:true,readAt:null,dismissedAt:null};
const state={...emptyMonitoring(),notices:[notice]};
const response=()=>{const r={status:200,body:{} as any,headers:new Map<string,unknown>()};const res={setHeader:(k:string,v:unknown)=>r.headers.set(k,v),getHeader:(k:string)=>r.headers.get(k),status(n:number){r.status=n;return this;},json(b:unknown){r.body=b;return this;}} as unknown as VercelResponse;return {r,res};};
test('push endpoint and key validation blocks arbitrary URLs and malformed device keys',()=>{
 assert.deepEqual(validateSubscription(sub),sub);
 for(const endpoint of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.test/x','https://fcm.googleapis.com:8443/x','https://user:pass@fcm.googleapis.com/x','https://example.com/x'])assert.throws(()=>validateSubscription({...sub,endpoint}));
 assert.throws(()=>validateSubscription({...sub,keys:{...sub.keys,auth:'bad'}}));
 for(const host of ['web.push.apple.com','eu.push.apple.com','updates.push.services.mozilla.com'])assert.equal(validateSubscription({...sub,endpoint:`https://${host}/test`}).endpoint,`https://${host}/test`);
});
test('only new, active, unread personal notices are eligible; pause and mute apply',()=>{
 const since='2026-10-22T00:00:00.000Z';assert.equal(pendingNotices(state,since).length,1);
 for(const change of [{readAt:since},{dismissedAt:since},{active:false},{createdAt:'2026-10-01'},{scope:'business' as any}])assert.equal(pendingNotices({...state,notices:[{...notice,...change}]},since).length,0);
 assert.equal(pendingNotices({...state,preferences:{enabled:false,mutedLabels:[]}},since).length,0);
 assert.equal(pendingNotices({...state,preferences:{enabled:true,mutedLabels:[notice.label]}},since).length,0);
});
test('encrypted devices, owner isolation, concurrent dedup, retry, expired cleanup and authenticated routes',async()=>{
 const oldEnv={...process.env},oldFetch=globalThis.fetch,oldSend=webpush.sendNotification;
 const owner='push-owner@example.test';const strings=new Map<string,string>(),hashes=new Map<string,Map<string,string>>();let sends=0,fail=0;
 Object.assign(process.env,{LUNCHFLOW_PRIVATE_ENABLED:'true',LUNCHFLOW_API_KEY:'fake',LUNCHFLOW_OWNER_EMAIL:owner,LUNCHFLOW_OWNER_CODE_HASH:'a'.repeat(64),LUNCHFLOW_SESSION_SECRET:'b'.repeat(64),CLOUD_AUTH_SECRET:'c'.repeat(64),CLOUD_ENCRYPTION_KEY:'d'.repeat(64),KV_REST_API_URL:'https://redis.test',KV_REST_API_TOKEN:'fake',VERCEL_ENV:'production',WEB_PUSH_PUBLIC_KEY:'test-public',WEB_PUSH_PRIVATE_KEY:'test-private',CRON_SECRET:'s'.repeat(64)});
 strings.set('ml:cloud:user:'+owner,JSON.stringify({email:owner,bankOwnerVerified:true,hash:"hash",salt:"salt"}));
 globalThis.fetch=async(_url,init)=>{
   const a=JSON.parse(String(init?.body)),[cmd,k,...args]=a;let result:unknown=null;
   const h=hashes.get(k)??new Map<string,string>();
   if(cmd==='GET')result=strings.get(k)??null;
   else if(cmd==='HGETALL')result=Array.from(h.entries()).flat();
   else if(cmd==='HGET')result=h.get(args[0])??null;
   else if(cmd==='HEXISTS')result=Number(h.has(args[0]));
   else if(cmd==='HDEL')result=Number(h.delete(args[0]));
   else if(cmd==='MGET')result=[k,...args].map(v=>strings.get(v)??null);
   else if(cmd==='SET'){if(!args.includes('NX')||!strings.has(k)){strings.set(k,args[0]);result='OK';}}
   else if(cmd==='EVAL'){
     const key=a[3],field=a[4];
     if(k.includes('ipairs')){for(const key of a.slice(3,3+a[2]))strings.set(key,'1');result=1;}
     else if(k.includes('HEXISTS')){const m=hashes.get(key)??new Map();if(m.has(field))result=1;else if(m.size>=10)result=0;else {m.set(field,a[5]);hashes.set(key,m);result=1;}}
     else if(k.includes("redis.call('DEL'")){if(strings.get(key)===field){strings.delete(key);result=1;}else result=0;}
     else throw Error('Unexpected Lua');
   }else throw Error('Unexpected command '+cmd);
   return new Response(JSON.stringify({result}));
 };
 webpush.sendNotification=(async(_sub,payload)=>{sends++;assert.equal(JSON.stringify(payload).includes('Private'),false);assert.ok(['{"type":"test"}','{"type":"monitoring"}'].includes(String(payload)));if(fail)throw {statusCode:fail};return {statusCode:201,headers:{},body:''};}) as typeof webpush.sendNotification;
 try{
   await registerDevice(owner,sub);await registerDevice(owner,sub);
   assert.equal(await deviceExists(owner,sub.endpoint),true);assert.equal(await deviceExists('other@example.test',sub.endpoint),false);
   assert.equal(JSON.stringify(Array.from(hashes.values()).map(m=>Array.from(m.values()))).includes(sub.endpoint),false);
   const snapshot=JSON.stringify(state);
   await Promise.all([dispatchPush(owner,state),dispatchPush(owner,state)]);await dispatchPush(owner,state);assert.equal(sends,1);assert.equal(JSON.stringify(state),snapshot);
   const next={...state,notices:[{...notice,id:'another'}]};fail=503;assert.equal((await dispatchPush(owner,next)).failed,1);fail=0;assert.equal((await dispatchPush(owner,next)).accepted,1);assert.equal((await dispatchPush(owner,next)).accepted,0);
   await testDevice(owner,sub.endpoint);await assert.rejects(()=>testDevice(owner,sub.endpoint),/minuut/);
   fail=410;assert.equal((await dispatchPush(owner,{...state,notices:[{...notice,id:'expired'}]})).expired,1);assert.equal(await deviceExists(owner,sub.endpoint),false);fail=0;
   await registerDevice(owner,sub);await removeDevice(owner,sub.endpoint);assert.equal(await deviceExists(owner,sub.endpoint),false);
   const session=response();setCloudSession(session.res,owner);const cookie=String(session.r.headers.get('Set-Cookie')).split(';')[0];
   const req={method:'POST',query:{action:'push'},body:{operation:'status'},headers:{origin:'https://www.moneylith.nl','x-moneylith-cloud':'1'}} as unknown as VercelRequest;
   let out=response();await cloud(req,out.res);assert.equal(out.r.status,401);
   req.headers.cookie=cookie;out=response();await cloud(req,out.res);assert.equal(out.r.status,200);assert.equal(out.r.body.publicKey,'test-public');assert.equal(JSON.stringify(out.r.body).includes('test-private'),false);
   req.headers.origin='https://evil.test';out=response();await cloud(req,out.res);assert.equal(out.r.status,403);
   out=response();await cron({method:'GET',headers:{}} as VercelRequest,out.res);assert.equal(out.r.status,401);
   out=response();await cron({method:'GET',headers:{authorization:'Bearer wrong'}} as VercelRequest,out.res);assert.equal(out.r.status,401);
 }finally{globalThis.fetch=oldFetch;webpush.sendNotification=oldSend;for(const k of Object.keys(process.env))if(!(k in oldEnv))delete process.env[k];Object.assign(process.env,oldEnv);}
});
test('service worker shows generic text and opens only the fixed personal notification destination',async()=>{
 const handlers=new Map<string,(e:any)=>void>();let shown:any,opened='',closed=false;
 vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{self:{addEventListener:(n:string,f:any)=>handlers.set(n,f),registration:{showNotification:async(title:string,options:unknown)=>{shown={title,options};}},clients:{openWindow:async(url:string)=>{opened=url;}}}});
 let task=Promise.resolve();const waitUntil=(p:Promise<void>)=>task=p;
 handlers.get('push')!({data:{json:()=>({type:'monitoring',body:'Private €100',url:'https://evil.test'})},waitUntil});await task;
 assert.doesNotMatch(JSON.stringify(shown),/Private|€100|evil/);assert.equal(shown.options.tag,'moneylith-monitoring');
 assert.ok(fs.existsSync('public'+shown.options.icon));
 handlers.get('notificationclick')!({notification:{close:()=>{closed=true;},data:{url:'https://evil.test'}},waitUntil});await task;
 assert.equal(closed,true);assert.equal(opened,'/prive?app=1&view=notifications#persoonlijk');
});
