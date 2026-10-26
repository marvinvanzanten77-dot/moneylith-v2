import type {LunchMapping,mergeLunchflow} from '../bank/lunchflowMerge';
import type {LunchSnapshot} from '../bank/lunchflowTypes';
import {useState} from 'react';
import {Button,Select,SurfaceCard} from './WorkspaceUI';
import {cloudRequest,prepareCloudReload,refreshCloudChanges} from '../storage/cloudSync';
import type {MoneylithAccount} from '../types';
import type {LunchAccount} from '../bank/lunchflowTypes';
export function BunqCard({accounts,onApply}:{accounts:MoneylithAccount[];onApply:(snapshots:LunchSnapshot[],mappings:LunchMapping[])=>ReturnType<typeof mergeLunchflow>["reports"]}){
 const [remote,setRemote]=useState<LunchAccount[]>([]),[selection,setSelection]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false);
 const local=import.meta.env.DEV&&['localhost','127.0.0.1','[::1]'].includes(location.hostname);
 async function run(operation:'accounts'|'test'|'connect'){
  setBusy(true);setError(false);setMessage('');
  try{
   if(operation==='connect'&&!local){if(localStorage.getItem('moneylith.storage.mode')==='"local"')throw Error('Kies accountopslag bij Instellingen om bunq op al je apparaten te koppelen.');await prepareCloudReload();}
   const body={operation,mappings:Object.entries(selection).filter(([,v])=>!!v).map(([providerId,targetId])=>({providerId,targetId}))};
   const data=local?await (async()=>{const r=await fetch('/api/bunq',{method:'POST',headers:{'Content-Type':'application/json','X-Moneylith-Local':'1'},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'bunq-verzoek mislukt.');return d;})():await cloudRequest('bunq','POST',body);
   if(operation==='accounts'){setRemote(data.accounts);setSelection(Object.fromEntries((data.accounts as LunchAccount[]).map(a=>[a.id,accounts.find(m=>m.bankProvider==='bunq'&&m.bankAccountId===a.id)?.id??''])));setMessage('Kies per bunq-rekening een bestaande rekening of maak bewust een nieuwe aan.');}
   if(operation==='test'){const checks=data.diagnostic.checks as {balance:{ok:boolean};transactions:{ok:boolean;count?:number}}[];setError(!checks.length||checks.some(c=>!c.balance.ok||!c.transactions.ok));setMessage(checks.length?checks.map((c,i)=>`Rekening ${i+1}: saldo ${c.balance.ok?'geslaagd':'mislukt'}; betalingen ${c.transactions.ok?'geslaagd ('+c.transactions.count+')':'mislukt'}.`).join(' '):'Geen actieve bunq-rekeningen beschikbaar.');}
   if(operation==='connect'){if(local)data.reports=onApply(data.snapshots,body.mappings);else await refreshCloudChanges();setError(data.reports.some((r:{ok:boolean})=>!r.ok));setMessage(data.reports.map((r:{message:string;added:number;updated:number})=>`${r.message} ${r.added} nieuw, ${r.updated} bijgewerkt.`).join(' '));}
  }catch(e){setError(true);setMessage(e instanceof Error?e.message:'bunq is niet bereikbaar.');}finally{setBusy(false);}
 }
 return <SurfaceCard className="space-y-3" data-bunq><h2 className="text-xl font-semibold">bunq — directe koppeling</h2><p className="text-sm">Lees je bunq-saldo en geboekte betalingen uit via je beveiligde Moneylith-account. Kaartreserveringen worden niet als extra uitgaven geïmporteerd. Moneylith maakt geen betalingen aan.</p><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={()=>void run('test')}>bunq-verbinding testen</Button><Button disabled={busy} onClick={()=>void run('accounts')}>bunq-rekeningen ophalen</Button></div>
 {remote.map(a=><label key={a.id} className="block text-sm">{a.label} · {a.status}<Select aria-label={'Koppel '+a.label} disabled={busy||a.status!=='ACTIVE'} value={selection[a.id]??''} onChange={e=>setSelection({...selection,[a.id]:e.target.value})}><option value="">Niet koppelen</option><option value="new">Nieuwe Moneylith-rekening</option>{accounts.filter(m=>!m.bankProvider||(m.bankProvider==='bunq'&&m.bankAccountId===a.id)).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Select></label>)}
 {!!remote.length&&<Button disabled={busy||!Object.values(selection).some(Boolean)} onClick={()=>void run('connect')}>Geselecteerde rekeningen synchroniseren</Button>}
 {busy&&<p role="status">bunq controleren…</p>}{message&&<p role={error?'alert':'status'} className="text-sm">{message}</p>}<p className="text-xs">Na koppelen loopt bunq mee met de bestaande drie dagelijkse controles en de algemene synchronisatieknop. De API-sleutel vul je uitsluitend in de serverconfiguratie in.</p></SurfaceCard>;
}
