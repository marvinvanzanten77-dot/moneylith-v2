import crypto from 'node:crypto';
import webpush from 'web-push';
import {cloudCommand} from '../utils/cloudStore.js';
import {encryptCloudPayload,decryptCloudPayload} from '../utils/cloudAuth.js';
import type {MonitoringState} from '../../src/monitoring/engine.js';

export class PushInputError extends Error {}
export function pushConfig(){
  const publicKey=process.env.WEB_PUSH_PUBLIC_KEY,privateKey=process.env.WEB_PUSH_PRIVATE_KEY;
  return publicKey&&privateKey?{publicKey,privateKey,subject:'https://www.moneylith.nl'}:null;
}
const hash=(s:string)=>crypto.createHash('sha256').update(s).digest('hex');
const key=(email:string)=>`ml:push:v1:${hash(email.toLowerCase())}`;
export function validateSubscription(value:unknown):webpush.PushSubscription {
  if(!value||typeof value!=='object')throw new PushInputError('Ongeldig apparaat.');
  const v=value as webpush.PushSubscription;
  try{
    const u=new URL(v.endpoint);
    const allowed=u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com');
    if(!allowed||u.protocol!=='https:'||u.port||u.username||u.password||u.hash||v.endpoint.length>2048)throw Error();
    for(const [name,size] of [['p256dh',65],['auth',16]] as const){
      const s=v.keys?.[name];if(typeof s!=='string'||!/^[A-Za-z0-9_-]+={0,2}$/.test(s)||Buffer.from(s,'base64url').length!==size)throw Error();
    }
    if(Buffer.from(v.keys.p256dh,'base64url')[0]!==4)throw Error();
    return {endpoint:v.endpoint,keys:{p256dh:v.keys.p256dh,auth:v.keys.auth}};
  }catch{throw new PushInputError('Dit pushapparaat wordt niet ondersteund. Gebruik Safari, Chrome, Edge of Firefox.');}
}
export async function registerDevice(email:string,value:unknown){
  const sub=validateSubscription(value),id=hash(sub.endpoint);
  // NX preserves the original consent time and delivery history on repeat registration.
  const record=encryptCloudPayload(JSON.stringify({subscription:sub,createdAt:new Date().toISOString()}));
  const result=await cloudCommand(['EVAL',"if redis.call('HEXISTS',KEYS[1],ARGV[1])==1 then return 1 end; if redis.call('HLEN',KEYS[1])>=10 then return 0 end; redis.call('HSET',KEYS[1],ARGV[1],ARGV[2]); return 1",1,key(email),id,record]);
  if(result!==1)throw new PushInputError('Er zijn al tien apparaten gekoppeld. Schakel eerst meldingen uit op een ander apparaat.');
}
function endpointId(endpoint:unknown){if(typeof endpoint!=='string'||endpoint.length>2048)throw new PushInputError('Ongeldig apparaat.');return hash(endpoint);}
export async function removeDevice(email:string,endpoint:unknown){await cloudCommand(['HDEL',key(email),endpointId(endpoint)]);}
export async function deviceExists(email:string,endpoint:unknown){return await cloudCommand(['HEXISTS',key(email),endpointId(endpoint)])===1;}
export function pendingNotices(state:MonitoringState,since:string){
  return state.preferences.enabled?state.notices.filter(n=>n.scope==='personal'&&n.active&&!n.readAt&&!n.dismissedAt&&!state.preferences.mutedLabels.includes(n.label)&&n.createdAt>=since):[];
}
async function send(subscription:webpush.PushSubscription,test=false){
  const vapidDetails=pushConfig();if(!vapidDetails)throw Error('Push niet geconfigureerd.');
  // Never put financial information, labels, account IDs or arbitrary URLs on the lock screen.
  await webpush.sendNotification(subscription,JSON.stringify({type:test?'test':'monitoring'}),{vapidDetails,TTL:3600,urgency:'normal',timeout:10000});
}
export async function testDevice(email:string,endpoint:unknown){
  const id=endpointId(endpoint),raw=await cloudCommand(['HGET',key(email),id]);
  if(typeof raw!=='string')throw new PushInputError('Zet meldingen eerst aan op dit apparaat.');
  const limit=await cloudCommand(['SET',`${key(email)}:test:${id}`,'1','NX','EX',60]);
  if(limit!=='OK')throw new PushInputError('Wacht een minuut voordat je nog een test verstuurt.');
  try{await send(JSON.parse(decryptCloudPayload(raw)).subscription,true);}
  catch(e){if([404,410].includes(Number((e as {statusCode?:number}).statusCode))){await removeDevice(email,endpoint);throw new PushInputError('Dit apparaat is niet meer gekoppeld. Zet meldingen opnieuw aan.');}throw e;}
}
export async function dispatchPush(email:string,state:MonitoringState){
  const result={accepted:0,failed:0,expired:0};
  if(!pushConfig()||!state.preferences.enabled)return result;
  const records=await cloudCommand(['HGETALL',key(email)]) as string[]|null;
  if(!Array.isArray(records))return result;
  await Promise.all(Array.from({length:records.length/2},async(_,i)=>{
    const id=records[i*2],lock=`${key(email)}:lock:${id}`,token=crypto.randomUUID();
    if(await cloudCommand(['SET',lock,token,'NX','EX',120])!=='OK')return;
    try{
      // Re-read after acquiring the lock so a device removed before dispatch is skipped.
      const raw=await cloudCommand(['HGET',key(email),id]);if(typeof raw!=='string')return;
      const record=JSON.parse(decryptCloudPayload(raw));
      const candidates=pendingNotices(state,record.createdAt);
      if(!candidates.length)return;
      const sentKeys=candidates.map(n=>`${key(email)}:sent:${id}:${hash(n.id)}`);
      const sent=await cloudCommand(['MGET',...sentKeys]) as (string|null)[];
      const fresh=sentKeys.filter((_,index)=>sent[index]===null);
      if(!fresh.length)return;
      await send(validateSubscription(record.subscription));result.accepted++;
      await cloudCommand(['EVAL',"for _,key in ipairs(KEYS) do redis.call('SET',key,'1','EX',ARGV[1]) end; return 1",fresh.length,...fresh,120*86400]);
    }catch(e){
      if([404,410].includes(Number((e as {statusCode?:number}).statusCode))){await cloudCommand(['HDEL',key(email),id]);result.expired++;}else result.failed++;
    }finally{
      await cloudCommand(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end; return 0",1,lock,token]);
    }
  }));
  return result;
}
