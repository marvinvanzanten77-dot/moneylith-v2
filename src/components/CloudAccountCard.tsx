import { useEffect, useState } from "react";
import { cloudRequest, loadCloudVersion, saveCloudChanges, stopCloudSync } from "../storage/cloudSync";
import { Button, Input } from "./WorkspaceUI";

type AuthMode = "login" | "register";
export function CloudAccountCard({ preferredAuthMode = null }: { preferredAuthMode?: AuthMode | null }) {
  const [mode, setMode] = useState<AuthMode>(preferredAuthMode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ownerCode, setOwnerCode] = useState("");
  const [activeEmail, setActiveEmail] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadAfterLogin, setLoadAfterLogin] = useState(true);
  useEffect(() => {
    let alive = true;
    void cloudRequest("session").then(data => {
      if (alive) setActiveEmail(data.authenticated ? data.email : null);
    }).catch(e => { if (alive) setStatus(e.message); });
    return () => { alive = false; };
  }, []);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setStatus("");
    try { await action(); } catch (e) { setStatus(e instanceof Error ? e.message : "Verzoek mislukt."); }
    finally { setBusy(false); }
  };
  return <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-100">
    <h3 className="text-base font-semibold">Je Moneylith-account</h3>
    <p className="mt-2 text-slate-300">Persoonlijke toegang tot je administratie en Lunch Flow. Na inloggen worden wijzigingen automatisch opgeslagen; op een ander apparaat laad je deze bij het openen van de app.</p>
    {activeEmail ? <>
      <p className="mt-3">Ingelogd als {activeEmail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void run(async () => { await saveCloudChanges(); setStatus("Lokale wijzigingen gecontroleerd voor opslag. Zie de opslagstatus bovenaan voor eventuele conflicten."); })}>Nu opslaan</Button>
        <Button disabled={busy} onClick={() => void run(loadCloudVersion)}>Cloudversie laden</Button>
        <Button disabled={busy} onClick={() => void run(async () => {
          try { await saveCloudChanges(); } catch { /* Local data and sync metadata remain available after logout. */ }
          await cloudRequest("logout", "POST"); stopCloudSync();
          window.location.reload();
        })}>Uitloggen</Button>
      </div>
      <p className="mt-2 text-xs text-slate-400">Cloudversie laden vervangt de lokale administratie en bewaart eerst een lokale herstelkopie. Uitloggen verwijdert geen gegevens van dit apparaat.</p>
    </> : <>
      <div className="mt-3 flex gap-2">
        <Button disabled={busy} onClick={() => setMode("login")}>Inloggen</Button>
        <Button disabled={busy} onClick={() => setMode("register")}>Account eenmalig activeren</Button>
      </div>
      <form className="mt-3 space-y-3" onSubmit={e => {
        e.preventDefault(); void run(async () => {
          await cloudRequest(mode, "POST", { email, password, ownerCode: mode === "register" ? ownerCode : undefined });
          localStorage.setItem("moneylith.storage.mode", '"cloud"');
          setPassword(""); setOwnerCode("");
          if (mode === "login" && loadAfterLogin) {
            const remote = await cloudRequest("snapshot");
            if (remote.state !== null) { await loadCloudVersion(); return; }
          }
          window.location.reload();
        });
      }}>
        <label className="block">E-mailadres<Input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required disabled={busy} /></label>
        <label className="block">Moneylith-wachtwoord<Input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={12} maxLength={256} value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} /></label>
        {mode === "register" && <>
          <label className="block">Persoonlijke testcode (eenmalig)<Input type="password" autoComplete="off" value={ownerCode} onChange={e => setOwnerCode(e.target.value)} disabled={busy} /></label>
          <p className="text-xs text-slate-300">Kies een nieuw Moneylith-wachtwoord van minimaal 12 tekens. Gebruik je bestaande persoonlijke testcode om eigenaarschap te bevestigen; dit veld mag leeg blijven als je banktesttoegang nog actief is. Je huidige administratie wordt daarna naar jouw account opgeslagen. Dit is geen publieke registratie.</p>
        </>}
        {mode === "login" && <label className="flex items-start gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={loadAfterLogin} onChange={e => setLoadAfterLogin(e.target.checked)} disabled={busy} />
          Cloudadministratie laden na inloggen. Je huidige lokale administratie wordt eerst als herstelkopie bewaard.
        </label>}
        <Button type="submit" disabled={busy}>{busy ? "Bezig…" : mode === "register" ? "Activeren en administratie verbinden" : "Inloggen op Moneylith"}</Button>
      </form>
    </>}
    {status && <p role="status" className="mt-3 text-amber-200">{status}</p>}
  </div>;
}
