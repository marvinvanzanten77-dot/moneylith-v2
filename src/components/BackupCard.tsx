import { useState } from "react";

const ALLOWED_PREFIXES = [
  "moneylith.",
  "potje-",
  "schuldenplan-",
  "income-",
  "fixed-cost",
  "buffer-",
  "user-",
  "selected-month",
  "month-focus",
  "potjes-",
  "ai-",
];

const ALLOWED_EXACT = [
  "moneylith.ai.messages",
  "schulden-lijst",
  "potjes-config",
  "moneylith.personal.aiBuckets",
  "moneylith.personal.aiAnalysisRaw",
  "moneylith.personal.aiAnalysisDone",
  "moneylith.personal.aiAnalysisDoneAt",
  "moneylith.personal.bucket.overrides",
  "moneylith.business.bucket.overrides",
];

const isAllowedKey = (key: string) =>
  ALLOWED_EXACT.includes(key) || ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix));

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
    if (!key || !isAllowedKey(key)) continue;
    const val = window.localStorage.getItem(key);
    if (val === null) continue;
    result[key] = safeParse(val);
  }
  return result;
};

export function BackupCard() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    setStatus("Back-up gedownload.");
    setError(null);
  };

  const handleImportText = (text: string) => {
    if (typeof window === "undefined") return;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("Ongeldig formaat");
      }
      Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
        if (!isAllowedKey(key)) return;
        window.localStorage.setItem(key, JSON.stringify(value));
      });
      setStatus("Import voltooid. Pagina wordt ververst...");
      setError(null);
      setTimeout(() => window.location.reload(), 400);
    } catch (err) {
      console.error(err);
      setError("Import mislukt. Controleer het JSON-bestand.");
      setStatus(null);
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
    <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-50">Back-up & export</h3>
          <p className="text-[11px] text-slate-400">
            Exporteer je planner-gegevens (lokale opslag) of importeer een eerder gemaakte back-up.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-lg bg-white/90 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-white"
        >
          Download JSON-back-up
        </button>
        <label className="flex flex-col gap-1 text-[11px] text-slate-300">
          Herstel vanuit JSON
          <input
            type="file"
            accept="application/json"
            className="text-xs text-slate-200"
            onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
            disabled={importing}
          />
        </label>
        <p className="text-[11px] text-slate-400">
          Bevat alleen lokale planner-data (rekeningen, afschriften, potjes, AI-notities). Geen geheimen of sessies.
        </p>
      </div>

      {status && <p className="text-[11px] text-emerald-300">{status}</p>}
      {error && <p className="text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
