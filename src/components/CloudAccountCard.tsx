import { useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { persistGateway } from "../storage/persistGateway";

type AuthMode = "login" | "register";

export function CloudAccountCard() {
  const cloudEnabled = import.meta.env.VITE_CLOUD_AUTH_ENABLED !== "false";
  const [mode, setMode] = useState<AuthMode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [cloudEmail, setCloudEmail] = useLocalStorage<string | null>("moneylith.cloud.account.email", null);

  const canAuth = useMemo(() => cloudEnabled && !loading, [cloudEnabled, loading]);

  const readSession = async () => {
    if (!cloudEnabled) return;
    const resp = await fetch("/api/cloud?action=session", { method: "GET" });
    const data = (await resp.json().catch(() => ({}))) as { authenticated?: boolean; email?: string | null };
    setAuthenticated(Boolean(resp.ok && data.authenticated));
    setCloudEmail(resp.ok && data.email ? data.email : null);
  };

  useEffect(() => {
    void readSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const collectLocalSnapshot = () => {
    const denyPrefixes = ["sentry", "__sentry", "vercel", "vite", "react-devtools"];
    const denyExact = ["moneylith_consent"];
    const result: Record<string, unknown> = {};
    if (typeof window === "undefined") return result;
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (denyExact.includes(key) || denyPrefixes.some((p) => key.startsWith(p))) continue;
      const raw = persistGateway.get(key);
      if (raw === null) continue;
      try {
        result[key] = JSON.parse(raw);
      } catch {
        result[key] = raw;
      }
    }
    return result;
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setStatus("Vul e-mail en wachtwoord in.");
      return;
    }
    if (!cloudEnabled) {
      setStatus("Cloud account staat nog in beta. Binnenkort beschikbaar.");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`/api/cloud?action=${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string; email?: string };
      if (!resp.ok || !data.ok) {
        setStatus(data.error || "Cloud auth mislukt.");
        return;
      }
      setCloudEmail(data.email || email.trim().toLowerCase());
      setAuthenticated(true);
      setStatus(mode === "register" ? "Account aangemaakt." : "Ingelogd.");
      setPassword("");
    } catch {
      setStatus("Cloud auth mislukt.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCloud = async () => {
    if (!authenticated) {
      setStatus("Log eerst in.");
      return;
    }
    setLoading(true);
    try {
      const state = collectLocalSnapshot();
      const resp = await fetch("/api/cloud?action=snapshot", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
      const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      setStatus(resp.ok && data.ok ? "Cloud backup opgeslagen." : data.error || "Cloud backup mislukt.");
    } catch {
      setStatus("Cloud backup mislukt.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadCloud = async () => {
    if (!authenticated) {
      setStatus("Log eerst in.");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch("/api/cloud?action=snapshot", { method: "GET" });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        state?: Record<string, unknown>;
      };
      if (!resp.ok || !data.ok || !data.state || typeof data.state !== "object") {
        setStatus(data.error || "Cloud restore mislukt.");
        return;
      }
      Object.entries(data.state).forEach(([key, value]) => persistGateway.set(key, value));
      setStatus("Cloud restore voltooid. Pagina wordt herladen...");
      setTimeout(() => window.location.reload(), 300);
    } catch {
      setStatus("Cloud restore mislukt.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch("/api/cloud?action=logout", { method: "POST" });
      setAuthenticated(false);
      setCloudEmail(null);
      setStatus("Uitgelogd.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-100">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-50">Cloud account (beta)</h3>
          <p className="text-[11px] text-slate-400">
            Optionele tweede modus naast local-first. Data blijft local-first; cloud sync is opt-in.
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            cloudEnabled ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"
          }`}
        >
          {cloudEnabled ? "Enabled" : "Binnenkort"}
        </span>
      </div>

      <div className="mt-3 flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`rounded-full px-3 py-1 ${mode === "register" ? "bg-slate-100 text-slate-900" : "bg-slate-800 text-slate-300"}`}
        >
          Registreren
        </button>
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`rounded-full px-3 py-1 ${mode === "login" ? "bg-slate-100 text-slate-900" : "bg-slate-800 text-slate-300"}`}
        >
          Inloggen
        </button>
      </div>

      <div className="mt-3 grid gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Wachtwoord"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canAuth}
          className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400"
        >
          {loading ? "Bezig..." : mode === "register" ? "Account aanmaken" : "Inloggen"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleSaveCloud()}
          disabled={!authenticated || loading}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] text-slate-100 disabled:opacity-50"
        >
          Backup naar cloud
        </button>
        <button
          type="button"
          onClick={() => void handleLoadCloud()}
          disabled={!authenticated || loading}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] text-slate-100 disabled:opacity-50"
        >
          Herstel uit cloud
        </button>
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={!authenticated || loading}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] text-slate-100 disabled:opacity-50"
        >
          Uitloggen
        </button>
      </div>

      {cloudEmail && <p className="mt-2 text-[11px] text-slate-300">Actief account: {cloudEmail}</p>}
      {status && <p className="mt-2 text-[11px] text-amber-200">{status}</p>}
      <p className="mt-2 text-[10px] text-slate-500">
        Snapshot wordt versleuteld opgeslagen; toegang is user-scoped via sessiecookie.
      </p>
    </div>
  );
}
