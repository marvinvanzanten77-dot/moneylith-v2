import {createHash,randomUUID} from 'node:crypto';
import {cloudCommand} from '../utils/cloudStore.js';
import {encryptCloudPayload,decryptCloudPayload} from '../utils/cloudAuth.js';
import {BunqClient,BunqError,type BunqStore,type BunqContext} from './client.js';
/** Server-only encrypted credentials; never part of a downloadable financial snapshot. */
export async function withBunq<T>(email:string,operation:(client:BunqClient)=>Promise<T>){
 if(!process.env.BUNQ_API_KEY?.trim())throw new BunqError('configuration','bunq is nog niet ingesteld. Voeg BUNQ_API_KEY toe aan de beveiligde serverconfiguratie.');
 if(process.env.VERCEL_ENV&&process.env.VERCEL_ENV!=='production')throw new BunqError('forbidden','De persoonlijke bunq-koppeling is niet beschikbaar op previewdeployments.');
 const name='ml:bunq:'+createHash('sha256').update(email).digest('hex'),lock=name+':lock',token=randomUUID();
 if(await cloudCommand(['SET',lock,token,'NX','EX',300])!=='OK')throw new BunqError('provider','Een bunq-controle loopt al. Probeer straks opnieuw.');
 const store:BunqStore={async load(){const raw=await cloudCommand(['GET',name]);return typeof raw==='string'?JSON.parse(decryptCloudPayload(raw)) as BunqContext:null;},async save(context){await cloudCommand(['SET',name,encryptCloudPayload(JSON.stringify(context))]);}};
 try{return await operation(new BunqClient(process.env.BUNQ_API_KEY,store));}finally{await cloudCommand(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end; return 0",1,lock,token]);}
}
