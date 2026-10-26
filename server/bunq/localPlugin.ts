import type {Plugin} from 'vite';
import {allowLocal} from '../lunchflow/localPlugin.js';
import {localBunq} from './local.js';
import {bunqFailure} from './client.js';
export function bunqLocal(key:string):Plugin{
 let busy=false;
 return {name:'moneylith-bunq-local',apply:'serve',configureServer(server){server.middlewares.use('/api/bunq',async(req,res)=>{
  const send=(status:number,data:unknown)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};
  if(!allowLocal(req))return send(403,{ok:false,error:'bunq-toegang geweigerd.'});
  if(busy)return send(429,{ok:false,error:'Er loopt al een bunq-verzoek.'});busy=true;
  try{
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)return send(400,{ok:false,error:'Verzoek te groot.'});}
   const body=JSON.parse(raw);if(!['accounts','test','connect'].includes(body.operation))return send(400,{ok:false,error:'Onbekende actie.'});
   const client=localBunq(key),accounts=await client.accounts();
   if(body.operation==='accounts')return send(200,{ok:true,accounts});
   if(body.operation==='test'){const checks=[];for(const a of accounts.filter(a=>a.status==='ACTIVE')){const s=await client.snapshot(a);checks.push({balance:s.balance.ok?{ok:true}:s.balance,transactions:s.transactions.ok?{ok:true,count:s.transactions.value.length}:s.transactions});}return send(200,{ok:true,diagnostic:{accountCount:accounts.length,checks}});}
   if(!Array.isArray(body.mappings)||!body.mappings.length||body.mappings.length>20)return send(400,{ok:false,error:'Kies rekeningen.'});
   const snapshots=[];for(const m of body.mappings){const a=accounts.find(a=>a.id===m?.providerId);if(!a)return send(400,{ok:false,error:'Rekening niet gevonden.'});snapshots.push(await client.snapshot(a));}return send(200,{ok:true,snapshots});
  }catch(e){const failure=bunqFailure(e);return send(503,{ok:false,error:failure.message,code:failure.code});}finally{busy=false;}
 });}};
}
