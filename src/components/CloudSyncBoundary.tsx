import { useEffect, useState, type ReactNode } from "react";
import { saveCloudChanges, startCloudSync, refreshCloudChanges, cloudSyncStatus } from "../storage/cloudSync";
let startup: Promise<boolean> | undefined;
export function CloudSyncBoundary({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [retry,setRetry]=useState(0);
  const [sync,setSync]=useState<Awaited<ReturnType<typeof cloudSyncStatus>>|null>(null);
  useEffect(() => {
    // The production owner account is not used by local or preview builds.
    if (window.location.hostname !== "www.moneylith.nl") { setReady(true); return; }
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    let lastRead=0, connected=false;
    const save = async () => {
      if(!connected)return;
      try {
        if (localStorage.getItem("moneylith.storage.mode") === '"local"') {
          if (alive) setStatus("Cloudopslag gepauzeerd: Local-first geselecteerd. Je banktoegang blijft ingelogd.");
          return;
        }
        if(document.visibilityState==='visible'&&Date.now()-lastRead>30000){
          if(await refreshCloudChanges()&&alive){setStatus('Administratie bijgewerkt vanaf je account.');setError(false);}
          lastRead=Date.now();
        }
        if (await saveCloudChanges() && alive) {
          setStatus(`Laatste cloudopslag: ${new Date().toLocaleTimeString("nl-NL")} · nieuwe wijzigingen worden elke vijf seconden gecontroleerd.`);
          setError(false);
        }
        if(alive)setSync(await cloudSyncStatus());
      } catch (e) {
        if(alive)setSync(await cloudSyncStatus().catch(()=>null));
        lastRead=Date.now();
        if (alive) { setStatus(e instanceof Error ? e.message : "Cloudopslag mislukt."); setError(true); }
      }
    };
    const resume=()=>{if(document.visibilityState==='visible'){lastRead=0;void save();}};
    const localChange=()=>{void cloudSyncStatus().then(s=>{if(alive)setSync(s);});};
    const storageError=(e:Event)=>{if(alive){setStatus(String((e as CustomEvent).detail));setError(true);}};
    window.addEventListener('moneylith:local-change',localChange);
    window.addEventListener('moneylith:storage-error',storageError);
    window.addEventListener('online',resume);
    window.addEventListener('focus',resume);
    document.addEventListener('visibilitychange',resume);
    startup ??= startCloudSync();
    void startup.then(active => {
      if (!alive) return;
      if (active) {
        void cloudSyncStatus().then(s=>{if(alive)setSync(s);});
        connected=true;
        setStatus("Moneylith-account verbonden · wijzigingen worden automatisch opgeslagen.");
        timer = setInterval(() => void save(), 5000);
      }
      setReady(true);
    }).catch(e => {
      if (!alive) return;
      startup=undefined;
      setError(true); setStatus(e instanceof Error ? e.message : "Cloudopslag is niet bereikbaar."); setReady(true);
    });
    return () => { window.removeEventListener('moneylith:local-change',localChange);window.removeEventListener('moneylith:storage-error',storageError);window.removeEventListener('online',resume);alive = false; if (timer) clearInterval(timer); window.removeEventListener('focus',resume); document.removeEventListener('visibilitychange',resume); };
  }, [retry]);
  if (!ready) return <div className="p-6 text-slate-100" role="status">Je administratie laden…</div>;
  return <>
    {status && <div data-cloud-status role={error ? "alert" : "status"} className={`px-4 py-2 text-sm ${error ? "bg-amber-100 text-amber-950" : "bg-slate-800 text-slate-100"}`}>{status}{error&&<button className="ml-3 underline" onClick={()=>{startup=undefined;setRetry(n=>n+1);}}>Verbinding opnieuw proberen</button>}</div>}
    {sync?.connected&&<div className="flex flex-wrap gap-x-4 gap-y-1 bg-slate-800 px-4 pb-2 text-xs text-slate-200" data-sync-detail><span>{sync.saving?'Bezig met opslaan':sync.pending?'Lokale wijzigingen wachten op cloudopslag':'Geen lokale wijzigingen in wachtrij'}</span><span>Laatste cloudopslag op dit apparaat: {sync.lastSavedAt?new Date(sync.lastSavedAt).toLocaleString('nl-NL'):'nog geen nieuwe opslag deze sessie'}</span>{sync.loadedAt&&<span>Cloudgegevens geladen: {new Date(sync.loadedAt).toLocaleString('nl-NL')}</span>}</div>}
    {children}
  </>;
}
