import {useEffect,useLayoutEffect,useState} from 'react';
import type {ApplicationLayoutProps} from '../components/ApplicationLayout';
import {NotificationCenter} from '../components/NotificationCenter';
import {CookieBanner} from '../components/CookieBanner';
import {AnalyticsGate} from '../components/AnalyticsGate';
import {Button,SurfaceCard} from '../components/WorkspaceUI';
import {MobileOverview,type MobileDestination} from './MobileOverview';
import {InstallApp} from '../pwa/InstallApp';
type View='home'|'content'|'notifications'|'more'|'guide';
const viewKey='moneylith.mobile.view';
function initialView():View {try{const value=sessionStorage.getItem(viewKey);return ['home','content','notifications','more','guide'].includes(value??'')?value as View:'home';}catch{return 'home';}}
export function MobileLayout(props:ApplicationLayoutProps&{onFull:()=>void}){
  const {mode,onPersonal,onBusiness,onLogin,onSettings,step,navigation,guide,children,overlays,mobile,onFull}=props;
  const [view,setView]=useState<View>(initialView),[unread,setUnread]=useState(0),[online,setOnline]=useState(navigator.onLine),[reconnected,setReconnected]=useState(false);
  const navigate=(page:MobileDestination)=>{mobile?.onNavigate(page);setView('content');};
  useLayoutEffect(()=>{window.scrollTo({top:0,behavior:'instant'});try{sessionStorage.setItem(viewKey,view);}catch{/* UI-only preference */}},[view,step]);
  useEffect(()=>{const off=()=>setOnline(false),on=()=>{setOnline(true);setReconnected(true);};window.addEventListener('offline',off);window.addEventListener('online',on);return()=>{window.removeEventListener('offline',off);window.removeEventListener('online',on);};},[]);
  const active=view==='content'?(step==='Patronen'?'spending':step==='Vooruitblik'?'forecast':'more'):view;
  return <main data-app-layout data-mobile-layout className="mobile-app min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-slate-50">
    <div className="mx-auto max-w-xl px-4 pb-28">
      <header className="mobile-header space-y-3 pb-5"><div className="flex items-center justify-between gap-3"><a href="/?app=1" className="text-lg font-semibold tracking-tight" onClick={e=>{e.preventDefault();setView('home');}}>Moneylith</a><button className="rounded-full border border-white/30 px-4 py-2 text-sm" onClick={()=>setView('guide')}>Vraag AI</button></div>
        <div data-mode-switch className="grid grid-cols-2 gap-1 rounded-full bg-white/10 p-1">{([['personal','Persoonlijk',onPersonal],['business','Zakelijk',onBusiness]] as const).map(([key,label,choose])=><button key={key} aria-pressed={mode===key} className={`rounded-full px-3 py-2 text-sm ${mode===key?'bg-white text-slate-950':'text-slate-300'}`} onClick={choose}>{label}</button>)}</div>
      </header>
      {!online&&<p role="status" className="mb-4 rounded-xl bg-amber-100 p-3 text-sm text-amber-950">Geen verbinding. Getoonde gegevens kunnen verouderd zijn. Bank, AI en accountopslag zijn nu niet bereikbaar.</p>}
      {online&&reconnected&&<div role="status" className="mb-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-900">Weer verbonden. Herlaad om je accountgegevens te synchroniseren. <Button onClick={()=>location.reload()}>Herlaad</Button></div>}
      <NotificationCenter key={mode} mode={mode} onLogin={()=>{onLogin?.();setView('content');}} hideTrigger expanded={view==='notifications'} onOpen={()=>setView('notifications')} onClose={()=>setView('home')} onUnread={setUnread}/>
      <section data-app-content className="min-w-0 space-y-4">
        {view==='home'&&(mobile?<MobileOverview input={mobile.input} bank={mobile.bank} onNavigate={navigate}/>:<SurfaceCard><p>Open een onderdeel om je administratie te bekijken.</p></SurfaceCard>)}
        {view==='content'&&<><h1 className="text-xl font-semibold">{step}</h1>{children}</>}
        {view==='guide'&&<><h1 className="text-xl font-semibold">Je AI-assistent</h1><div data-app-guide>{guide}</div></>}
        {view==='more'&&<><h1 className="text-xl font-semibold">Meer</h1><div className="flex flex-wrap gap-2"><Button onClick={()=>{onLogin?.();setView('content');}} disabled={!onLogin}>Mijn account</Button><Button onClick={()=>{onSettings();setView('content');}}>Instellingen</Button></div><InstallApp/><details className="rounded-xl border border-white/20 p-4"><summary className="cursor-pointer font-semibold">Over deze modus</summary><div className="mt-3">{props.banner}</div></details><details className="rounded-xl border border-white/20 p-4"><summary className="cursor-pointer font-semibold">Alle onderdelen</summary><nav aria-label="Onderdelen" className="mt-3 space-y-2" onClick={e=>{const button=(e.target as HTMLElement).closest('button');if(button&&!button.disabled)setView('content');}}>{navigation}</nav></details><Button onClick={onFull}>Volledige weergave</Button><div className="flex gap-4 text-xs text-slate-400"><a href="/privacy">Privacy</a><a href="/terms">Voorwaarden</a></div></>}
      </section>
    </div>
    <nav aria-label="Appnavigatie" className="mobile-bottom fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 backdrop-blur"><div className="mx-auto grid max-w-xl grid-cols-5">{([['home','Vandaag','◉',()=>setView('home')],['spending','Potjes','▥',()=>navigate('spending')],['forecast','Vooruit','↗',()=>navigate('forecast')],['notifications','Meldingen','◇',()=>setView('notifications')],['more','Meer','•••',()=>setView('more')]] as const).map(([key,label,icon,choose])=><button key={key} aria-current={active===key?'page':undefined} className={`relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] ${active===key?'text-amber-300':'text-slate-400'}`} onClick={choose}><span aria-hidden="true" className="text-lg leading-none">{icon}</span><span>{label}{key==='notifications'&&unread>0?` (${unread})`:''}</span></button>)}</div></nav>
    {overlays}<CookieBanner/><AnalyticsGate/>
  </main>;
}
