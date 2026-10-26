import {withBunq} from './store.js';
import {getCloudSnapshot,setCloudSnapshot} from '../utils/cloudStore.js';
import {decryptCloudPayload,encryptCloudPayload} from '../utils/cloudAuth.js';
import {validateCloudState} from '../../src/storage/cloudState.js';
import {processBankSync} from '../../src/bank/processSync.js';
import {amsterdamDate} from '../../src/monitoring/engine.js';
import type {LunchMapping} from '../../src/bank/lunchflowMerge.js';
export async function bunqAccounts(email:string){return withBunq(email,c=>c.accounts());}
export async function bunqTest(email:string){return withBunq(email,async c=>{const accounts=await c.accounts();const checks=[];for(const a of accounts.filter(a=>a.status==='ACTIVE')){const s=await c.snapshot(a);checks.push({label:'bunq ••••'+a.id.slice(-2),balance:s.balance.ok?{ok:true}:s.balance,transactions:s.transactions.ok?{ok:true,count:s.transactions.value.length}:s.transactions});}return {accountCount:accounts.length,checks};});}
export async function bunqConnect(email:string,mappings:LunchMapping[]){
 if(!Array.isArray(mappings)||!mappings.length||mappings.length>20||mappings.some(m=>!m||typeof m.providerId!=='string'||typeof m.targetId!=='string'))throw Error('Ongeldige rekeningselectie.');
 const snapshots=await withBunq(email,async c=>{const accounts=await c.accounts();const result=[];for(const m of mappings){const a=accounts.find(a=>a.id===m.providerId);if(!a)throw Error('Rekening niet beschikbaar.');result.push(await c.snapshot(a));}return result;});
 for(let attempt=0;attempt<4;attempt++){
  const record=await getCloudSnapshot(email),state=record?JSON.parse(decryptCloudPayload(record.encrypted)):{};if(!validateCloudState(state))throw Error('Ongeldige administratie.');
  const processed=processBankSync(state,snapshots,mappings,amsterdamDate(new Date()),'bunq');
  if(await setCloudSnapshot(email,encryptCloudPayload(JSON.stringify(processed.state)),record?.revision??null))return processed.result.reports;
 }throw Error('Administratie is tegelijk gewijzigd. Probeer opnieuw.');
}
