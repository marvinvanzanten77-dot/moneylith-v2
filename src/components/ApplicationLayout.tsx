import { useLayoutEffect, type ReactNode } from "react";
import { CookieBanner } from "./CookieBanner";
import { AnalyticsGate } from "./AnalyticsGate";

/** The personal application's frame, shared without mode-specific geometry or themes. */
export function ApplicationLayout({
  mode,
  onPersonal,
  onBusiness,
  onSettings,
  onLogin,
  navigation,
  step,
  banner,
  guide,
  children,
  overlays,
  guideTitle = "AI gids",
}: {
  mode: "personal" | "business";
  onPersonal: () => void;
  onBusiness: () => void;
  onSettings: () => void;
  onLogin?: () => void;
  navigation: ReactNode;
  step?: string;
  banner: ReactNode;
  guide: ReactNode;
  children: ReactNode;
  overlays?: ReactNode;
  guideTitle?: string;
}) {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [mode, step]);
  return (
    <main
      style={{ overflowAnchor: "none" }}
      data-app-layout
      className="min-h-screen text-slate-50 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950"
    >
      <div className="grid min-h-screen grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
        <aside
          data-app-sidebar
          className="px-4 py-6 backdrop-blur border-r border-white/10 bg-white/10"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
              Pad
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSettings}
                className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-semibold text-slate-200 hover:border-white/40 hover:text-white"
                aria-label="Open instellingen"
              >
                Instellingen
              </button>
              <button
                type="button"
                onClick={onLogin}
                disabled={!onLogin}
                title={
                  !onLogin
                    ? "Zakelijke cloudopslag is nog niet beschikbaar"
                    : undefined
                }
                className="rounded-full border border-blue-200/40 px-2 py-0.5 text-[10px] font-semibold text-blue-100 hover:border-blue-100 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Open login"
              >
                Login
              </button>
            </div>
          </div>
          <div data-mode-switch className="mb-4 flex items-center gap-2">
            {(
              [
                ["personal", "Persoonlijk", onPersonal],
                ["business", "Zakelijk", onBusiness],
              ] as const
            ).map(([key, label, select]) => (
              <button
                key={key}
                type="button"
                aria-pressed={mode === key}
                onClick={select}
                className={`flex-1 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${mode === key ? "bg-white text-slate-900 border-white" : "bg-white/10 text-slate-200 border-white/20 hover:bg-white/20"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <nav aria-label="Onderdelen" className="space-y-2">
            {navigation}
          </nav>
        </aside>
        <section data-app-content className="min-w-0 px-4 py-6">
          <div
            data-app-heading
            className="mb-4 flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                Moneylith / Finance OS
              </p>
              <h1 className="text-2xl font-semibold text-white">
                Finance Planner
              </h1>
            </div>
            <div className="rounded-full px-3 py-1 text-xs bg-amber-500/20 text-amber-100">
              Stap: {step}
            </div>
          </div>
          {banner}
          <div className="space-y-4">{children}</div>
        </section>
        <aside
          data-app-guide
          className="border-l border-white/10 bg-white/10 px-4 py-6 backdrop-blur lg:sticky lg:top-4 lg:h-fit"
        >
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
            {guideTitle}
          </h2>
          {guide}
        </aside>
      </div>
      {overlays}
      <footer className="mt-6 border-t border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200 flex flex-wrap gap-3 justify-center">
        <a
          href="/privacy"
          className="hover:text-white underline-offset-4 hover:underline"
        >
          Privacy
        </a>
        <span className="text-slate-500">•</span>
        <a
          href="/disclaimer"
          className="hover:text-white underline-offset-4 hover:underline"
        >
          Disclaimer
        </a>
        <span className="text-slate-500">•</span>
        <a
          href="/terms"
          className="hover:text-white underline-offset-4 hover:underline"
        >
          Voorwaarden
        </a>
        <span className="text-slate-500">•</span>
        <a
          href="/cookies"
          className="hover:text-white underline-offset-4 hover:underline"
        >
          Cookies
        </a>
        <span className="text-slate-500">•</span>
        <a
          href="/status"
          className="hover:text-white underline-offset-4 hover:underline"
        >
          Status
        </a>
      </footer>
      <CookieBanner />
      <AnalyticsGate />
    </main>
  );
}

export function ModeInformation({ children }: { children: ReactNode }) {
  return (
    <div
      data-mode-information
      className="mb-4 rounded-xl border px-4 py-3 text-xs border-amber-300/50 bg-amber-500/10 text-amber-50"
    >
      {children}
    </div>
  );
}

export function GuideCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-100">
      {children}
    </div>
  );
}
