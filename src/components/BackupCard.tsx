import { useMemo, useState } from "react";
import { persistGateway } from "../storage/persistGateway";

const DENYLIST_PREFIXES = ["sentry", "__sentry", "vercel", "vite", "react-devtools"];
const DENYLIST_EXACT = ["moneylith_consent"];

const isExportableKey = (key: string) =>
  !DENYLIST_EXACT.includes(key) && !DENYLIST_PREFIXES.some((prefix) => key.startsWith(prefix));

const safeParse = (val: string) => {
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
};

const collectSnapshot = () => {
  if (typeof window === "undefined") return {};
  const result: Record<string, unknown> = {};
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !isExportableKey(key)) continue;
      const val = persistGateway.get(key);
    if (val === null) continue;
    result[key] = safeParse(val);
  }
  return result;
};

export function BackupCard() {
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportInfo, setExportInfo] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<string | null>(null);
  const [encrypt, setEncrypt] = useState(false);
  const [password, setPassword] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [includePersonal, setIncludePersonal] = useState(true);
  const [includeBusiness, setIncludeBusiness] = useState(true);
  const [autoVersion, setAutoVersion] = useState(true);
  const [modules, setModules] = useState<Record<string, boolean>>({
    income: true,
    fixed: true,
    debts: true,
    assets: true,
    goals: true,
    accounts: true,
    statements: true,
    transactions: true,
  });
  const [versions, setVersions] = useState<
    { id: string; createdAt: string; keys: number; sizeKb: number; modules: string[]; data: string }[]
  >(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = persistGateway.get("moneylith.backup.versions");
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return [];
  });

  const deriveKey = async (pwd: string, salt: Uint8Array) => {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey("raw", enc.encode(pwd), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  };

  const encryptPayload = async (raw: string, pwd: string) => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(pwd, salt);
    const enc = new TextEncoder();
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(raw));
    return {
      encrypted: true,
      iv: Array.from(iv),
      salt: Array.from(salt),
      data: Array.from(new Uint8Array(cipher)),
      version: 1,
    };
  };

  const decryptPayload = async (obj: any, pwd: string) => {
    const { iv, salt, data } = obj || {};
    if (!Array.isArray(iv) || !Array.isArray(salt) || !Array.isArray(data)) throw new Error("Ongeldig encrypted pakket");
    const key = await deriveKey(pwd, new Uint8Array(salt));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, key, new Uint8Array(data));
    return new TextDecoder().decode(plain);
  };

  const moduleLabels = useMemo(
    () => ({
      income: "Inkomen",
      fixed: "Vaste lasten",
      debts: "Schulden",
      assets: "Vermogen",
      goals: "Doelen",
      accounts: "Rekeningen",
      statements: "Afschriften",
      transactions: "Transacties/patronen",
    }),
    []
  );

  const shouldIncludeKey = (key: string) => {
    const lower = key.toLowerCase();
    const modeMatch =
      (includePersonal && lower.includes("personal")) ||
      (includeBusiness && lower.includes("business")) ||
      (!lower.includes("personal") && !lower.includes("business"));
    if (!modeMatch) return false;
    const activeModules = Object.entries(modules)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (activeModules.length === Object.keys(modules).length) return true;
    const patterns: Record<string, string[]> = {
      income: ["income", "inkomen"],
      fixed: ["fixed", "vaste", "cost"],
      debts: ["schuld", "debt"],
      assets: ["asset", "vermogen", "buffer"],
      goals: ["goal", "doel"],
      accounts: ["account", "rekening"],
      statements: ["statement", "afschrift"],
      transactions: ["transaction", "transactie", "bucket"],
    };
    return activeModules.some((m) => patterns[m]?.some((p) => lower.includes(p)));
  };

  const persistVersions = (next: typeof versions) => {
    setVersions(next);
    try {
      persistGateway.set("moneylith.backup.versions", next);
    } catch {
      /* ignore */
    }
  };

  const handleDownload = async () => {
    if (typeof window === "undefined") return;
    const snapshot = collectSnapshot();
    const filteredEntries = Object.entries(snapshot).filter(([key]) => shouldIncludeKey(key));
    const filteredSnapshot = Object.fromEntries(filteredEntries);
    const raw = JSON.stringify(snapshot, null, 2);
    const filteredRaw = JSON.stringify(filteredSnapshot, null, 2);
    const keys = Object.keys(filteredSnapshot).length || Object.keys(snapshot).length;
    const sizeKb = Math.max(1, Math.round(raw.length / 1024));
    let filePayload = filteredRaw;
    let nameSuffix = "";
    if (encrypt && password.trim()) {
      const encrypted = await encryptPayload(raw, password.trim());
      filePayload = JSON.stringify(encrypted, null, 2);
      nameSuffix = "-encrypted";
    }
    const blob = new Blob([filePayload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moneylith-backup${nameSuffix}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportStatus("Back-up gedownload.");
    const selectedModules = Object.entries(modules)
      .filter(([, v]) => v)
      .map(([k]) => moduleLabels[k] || k);
    setExportInfo(
      `Bevat ${keys} sleutel(s), ~${sizeKb} KB${nameSuffix ? " (versleuteld)" : ""}. Modules: ${
        selectedModules.length === Object.keys(modules).length ? "alle" : selectedModules.join(", ")
      }.`
    );
    if (autoVersion) {
      const versionPayload = JSON.stringify(filteredSnapshot);
      const versionSizeKb = Math.max(1, Math.round(versionPayload.length / 1024));
      const entry = {
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        keys,
        sizeKb: versionSizeKb,
        modules: selectedModules,
        data: versionPayload,
      };
      const next = [entry, ...versions].slice(0, 3);
      persistVersions(next);
    }
  };

  const handleImportText = async (text: string) => {
    if (typeof window === "undefined") return;
    const confirmImport = window.confirm("Import overschrijft huidige gegevens. Doorgaan?");
    if (!confirmImport) return;
    try {
      let parsed = JSON.parse(text);
      if (parsed && parsed.encrypted) {
        if (!importPassword.trim()) throw new Error("Wachtwoord vereist voor versleutelde back-up.");
        const plain = await decryptPayload(parsed, importPassword.trim());
        parsed = JSON.parse(plain);
      }
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("Ongeldig formaat");
      }
      Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
        if (!isExportableKey(key)) return;
        persistGateway.set(key, value);
      });
      setImportStatus("Import voltooid. Pagina wordt ververst...");
      setImportError(null);
      setImportPreview(null);
      setTimeout(() => window.location.reload(), 400);
    } catch (err) {
      console.error(err);
      setImportError("Import mislukt. Controleer het JSON-bestand.");
      setImportStatus(null);
    }
  };

  const handleImportFile = async (file?: File | null) => {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        const previewKeys = parsed && typeof parsed === "object" ? Object.keys(parsed).length : 0;
        setImportPreview(`Voorbeeld: ${previewKeys} sleutel(s) gevonden. ${parsed?.encrypted ? "Versleuteld bestand." : "Niet-versleuteld."}`);
      } catch {
        setImportPreview("Kon geen voorvertoning maken (geen geldig JSON).");
      }
      await handleImportText(text);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-100">
        <div>
          <h3 className="text-base font-semibold text-slate-50">Export</h3>
          <p className="text-[11px] text-slate-400">
            Exporteer al je lokale planner-gegevens (persoonlijk + zakelijk, inclusief handmatige invoer).
          </p>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-lg bg-white/90 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-white"
          >
            Download JSON-back-up
          </button>
          <div className="flex flex-wrap gap-3 text-[11px] text-slate-300">
            <label className="inline-flex items-center gap-1">
              <input type="checkbox" checked={includePersonal} onChange={(e) => setIncludePersonal(e.target.checked)} />
              Persoonlijk
            </label>
            <label className="inline-flex items-center gap-1">
              <input type="checkbox" checked={includeBusiness} onChange={(e) => setIncludeBusiness(e.target.checked)} />
              Zakelijk
            </label>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
            {Object.keys(modules).map((m) => (
              <label key={m} className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={modules[m]}
                  onChange={(e) => setModules((prev) => ({ ...prev, [m]: e.target.checked }))}
                />
                {moduleLabels[m] || m}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} />
            Versleutelen met wachtwoord
            <span title="Encryptie: de back-up wordt met AES-GCM versleuteld. Je hebt het wachtwoord nodig om te herstellen.">
              ?
            </span>
          </label>
          {encrypt && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-50"
              placeholder="Wachtwoord voor encryptie"
            />
          )}
          <p className="text-[11px] text-slate-400">
            Geen geheimen of sessies, alleen de lokale planner-data.
          </p>
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={autoVersion} onChange={(e) => setAutoVersion(e.target.checked)} />
            Automatische versie opslaan bij export (max 3)
          </label>
          {exportInfo && <p className="text-[11px] text-slate-300">{exportInfo}</p>}
          {exportStatus && <p className="text-[11px] text-emerald-300">{exportStatus}</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-100">
        <div>
          <h3 className="text-base font-semibold text-slate-50">Import</h3>
          <p className="text-[11px] text-slate-400">
            Herstel een eerder gemaakte JSON-back-up. Dit overschrijft je huidige lokale gegevens.
          </p>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-[11px] text-slate-300">
            Kies JSON-bestand
            <input
              type="file"
              accept="application/json"
              className="text-xs text-slate-200"
              onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
              disabled={importing}
            />
          </label>
          <input
            type="password"
            value={importPassword}
            onChange={(e) => setImportPassword(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-50"
            placeholder="Wachtwoord voor versleutelde back-up (indien van toepassing)"
          />
          {importPreview && <p className="text-[11px] text-slate-300">{importPreview}</p>}
          {importStatus && <p className="text-[11px] text-emerald-300">{importStatus}</p>}
          {importError && <p className="text-[11px] text-red-300">{importError}</p>}
        </div>
      </div>

      {versions.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-100">
          <div className="mb-2">
            <h3 className="text-base font-semibold text-slate-50">Versies (laatste 3)</h3>
            <p className="text-[11px] text-slate-400">Automatisch opgeslagen bij export. Selecteer om te herstellen.</p>
          </div>
          <div className="space-y-2">
            {versions.map((v) => (
              <div key={v.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-[11px] text-slate-300">
                <div className="flex items-center justify-between">
                  <span>{new Date(v.createdAt).toLocaleString()}</span>
                  <span>{v.sizeKb} KB</span>
                </div>
                <div className="text-slate-400">Modules: {v.modules.length ? v.modules.join(", ") : "alle"}</div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-100 hover:border-amber-400"
                    onClick={() => setImportPreview(`Bevat ${v.keys} sleutel(s), ${v.sizeKb} KB, modules: ${v.modules.join(", ") || "alle"}.`)}
                  >
                    Bekijken
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-amber-400"
                    onClick={() => handleImportText(v.data)}
                  >
                    Herstel versie
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
