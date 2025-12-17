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
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleDownload = () => {
    if (typeof window === "undefined") return;
    const blob = new Blob([JSON.stringify(collectSnapshot(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moneylith-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportStatus("Back-up gedownload.");
  };

  const handleImportText = (text: string) => {
    if (typeof window === "undefined") return;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("Ongeldig formaat");
      }
      Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
        if (!isExportableKey(key)) return;
        window.localStorage.setItem(key, JSON.stringify(value));
      });
      setImportStatus("Import voltooid. Pagina wordt ververst...");
      setImportError(null);
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
      handleImportText(text);
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
          <p className="text-[11px] text-slate-400">
            Geen geheimen of sessies, alleen de lokale planner-data.
          </p>
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
          {importStatus && <p className="text-[11px] text-emerald-300">{importStatus}</p>}
          {importError && <p className="text-[11px] text-red-300">{importError}</p>}
        </div>
      </div>
    </div>
  );
}
