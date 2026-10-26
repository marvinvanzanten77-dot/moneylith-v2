import {readFileSync} from 'node:fs';
import {parse} from 'dotenv';
import {localBunq} from '../server/bunq/local.js';
import {bunqFailure} from '../server/bunq/client.js';
const env=parse(readFileSync(new URL('../.env.bunq.local',import.meta.url)));
try{
 const client=localBunq(env.BUNQ_API_KEY||'');const accounts=await client.accounts();
 console.log(JSON.stringify({accounts:'ok',count:accounts.length}));
 let failed=0;
 for(const a of accounts.filter(a=>a.status==='ACTIVE')){const s=await client.snapshot(a);if(!s.balance.ok||!s.transactions.ok)failed++;console.log(JSON.stringify({account:'bunq ••••'+a.id.slice(-2),balance:s.balance.ok?'ok':s.balance.error.code,transactions:s.transactions.ok?'ok':s.transactions.error.code,count:s.transactions.ok?s.transactions.value.length:undefined}));}
 if(failed||!accounts.some(a=>a.status==='ACTIVE'))process.exitCode=1;
}catch(e){const error=bunqFailure(e);console.log(JSON.stringify({ok:false,code:error.code,message:error.message}));process.exitCode=1;}
