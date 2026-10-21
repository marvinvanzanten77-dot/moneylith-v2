import { useEffect, useState, type ReactNode } from "react";
import { saveCloudChanges, startCloudSync } from "../storage/cloudSync";
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
    const save = async () => {
      try {
        if (localStorage.getItem("moneylith.storage.mode") === '"local"') {
          if (alive) setStatus("Cloudopslag gepauzeerd: Local-first geselecteerd. Je banktoegang blijft ingelogd.");
          return;
        }
        if (await saveCloudChanges() && alive) {
          setStatus(`Laatste cloudopslag: ${new Date().toLocaleTimeString("nl-NL")} · nieuwe wijzigingen worden elke vijf seconden gecontroleerd.`);
          setError(false);
        }
      } catch (e) {
        if (timer) clearInterval(timer);
        if (alive) { setStatus(e instanceof Error ? e.message : "Cloudopslag mislukt."); setError(true); }
      }
    };
    startup ??= startCloudSync();
    void startup.then(active => {
      if (!alive) return;
      if (active) {
        setStatus("Moneylith-account verbonden · wijzigingen worden automatisch opgeslagen.");
        timer = setInterval(() => void save(), 5000);
      }
      setReady(true);
    }).catch(e => {
      if (!alive) return;
      setError(true); setStatus(e instanceof Error ? e.message : "Cloudopslag is niet bereikbaar."); setReady(true);
    });
    return () => { alive = false; if (timer) clearInterval(timer); };
  }, []);
  if (!ready) return <div className="p-6 text-slate-100" role="status">Je administratie laden…</div>;
  return <>
    {status && <div role={error ? "alert" : "status"} className={`px-4 py-2 text-sm ${error ? "bg-amber-100 text-amber-950" : "bg-slate-800 text-slate-100"}`}>{status}</div>}
    {children}
  </>;
}
