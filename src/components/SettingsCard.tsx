import { useState } from "react";
import { persistGateway } from "../storage/persistGateway";

const APP_KEYS_PREFIXES = ["potje-", "schuldenplan-"];
const APP_KEYS_EXACT = [
  "schulden-lijst",
  "income-netto",
  "fixed-costs",
  "fixed-costs-list",
  "buffer-target",
  "buffer-current",
  "user-name",
  "user-email",
  "potjes-config",
];

export function SettingsCard() {
  const [exportData, setExportData] = useState("");
  const [importData, setImportData] = useState("");

  const shouldInclude = (key: string) => {
    if (APP_KEYS_EXACT.includes(key)) return true;
    return APP_KEYS_PREFIXES.some((prefix) => key.startsWith(prefix));
  };

  const gatherData = () => {
    const result: Record<string, unknown> = {};
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (!shouldInclude(key)) continue;
      const val = persistGateway.get(key);
      if (val !== null) {
        try {
          result[key] = JSON.parse(val);
        } catch {
          result[key] = val;
        }
      }
    }
    return result;
  };

  const handleExport = () => {
    if (typeof window === "undefined") return;
    const result = gatherData();
    setExportData(JSON.stringify(result, null, 2));
  };

  const handleDownload = () => {
    if (typeof window === "undefined") return;
    const result = gatherData();
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "planner-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (typeof window === "undefined") return;
    if (!importData.trim()) return;
    try {
      const parsed = JSON.parse(importData);
      if (typeof parsed !== "object" || parsed === null) return;
      Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
        if (!shouldInclude(key)) return;
        persistGateway.set(key, value);
      });
      window.location.reload();
    } catch {
      // ignore parse errors
    }
  };

  const handleReset = () => {
    if (typeof window === "undefined") return;
    const confirmReset = window.confirm(
      "Weet je zeker dat je alle planner-data wilt verwijderen?"
    );
    if (!confirmReset) return;

    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (APP_KEYS_EXACT.includes(key)) {
        keysToRemove.push(key);
        continue;
      }
      if (APP_KEYS_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }
    persistGateway.removeMany(keysToRemove);
    window.location.reload();
  };

  return (
    <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Bewaren & resetten</h2>
          <p className="text-xs text-slate-500">Bewaar eerst een kopie van je gegevens voordat je iets opruimt.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            Bewaar kopie
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center rounded-md bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-300"
          >
            Download bestand
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700"
          >
            Reset alles (met zorg)
          </button>
        </div>
      </div>

      {exportData && (
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Data-export (alleen lezen, kopieer met Ctrl+C)
          </label>
          <textarea
            className="w-full rounded-md border-slate-300 bg-slate-50 p-2 text-[11px] font-mono leading-snug"
            rows={8}
            readOnly
            value={exportData}
          />
        </div>
      )}

      <div className="mt-4">
        <label className="mb-1 block text-xs font-medium text-slate-700">
          Data terugzetten (plak je export hier)
        </label>
        <textarea
          className="w-full rounded-md border-slate-300 bg-white p-2 text-[11px] font-mono leading-snug"
          rows={6}
          value={importData}
          onChange={(e) => setImportData(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleImport}
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            Importeer
          </button>
          <p className="text-[11px] text-slate-500">Alleen de planner-gegevens worden teruggezet.</p>
        </div>
      </div>
    </div>
  );
}




