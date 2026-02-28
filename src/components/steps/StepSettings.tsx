import { CloudAccountCard } from "../CloudAccountCard";

type StorageMode = "local" | "cloud";

type StepSettingsProps = {
  storageMode: StorageMode;
  onStorageModeChange: (mode: StorageMode) => void;
  helpMode: boolean;
  onHelpModeChange: (enabled: boolean) => void;
  showModeBanner: boolean;
  onShowModeBannerChange: (enabled: boolean) => void;
  onResetIntro: () => void;
  onOpenBackup: () => void;
};

export function StepSettings({
  storageMode,
  onStorageModeChange,
  helpMode,
  onHelpModeChange,
  showModeBanner,
  onShowModeBannerChange,
  onResetIntro,
  onOpenBackup,
}: StepSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="card-shell p-4 text-slate-900">
        <h3 className="text-base font-semibold">Instellingen</h3>
        <p className="mt-1 text-sm text-slate-600">
          Kies hoe je Moneylith gebruikt en welke hulpfuncties actief zijn.
        </p>
      </div>

      <div className="card-shell p-4 text-slate-900 space-y-3">
        <h4 className="text-sm font-semibold">Opslag</h4>
        <div className="grid gap-2 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onStorageModeChange("local")}
            className={`rounded-xl border px-3 py-3 text-left transition ${
              storageMode === "local"
                ? "border-emerald-400 bg-emerald-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <p className="text-sm font-semibold text-slate-900">Local-first</p>
            <p className="text-xs text-slate-600">Data blijft lokaal in je browser (standaard).</p>
          </button>
          <button
            type="button"
            onClick={() => onStorageModeChange("cloud")}
            className={`rounded-xl border px-3 py-3 text-left transition ${
              storageMode === "cloud"
                ? "border-blue-400 bg-blue-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <p className="text-sm font-semibold text-slate-900">Cloud-opslag (beta)</p>
            <p className="text-xs text-slate-600">Login + versleutelde snapshot synchronisatie.</p>
          </button>
        </div>
        {storageMode === "cloud" && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
            <CloudAccountCard />
          </div>
        )}
      </div>

      <div className="card-shell p-4 text-slate-900 space-y-3">
        <h4 className="text-sm font-semibold">Gebruik</h4>
        <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
          <span className="text-sm text-slate-700">Hulpmodus (hover tips in sidebar)</span>
          <input
            type="checkbox"
            checked={helpMode}
            onChange={(e) => onHelpModeChange(e.target.checked)}
          />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
          <span className="text-sm text-slate-700">Toon modus-banner (persoonlijk/zakelijk)</span>
          <input
            type="checkbox"
            checked={showModeBanner}
            onChange={(e) => onShowModeBannerChange(e.target.checked)}
          />
        </label>
      </div>

      <div className="card-shell p-4 text-slate-900 space-y-2">
        <h4 className="text-sm font-semibold">Snelacties</h4>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenBackup}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-slate-400"
          >
            Open backup
          </button>
          <button
            type="button"
            onClick={onResetIntro}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-slate-400"
          >
            Toon intro opnieuw
          </button>
        </div>
      </div>
    </div>
  );
}
