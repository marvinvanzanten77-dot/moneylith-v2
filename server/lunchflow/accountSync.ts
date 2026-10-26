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
const linked=(state:CloudState)=>(JSON.parse(state['moneylith.personal.accounts']??'[]') as MoneylithAccount[]).filter(a=>a.active!==false&&a.bankProvider==='lunchflow'&&a.bankAccountId);
export async function syncBankAccount(email:string,apiKey:string,scanId:string=crypto.randomUUID(),now=new Date(),client=new LunchClient(apiKey)){
 const lock='ml:bank-sync:'+crypto.createHash('sha256').update(email).digest('hex'),token=crypto.randomUUID();
 if(await cloudCommand(['SET',lock,token,'NX','EX',300])!=='OK')throw Error('Een banksynchronisatie loopt al. Probeer straks opnieuw.');
 try{
  const initial=source((await getCloudSnapshot(email))?.encrypted);
  const previous=initial[scanKey]?JSON.parse(initial[scanKey]) as BankScan:null;
  if(previous?.id===scanId)return previous;
  const chosen=linked(initial);if(chosen.length>20)throw Error('Te veel gekoppelde rekeningen.');
  let snapshots:LunchSnapshot[]=[];let failure='';
  try{
   const available=await client.accounts();
   snapshots=await Promise.all(chosen.map(async a=>{
    const remote=available.find(r=>r.id===a.bankAccountId);
    if(remote)return client.snapshot(remote);
    const error={code:'reconnect' as const,message:'Rekening ontbreekt bij Lunch Flow. Controleer de koppeling.'};
    return {account:{id:a.bankAccountId!,label:a.name,institution:'',upstream:'',status:'INACTIVE',currency:a.currency??'EUR'},balance:{ok:false as const,error},transactions:{ok:false as const,error},fetchedAt:now.toISOString()};
   }));
  }catch(e){failure=safeFailure(e).message;}
  // Always rebase on the newest document. A concurrent edit is never overwritten by an old snapshot.
  for(let attempt=0;attempt<4;attempt++){
   const record=await getCloudSnapshot(email),state=source(record?.encrypted);
   const current=linked(state);
   const mappings=current.filter(a=>snapshots.some(s=>s.account.id===a.bankAccountId)).map(a=>({providerId:a.bankAccountId!,targetId:a.id}));
   const processed=processBankSync(state,snapshots,mappings,amsterdamDate(now));
   const ok=processed.result.reports.filter(r=>r.ok).length,failed=current.length-ok;
   const baseMessage=failure||(!current.length?'Geen rekeningen gekoppeld. Open Bank om rekeningen te verbinden.':failed?`Banksynchronisatie gedeeltelijk of niet geslaagd (${ok} van ${current.length} rekeningen). Eerdere gegevens van mislukte rekeningen zijn behouden. ${processed.result.reports.filter(r=>!r.ok).map(r=>r.message).join(' ')}`:`${ok} rekeningen opgehaald en verwerkt. Er zijn ${processed.result.reports.reduce((n,r)=>n+r.added,0)} nieuwe geboekte transacties. Lunch Flow kan achterlopen op de bank.`);
   const debtMessage=processed.debtPayments?.applied?` ${processed.debtPayments.applied} aflossingen verwerkt in Schulden. Het banksaldo is niet nogmaals verlaagd.`:'';
   const questions=processed.debtPayments?.questions.length??0;
   const message=baseMessage+debtMessage+(questions?` ${questions} betalingen vragen controle bij Fundament → Betalingen controleren.`:'');
   const priorScan=state[scanKey]?JSON.parse(state[scanKey]) as BankScan:null;
   const scan:BankScan={lastSuccessfulAt:!failure&&!failed&&ok>0?now.toISOString():priorScan?.lastSuccessfulAt??(priorScan&&priorScan.ok>0&&!priorScan.failed?priorScan.at:undefined),updatedTransactions:processed.result.reports.reduce((n,r)=>n+r.updated,0),id:scanId,at:now.toISOString(),ok,failed:failure?Math.max(1,failed):failed,added:processed.result.reports.reduce((n,r)=>n+r.added,0),updatedIncome:processed.financial?.updatedIncome??0,message};
   const next={...processed.state,[scanKey]:JSON.stringify(scan)};
   if(await setCloudSnapshot(email,encryptCloudPayload(JSON.stringify(next)),record?.revision??null))return scan;
  }
  throw Error('Administratie is tegelijk gewijzigd. Probeer synchroniseren opnieuw.');
 }finally{await cloudCommand(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end; return 0",1,lock,token]);}
}
