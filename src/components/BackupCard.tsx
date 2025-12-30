import { useState } from "react";

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
    const val = window.localStorage.getItem(key);
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

  const handleDownload = async () => {
    if (typeof window === "undefined") return;
    const snapshot = collectSnapshot();
    const raw = JSON.stringify(snapshot, null, 2);
    const keys = Object.keys(snapshot).length;
    const sizeKb = Math.max(1, Math.round(raw.length / 1024));
    let filePayload = raw;
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
    setExportInfo(`Bevat ${keys} sleutel(s), ~${sizeKb} KB${nameSuffix ? " (versleuteld)" : ""}.`);
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
        window.localStorage.setItem(key, JSON.stringify(value));
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
    </div>
  );
}
