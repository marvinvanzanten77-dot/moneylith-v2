import {generateKeyPairSync,randomUUID,sign,verify,createHash} from 'node:crypto';
import type {LunchAccount,LunchTransaction,LunchSnapshot,LunchFailure} from '../../src/bank/lunchflowTypes.js';
export type BunqContext={keyHash:string;privateKey:string;publicKey:string;installationToken?:string;serverKey?:string;deviceRegistered?:boolean;sessionToken?:string;userId?:string};
export interface BunqStore {load():Promise<BunqContext|null>;save(context:BunqContext):Promise<void>}
export class BunqError extends Error {constructor(public code:LunchFailure['code'],message:string,public status?:number){super(message);}}
export const bunqFailure=(e:unknown):LunchFailure=>e instanceof BunqError?{code:e.code,message:e.message,httpStatus:e.status}:{code:'network',message:'bunq is niet bereikbaar. Eerdere gegevens blijven behouden.'};
const format=():never=>{throw new BunqError('format','Onverwacht bunq-responseformaat. Er is niets uit deze rekening geïmporteerd.');};
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:format();
const text=(v:unknown)=>typeof v==='string'?v:format();
const identifier=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0?String(v):format();
export function bunqMoney(value:unknown){
 const m=object(value),v=text(m.value);if(!/^-?\d+(?:\.\d{1,2})?$/.test(v)||! /^[A-Z]{3}$/.test(text(m.currency)))return format();
 const negative=v.startsWith('-'),[whole,fraction='']=v.replace('-','').split('.');const cents=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
 if(cents>BigInt(Number.MAX_SAFE_INTEGER))return format();return {amount:Number(negative?-cents:cents)/100,currency:text(m.currency)};
}
function rows(value:unknown){const r=object(value).Response;if(!Array.isArray(r))return format();return r.map(object);}
function item(value:unknown,key:string){const found=rows(value).find(r=>r[key]!==undefined);return found?object(found[key]):format();}
function bankObject(value:Record<string,unknown>){const key=Object.keys(value).find(k=>/^MonetaryAccount(Bank|Card|Joint|Savings)$/.test(k));return key?object(value[key]):null;}
export class BunqClient {
 private context:BunqContext|null=null;
 private deadline=Date.now()+100000;
 constructor(private key:string,private store:BunqStore,private request:typeof fetch=fetch,private environment:'production'|'sandbox'='production'){}
 private get base(){return this.environment==='production'?'https://api.bunq.com':'https://public-api.sandbox.bunq.com';}
 private async call(path:string,method:'GET'|'POST'='GET',body?:unknown,token?:string){
  // No payment-creation, account-edit or arbitrary upstream URL is exposed.
  if(method==='POST'&&!['/v1/installation','/v1/device-server','/v1/session-server'].includes(path))throw new BunqError('forbidden','Deze bunq-actie is niet toegestaan.');
  if(Date.now()>=this.deadline)throw new BunqError('network','bunq-controle duurde te lang; er is geen onvolledige rekening geïmporteerd.');
  const payload=body===undefined?'':JSON.stringify(body);
  const headers:Record<string,string>={'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache','User-Agent':'Moneylith/1.0','X-Bunq-Language':'nl_NL','X-Bunq-Region':'nl_NL','X-Bunq-Geolocation':'0 0 0 0 000','X-Bunq-Client-Request-Id':randomUUID()};
  if(token)headers['X-Bunq-Client-Authentication']=token;
  if(this.context&&path!=='/v1/installation')headers['X-Bunq-Client-Signature']=sign('RSA-SHA256',Buffer.from(payload),this.context.privateKey).toString('base64');
  let response:Response;try{response=await this.request(this.base+path,{method,headers,...(body===undefined?{}:{body:payload}),redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.min(30000,this.deadline-Date.now())))});}catch{throw new BunqError('network','Netwerkfout of time-out bij bunq. Probeer later opnieuw.');}
  const raw=await response.text();
  if(!response.ok){
   if(response.status===429)throw new BunqError('rate_limit','bunq-verzoeklimiet bereikt. Wacht en probeer later opnieuw.',429);
   if(response.status===401)throw new BunqError('invalid_key','bunq-sleutel of sessie ongeldig of verlopen. Controleer je API-sleutel.',401);
   if(response.status===403)throw new BunqError('forbidden','bunq weigert toegang. Controleer de API-sleutel en toegestane server-IP-adressen.',403);
   if(/ip address|ip_address|permitted.ip/i.test(raw))throw new BunqError('forbidden','Deze server heeft geen toegestaan bunq-IP-adres. Gebruik vaste uitgaande IP-adressen of een daarvoor geschikte bunq-sleutel.',response.status);
   throw new BunqError('provider','bunq weigert het verzoek. Controleer de sleutel en installatie in de bunq-app.',response.status);
  }
  let result:unknown;try{result=JSON.parse(raw);}catch{return format();}
  const serverKey=this.context?.serverKey??(path==='/v1/installation'?text(item(result,'ServerPublicKey').server_public_key):undefined);
  const signature=response.headers.get('x-bunq-server-signature');
  if(!serverKey||!signature||!verify('RSA-SHA256',Buffer.from(raw),serverKey,Buffer.from(signature,'base64')))throw new BunqError('format','De bunq-response kon niet cryptografisch worden gecontroleerd. Niets geïmporteerd.');
  rows(result);return result;
 }
 async initialize(){
  if(!this.key.trim())throw new BunqError('configuration','Vul BUNQ_API_KEY in .env.bunq.local in. De sleutel blijft uitsluitend op de server.');
  const hash=createHash('sha256').update(this.environment+this.key).digest('hex');this.context=await this.store.load();
  if(!this.context||this.context.keyHash!==hash){const pair=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});this.context={keyHash:hash,privateKey:pair.privateKey,publicKey:pair.publicKey};await this.store.save(this.context);}
  const c=this.context;
  if(!c.installationToken){const r=await this.call('/v1/installation','POST',{client_public_key:c.publicKey});c.installationToken=text(item(r,'Token').token);c.serverKey=text(item(r,'ServerPublicKey').server_public_key);await this.store.save(c);}
  if(!c.deviceRegistered){await this.call('/v1/device-server','POST',{description:'Moneylith gegevens uitlezen',secret:this.key,permitted_ips:[]},c.installationToken);c.deviceRegistered=true;await this.store.save(c);}
  if(!c.sessionToken)await this.session();
 }
 private async session(){const c=this.context!;const r=await this.call('/v1/session-server','POST',{secret:this.key},c.installationToken);c.sessionToken=text(item(r,'Token').token);const user=rows(r).find(v=>v.UserPerson||v.UserCompany);if(!user)return format();c.userId=identifier(object(user.UserPerson??user.UserCompany).id);await this.store.save(c);}
 private async get(path:string){if(!this.context)await this.initialize();try{return await this.call(path,'GET',undefined,this.context!.sessionToken);}catch(e){if(!(e instanceof BunqError)||e.status!==401)throw e;this.context!.sessionToken=undefined;await this.store.save(this.context!);await this.session();return this.call(path,'GET',undefined,this.context!.sessionToken);}}
 private async list(path:string){
  const collected:Record<string,unknown>[]=[],seen=new Set<string>();let next:string|null=path+'?count=200';
  while(next){if(seen.has(next)||seen.size>=200)throw new BunqError('format','bunq-paginering is onvolledig of te groot; deze rekening is niet geïmporteerd.');seen.add(next);
   const r=await this.get(next);collected.push(...rows(r));const paging=object(object(r).Pagination);const older=paging.older_url;if(older===null){next=null;continue;}if(typeof older!=='string')return format();
   const url=new URL(older,this.base);if(url.origin!==this.base||url.pathname!==path||url.username||url.password||url.hash||[...url.searchParams.keys()].some(k=>!['count','older_id','newer_id'].includes(k)))throw new BunqError('format','Onveilige bunq-paginalink geweigerd.');next=url.pathname+url.search;
  }return collected;
 }
 async accounts():Promise<LunchAccount[]>{
  if(!this.context)await this.initialize();const uid=this.context!.userId!;
  const found=(await this.list(`/v1/user/${uid}/monetary-account`)).flatMap(row=>{const a=bankObject(row);if(!a)return [];const id=identifier(a.id),aliases=Array.isArray(a.alias)?a.alias.map(object):[];const iban=aliases.find(v=>v.type==='IBAN')?.value;return [{id:uid+':'+id,label:`bunq ${text(a.description)} · ••••${typeof iban==='string'?iban.slice(-4):id.slice(-2)}`,institution:'bunq',currency:text(a.currency),status:text(a.status),upstream:'bunq',...(typeof iban==='string'?{iban}: {})}];});
  if(new Set(found.map(a=>a.id)).size!==found.length)return format();return found;
 }
 private accountPath(id:string){const [user,account]=id.split(':');if(user!==this.context?.userId||!/^\d+$/.test(account??'')||id!==user+':'+account)throw new BunqError('forbidden','Deze bunq-rekening hoort niet bij de actieve koppeling.');return `/v1/user/${user}/monetary-account/${account}`;}
 async balance(id:string){if(!this.context)await this.initialize();const r=await this.get(this.accountPath(id));const a=rows(r).map(bankObject).find(Boolean);if(!a||identifier(a.id)!==id.split(':')[1])return format();return bunqMoney(a.balance);}
 async transactions(id:string):Promise<LunchTransaction[]>{
  if(!this.context)await this.initialize();const raw=await this.list(this.accountPath(id)+'/payment');
  const found=raw.map(v=>{const t=object(v.Payment);if(identifier(t.monetary_account_id)!==id.split(':')[1])return format();const timestamp=text(t.created);const parsed=new Date(timestamp.replace(' ','T')+(/[zZ]|[+-]\d\d:\d\d$/.test(timestamp)?'':'Z'));if(!Number.isFinite(parsed.getTime()))return format();const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(parsed);
   const counter=object(t.counterparty_alias);return {id:identifier(t.id),accountId:id,...bunqMoney(t.amount),date,description:text(t.description),merchant:text(counter.display_name),counterpartyIban:typeof counter.iban==='string'?counter.iban:undefined,paymentSubType:text(t.sub_type)};
  });if(new Set(found.map(t=>t.id)).size!==found.length)return format();return found;
 }
 async snapshot(account:LunchAccount):Promise<LunchSnapshot>{
  const attempt=async<T>(fn:()=>Promise<T>)=>{try{return {ok:true as const,value:await fn()};}catch(e){return {ok:false as const,error:bunqFailure(e)};}};
  if(account.status!=='ACTIVE'){const error:LunchFailure={code:'reconnect',message:'Deze bunq-rekening is niet actief. Controleer de rekening in bunq.'};return {account,balance:{ok:false,error},transactions:{ok:false,error},fetchedAt:new Date().toISOString()};}
  const balance=await attempt(()=>this.balance(account.id));const transactions=await attempt(()=>this.transactions(account.id));return {account,balance,transactions,fetchedAt:new Date().toISOString()};
 }
}
