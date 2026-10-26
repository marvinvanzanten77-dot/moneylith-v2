import {withBunq} from '../bunq/store.js';
import {bunqFailure} from '../bunq/client.js';
import crypto from 'node:crypto';
import {LunchClient,safeFailure} from './client.js';
import {cloudCommand,getCloudSnapshot,setCloudSnapshot} from '../utils/cloudStore.js';
import {encryptCloudPayload,decryptCloudPayload} from '../utils/cloudAuth.js';
import {validateCloudState,type CloudState} from '../../src/storage/cloudState.js';
import {processBankSync,type BankScan} from '../../src/bank/processSync.js';
import {amsterdamDate} from '../../src/monitoring/engine.js';
import type {MoneylithAccount} from '../../src/types.js';
import type {LunchSnapshot} from '../../src/bank/lunchflowTypes.js';
const scanKey='moneylith.personal.bankScan.v1';
function source(encrypted?:string):CloudState{
 const state=encrypted?JSON.parse(decryptCloudPayload(encrypted)):{};
 if(!validateCloudState(state))throw Error('Ongeldige cloudadministratie.');return state;
}
const linked=(state:CloudState)=>(JSON.parse(state['moneylith.personal.accounts']??'[]') as MoneylithAccount[]).filter(a=>a.active!==false&&(a.bankProvider==='lunchflow'||a.bankProvider==='bunq')&&a.bankAccountId);
export async function syncBankAccount(email:string,apiKey:string,scanId:string=crypto.randomUUID(),now=new Date(),client=new LunchClient(apiKey)){
 const lock='ml:bank-sync:'+crypto.createHash('sha256').update(email).digest('hex'),token=crypto.randomUUID();
 if(await cloudCommand(['SET',lock,token,'NX','EX',300])!=='OK')throw Error('Een banksynchronisatie loopt al. Probeer straks opnieuw.');
 try{
  const initial=source((await getCloudSnapshot(email))?.encrypted);
  const previous=initial[scanKey]?JSON.parse(initial[scanKey]) as BankScan:null;
  if(previous?.id===scanId)return previous;
  const chosen=linked(initial);if(chosen.length>20)throw Error('Te veel gekoppelde rekeningen.');
  let snapshots:LunchSnapshot[]=[];let bunqSnapshots:LunchSnapshot[]=[];
  const unavailable=(a:MoneylithAccount,error:import('../../src/bank/lunchflowTypes.js').LunchFailure):LunchSnapshot=>({account:{id:a.bankAccountId!,label:a.name,institution:'',upstream:'',status:'INACTIVE',currency:a.currency??'EUR'},balance:{ok:false,error},transactions:{ok:false,error},fetchedAt:now.toISOString()});
  const lunch=chosen.filter(a=>a.bankProvider==='lunchflow'),bunq=chosen.filter(a=>a.bankProvider==='bunq');
  if(lunch.length)try{
   const available=await client.accounts();
   snapshots=await Promise.all(lunch.map(async a=>{const remote=available.find(r=>r.id===a.bankAccountId);return remote?client.snapshot(remote):unavailable(a,{code:'reconnect',message:'Rekening ontbreekt bij Lunch Flow. Controleer de koppeling.'});}));
  }catch(e){snapshots=lunch.map(a=>unavailable(a,safeFailure(e)));}
  if(bunq.length)try{
   bunqSnapshots=await withBunq(email,async c=>{const available=await c.accounts(),result:LunchSnapshot[]=[];for(const a of bunq){const remote=available.find(r=>r.id===a.bankAccountId);result.push(remote?await c.snapshot(remote):unavailable(a,{code:'reconnect',message:'Rekening ontbreekt bij bunq. Controleer de koppeling.'}));}return result;});
  }catch(e){bunqSnapshots=bunq.map(a=>unavailable(a,bunqFailure(e)));}
  // Always rebase on the newest document. A concurrent edit is never overwritten by an old snapshot.
  for(let attempt=0;attempt<4;attempt++){
   const record=await getCloudSnapshot(email),state=source(record?.encrypted);
   const current=linked(state);
   const mappings=current.filter(a=>a.bankProvider==='lunchflow'&&snapshots.some(s=>s.account.id===a.bankAccountId)).map(a=>({providerId:a.bankAccountId!,targetId:a.id}));
   let processed=processBankSync(state,snapshots,mappings,amsterdamDate(now));
   if(bunqSnapshots.length){const extra=processBankSync(processed.state,bunqSnapshots,current.filter(a=>a.bankProvider==='bunq'&&bunqSnapshots.some(s=>s.account.id===a.bankAccountId)).map(a=>({providerId:a.bankAccountId!,targetId:a.id})),amsterdamDate(now),'bunq');extra.result.reports=[...processed.result.reports,...extra.result.reports];if(extra.financial)extra.financial.updatedIncome+=(processed.financial?.updatedIncome??0);if(extra.debtPayments&&processed.debtPayments){extra.debtPayments.applied+=processed.debtPayments.applied;extra.debtPayments.appliedCents+=processed.debtPayments.appliedCents;}processed=extra;}
   const ok=processed.result.reports.filter(r=>r.ok).length,failed=current.length-ok;
   const baseMessage=(!current.length?'Geen rekeningen gekoppeld. Open Bank om rekeningen te verbinden.':failed?`Banksynchronisatie gedeeltelijk of niet geslaagd (${ok} van ${current.length} rekeningen). Eerdere gegevens van mislukte rekeningen zijn behouden. ${processed.result.reports.filter(r=>!r.ok).map(r=>r.message).join(' ')}`:`${ok} rekeningen opgehaald en verwerkt. Er zijn ${processed.result.reports.reduce((n,r)=>n+r.added,0)} nieuwe geboekte transacties. Bankgegevens zijn opgehaald bij de aangesloten providers. De actualiteit kan per rekening verschillen.`);
   const debtMessage=processed.debtPayments?.applied?` ${processed.debtPayments.applied} aflossingen verwerkt in Schulden. Het banksaldo is niet nogmaals verlaagd.`:'';
   const questions=processed.debtPayments?.questions.length??0;
   const message=baseMessage+debtMessage+(questions?` ${questions} betalingen vragen controle bij Fundament → Betalingen controleren.`:'');
   const priorScan=state[scanKey]?JSON.parse(state[scanKey]) as BankScan:null;
   const scan:BankScan={lastSuccessfulAt:!failed&&ok>0?now.toISOString():priorScan?.lastSuccessfulAt??(priorScan&&priorScan.ok>0&&!priorScan.failed?priorScan.at:undefined),updatedTransactions:processed.result.reports.reduce((n,r)=>n+r.updated,0),id:scanId,at:now.toISOString(),ok,failed,added:processed.result.reports.reduce((n,r)=>n+r.added,0),updatedIncome:processed.financial?.updatedIncome??0,message};
   const next={...processed.state,[scanKey]:JSON.stringify(scan)};
   if(await setCloudSnapshot(email,encryptCloudPayload(JSON.stringify(next)),record?.revision??null))return scan;
  }
  throw Error('Administratie is tegelijk gewijzigd. Probeer synchroniseren opnieuw.');
 }finally{await cloudCommand(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end; return 0",1,lock,token]);}
}
