import { useEffect, useState, type ReactNode } from "react";
import { saveCloudChanges, startCloudSync, refreshCloudChanges } from "../storage/cloudSync";
let startup: Promise<boolean> | undefined;
export function CloudSyncBoundary({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
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
      } catch (e) {
        lastRead=Date.now();
        if (alive) { setStatus(e instanceof Error ? e.message : "Cloudopslag mislukt."); setError(true); }
      }
    };
    const resume=()=>{if(document.visibilityState==='visible'){lastRead=0;void save();}};
    window.addEventListener('focus',resume);
    document.addEventListener('visibilitychange',resume);
    startup ??= startCloudSync();
    void startup.then(active => {
      if (!alive) return;
      if (active) {
        connected=true;
        setStatus("Moneylith-account verbonden · wijzigingen worden automatisch opgeslagen.");
        timer = setInterval(() => void save(), 5000);
      }
      setReady(true);
    }).catch(e => {
      if (!alive) return;
      setError(true); setStatus(e instanceof Error ? e.message : "Cloudopslag is niet bereikbaar."); setReady(true);
    });
    return () => { alive = false; if (timer) clearInterval(timer); window.removeEventListener('focus',resume); document.removeEventListener('visibilitychange',resume); };
  }, []);
  if (!ready) return <div className="p-6 text-slate-100" role="status">Je administratie laden…</div>;
  return <>
    {status && <div data-cloud-status role={error ? "alert" : "status"} className={`px-4 py-2 text-sm ${error ? "bg-amber-100 text-amber-950" : "bg-slate-800 text-slate-100"}`}>{status}</div>}
    {children}
  </>;
}
