import {BankScanButton} from '../pwa/BankScanButton';
import {PushSettings} from '../pwa/PushSettings';
import {useEffect,useRef,useState} from 'react';
import {cloudRequest} from '../storage/cloudSync';
import type {MonitoringState,MonitoringAction,Notice} from '../monitoring/engine';
import {Button,SurfaceCard} from './WorkspaceUI';
import {TurnstileWidget} from './TurnstileWidget';

const date=(value:string|null)=>value?new Date(value).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam',dateStyle:'short',timeStyle:'short'}):'Nog niet bekend';
export function NotificationCenter({mode,onLogin,hideTrigger=false,expanded,onOpen,onClose,onUnread}:{mode:'personal'|'business';onLogin?:()=>void;hideTrigger?:boolean;expanded?:boolean;onOpen?:()=>void;onClose?:()=>void;onUnread?:(count:number)=>void}){
  const [history,setHistory]=useState(false),[limit,setLimit]=useState(10);
  const [open,setOpen]=useState(()=>new URLSearchParams(location.search).get('view')==='notifications'),[data,setData]=useState<MonitoringState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[toast,setToast]=useState('');
  const isOpen=expanded??open;
  const show=()=>onOpen?onOpen():setOpen(true);
  const close=()=>onClose?onClose():setOpen(false);
  const alive=useRef(true),running=useRef(false),known=useRef<Set<string>|null>(null);
  const local=()=>localStorage.getItem('moneylith.storage.mode')==='"local"'||location.hostname!=='www.moneylith.nl';
  const refresh=async(update?:MonitoringAction)=>{
    if(mode!=='personal'||local()||running.current)return;
    running.current=true;if(alive.current)setBusy(true);
    try{
      const result=await cloudRequest('monitoring','POST',update?{update}:{});
      if(!alive.current)return;
      const next=result.monitoring as MonitoringState;
      const unread=next.notices.filter(n=>n.active&&!n.dismissedAt&&!n.readAt&&!next.preferences.mutedLabels.includes(n.label));
      const fresh=unread.filter(n=>!known.current?.has(n.id));
      if(fresh.length)setToast(`${fresh.length} ${fresh.length===1?'melding staat':'meldingen staan'} voor je klaar. Bekijk rustig wat bij je past.`);
      if(!unread.length)setToast('');
      known.current=new Set(next.notices.map(n=>n.id));
      setData(next);setError('');
    }catch(e){if(alive.current){setError(e instanceof Error?e.message:'Meldingen zijn nu niet bereikbaar.');setData(null);setToast('');}}
    finally{running.current=false;if(alive.current)setBusy(false);}
  };
  useEffect(()=>{
    alive.current=true;
    const check=()=>{if(document.visibilityState==='visible')void refresh();};
    check();const timer=setInterval(check,60000);
    document.addEventListener('visibilitychange',check);
    window.addEventListener('moneylith:cloud-saved',check);
    window.addEventListener('moneylith:cloud-restored',check);
    return()=>{alive.current=false;clearInterval(timer);document.removeEventListener('visibilitychange',check);window.removeEventListener('moneylith:cloud-saved',check);window.removeEventListener('moneylith:cloud-restored',check);};
    // ApplicationLayout mounts this component with a separate mode key.
  },[]);
  const visible=data?.notices.filter(n=>!n.dismissedAt&&!data.preferences.mutedLabels.includes(n.label))??[];
  const listed=visible.filter(n=>history||n.active);
  const unread=visible.filter(n=>n.active&&!n.readAt).length;
  useEffect(()=>{onUnread?.(unread);},[unread,onUnread]);
  return <div className="mb-4 space-y-2" data-notification-center>
    {!hideTrigger&&<button type="button" className="rounded-lg border border-white/30 px-3 py-2 text-sm text-white hover:bg-white/10" aria-expanded={isOpen} aria-controls="moneylith-notifications" onClick={()=>isOpen?close():show()}>Meldingen{unread?` (${unread})`:''}</button>}
    {toast&&!isOpen&&mode==='personal'&&<div className="flex flex-wrap items-center gap-2 rounded-xl bg-purple-100 p-3 text-sm text-purple-950"><p role="status">{toast}</p><button className="underline" onClick={show}>Bekijken</button><button className="underline" onClick={()=>setToast('')}>Sluiten</button></div>}
    {isOpen&&<SurfaceCard id="moneylith-notifications" className="space-y-4" role="region" aria-label="Meldingencentrum">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">Een beetje hulp onderweg</h2><Button onClick={close}>Sluiten</Button></div>
      {mode==='business'?<p className="text-sm">Uitgavenmonitoring is nu beschikbaar in Persoonlijk. Je persoonlijke meldingen worden hier niet getoond.</p>:local()?<p className="text-sm">Meldingen horen bij je Moneylith-account. Kies accountopslag bij Instellingen en log in op moneylith.nl om je meldingen op al je apparaten te gebruiken.</p>:<>
        <p className="text-sm text-slate-600">We kijken naar je opgeslagen aankopen en budgetten. Jij kiest waarop je wilt letten en of je meldingen op dit apparaat wilt ontvangen.</p>
        {error&&<div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm"><p>{error}</p><div className="mt-2 flex gap-2"><Button onClick={()=>void refresh()} disabled={busy}>Opnieuw proberen</Button>{!data&&onLogin&&<Button onClick={onLogin}>Inloggen</Button>}</div></div>}
        {!data&&!error&&<p role="status">Meldingen laden…</p>}
        {data&&<>
          <PushSettings/><BankScanButton/>
          <div className="rounded-xl bg-slate-50 p-3 text-sm"><p>{data.status}</p><p className="mt-1 text-xs text-slate-600">Gegevens opgehaald: {date(data.sourceFetchedAt)} · controle: {date(data.checkedAt)}. Ophalen bij Lunch Flow garandeert geen nieuwe verversing bij de bank.</p></div>
          <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={()=>void refresh({action:'preferences',enabled:!data.preferences.enabled,mutedLabels:data.preferences.mutedLabels})}>{data.preferences.enabled?'Monitoring pauzeren':'Monitoring hervatten'}</Button><Button disabled={busy} onClick={()=>void refresh()}>Meldingen verversen</Button></div>
          {!visible.some(n=>n.active)&&<p className="text-sm">Er zijn nu geen nieuwe signalen. Dat betekent niet dat alle uitgaven bekend of gecontroleerd zijn.</p>}
          {listed.slice(0,limit).map(n=><article key={n.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">{n.month} · {!n.active?'Niet meer actueel':n.readAt?'Gelezen':'Nieuw'}</p><h3 className="font-semibold">{n.title}</h3><p className="text-sm">{n.message}</p>
            <div className="flex flex-wrap gap-2">{!n.readAt&&<Button disabled={busy} onClick={()=>void refresh({action:'read',id:n.id})}>Gelezen</Button>}<Button disabled={busy} onClick={()=>void refresh({action:'dismiss',id:n.id})}>Afhandelen</Button>{n.kind!=='sync'&&<Button disabled={busy} onClick={()=>void refresh({action:'preferences',enabled:data.preferences.enabled,mutedLabels:[...data.preferences.mutedLabels,n.label]})}>Minder over dit potje</Button>}</div>
            {n.active&&n.kind!=='sync'&&data.preferences.enabled&&<NoticeAdvice key={n.id+n.updatedAt} notice={n}/>}
          </article>)}
          <div className="flex flex-wrap gap-2">{listed.length>limit&&<Button onClick={()=>setLimit(v=>v+10)}>Meer meldingen</Button>}{visible.some(n=>!n.active)&&<Button onClick={()=>setHistory(v=>!v)}>{history?'Alleen actuele signalen':'Eerdere signalen bekijken'}</Button>}</div>
          {!!data.preferences.mutedLabels.length&&<details><summary className="cursor-pointer text-sm">Gedempte potjes ({data.preferences.mutedLabels.length})</summary><div className="mt-2 space-y-2">{data.preferences.mutedLabels.map(label=><div key={label} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{label}</span><Button disabled={busy} onClick={()=>void refresh({action:'preferences',enabled:data.preferences.enabled,mutedLabels:data.preferences.mutedLabels.filter(l=>l!==label)})}>Weer melden</Button></div>)}</div></details>}
        </>}
      </>}
    </SurfaceCard>}
  </div>;
}
function NoticeAdvice({notice}:{notice:Notice}){
  const [content,setContent]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[token,setToken]=useState<string|null>(null);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const optional=import.meta.env?.VITE_TURNSTILE_OPTIONAL !== 'false' || !import.meta.env?.VITE_TURNSTILE_SITE_KEY;
  const ask=async()=>{
    if(busy)return;
    if(!optional&&!token){setError('Bevestig eerst de verificatie.');return;}
    const abort=new AbortController();controller.current=abort;setBusy(true);setError('');
    try{
      const r=await fetch('/api/moneylith/analyse',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.signal,body:JSON.stringify({scope:'personal',purpose:'monitoring-coach',noticeId:notice.id,turnstileToken:token??undefined})});
      const body=await r.json();if(!r.ok||body.scope!=='personal'||typeof body.content!=='string'||!body.content.trim())throw Error(body.error||'De AI is nu niet bereikbaar.');
      if(!abort.signal.aborted)setContent(body.content);
    }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'De AI is nu niet bereikbaar.');}
    finally{if(!abort.signal.aborted){setBusy(false);setToken(null);}}
  };
  return <div className="space-y-2 border-t border-slate-100 pt-2">{content&&<p role="status" className="whitespace-pre-line rounded-lg bg-purple-50 p-3 text-sm">{content}</p>}{error&&<p role="alert" className="text-sm text-amber-900">{error}</p>}{!optional&&<TurnstileWidget siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY??''} onVerify={setToken} theme="light"/>}<Button disabled={busy} onClick={()=>void ask()}>{busy?'De AI denkt mee…':content?'Een ander idee vragen':'AI: help me een kleine stap te kiezen'}</Button></div>;
}
