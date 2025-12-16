import React, { useState, useEffect } from "react";
import { useConsentCookie } from "./useConsentCookie";

export const CookieSettings: React.FC = () => {
  const { consent, saveConsent } = useConsentCookie();
  const [analytics, setAnalytics] = useState<boolean>(false);

  useEffect(() => {
    if (consent) setAnalytics(consent.analytics);
  }, [consent]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-100 shadow">
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold">Cookie-instellingen</p>
        <span className="text-[11px] text-slate-400">
          {consent ? `Laatst opgeslagen: ${new Date(consent.ts).toLocaleString()}` : "Nog niet gekozen"}
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm text-slate-200">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={analytics}
            onChange={(e) => setAnalytics(e.target.checked)}
            className="h-4 w-4 rounded border-slate-500"
          />
          Analytics toestaan
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => saveConsent(false)}
          className="rounded-lg border border-slate-500 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-slate-300"
        >
          Alleen functioneel
        </button>
        <button
          type="button"
          onClick={() => saveConsent(analytics)}
          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-emerald-400"
        >
          Opslaan
        </button>
      </div>
    </div>
  );
};
