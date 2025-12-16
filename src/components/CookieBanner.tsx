import React from "react";
import { useConsentCookie } from "./useConsentCookie";

export const CookieBanner: React.FC = () => {
  const { consent, saveConsent } = useConsentCookie();
  if (consent) return null;

  return (
    <div className="fixed inset-x-0 bottom-3 z-50 flex justify-center px-3">
      <div className="max-w-4xl flex-1 rounded-2xl border border-white/15 bg-slate-900/90 p-4 text-sm text-slate-100 shadow-lg shadow-slate-900/40 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="font-semibold text-white">Cookies & toestemming</p>
            <p className="text-slate-300">
              Moneylith gebruikt functionele cookies. Analytics alleen met toestemming.
              <span className="ml-2">
                <a className="underline hover:text-white" href="/cookies">Cookies</a> ·{" "}
                <a className="underline hover:text-white" href="/privacy">Privacy</a>
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveConsent(false)}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-slate-300"
            >
              Alleen functioneel
            </button>
            <button
              type="button"
              onClick={() => saveConsent(true)}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-emerald-400"
            >
              Accepteer analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
