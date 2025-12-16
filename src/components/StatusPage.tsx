import React, { useEffect } from "react";
import { AnalyticsGate } from "./AnalyticsGate";

const lastUpdated = "2025-12-16";

export function StatusPage() {
  useEffect(() => {
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) {
      robots.setAttribute("content", "index,follow");
    } else {
      const m = document.createElement("meta");
      m.name = "robots";
      m.content = "index,follow";
      document.head.appendChild(m);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Moneylith</p>
          <h1 className="text-3xl font-semibold">Status & Transparantie</h1>
          <p className="text-sm text-slate-400">Laatst bijgewerkt: {lastUpdated}</p>
        </header>

        <div className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-slate-900/30">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Beta-status</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
              <li>AI-analyse en potjes-functionaliteit zijn in beta; resultaten kunnen variëren.</li>
              <li>Data-opslag is lokaal/client-side; herstel bij browser reset is beperkt.</li>
              <li>Roadmap: robuustere opslag, betere import, nauwkeuriger AI-analyse.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Geen financieel advies</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
              <li>Moneylith geeft geen financieel advies of aanbevelingen.</li>
              <li>Gebruik het als spiegel en hulpmiddel; jij beslist zelf.</li>
              <li>Controleer altijd je cijfers voordat je keuzes maakt.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">AI transparantie</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
              <li>AI helpt analyseren op basis van jouw invoer.</li>
              <li>Output kan fouten bevatten; geen autonoom handelen.</li>
              <li>Gebruiker beslist altijd zelf.</li>
            </ul>
          </section>
        </div>

        <AnalyticsGate />
      </div>
    </div>
  );
}
