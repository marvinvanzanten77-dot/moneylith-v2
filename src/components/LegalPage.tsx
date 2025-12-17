import React from "react";
import { useEffect } from "react";
import { AnalyticsGate } from "./AnalyticsGate";
import { CookieSettings } from "./CookieSettings";

type LegalKind = "privacy" | "disclaimer" | "terms" | "cookies";

const lastUpdated = "2025-12-16";

const sections: Record<LegalKind, { title: string; blocks: { heading: string; bullets: string[] }[] }> = {
  privacy: {
    title: "Privacyverklaring",
    blocks: [
      {
        heading: "Lokale opslag (browser)",
        bullets: [
          "Je gegevens blijven lokaal in je browser (localStorage).",
          "Moneylith bewaart geen gebruikersdata op een server en er zijn geen accounts.",
          "Als je je browserdata wist, verdwijnen ook je planner-gegevens.",
        ],
      },
      {
        heading: "AI-verwerking",
        bullets: [
          "De backend wordt alleen gebruikt om AI-analyses uit te voeren op jouw verzoek.",
          "We slaan de inhoud van je AI-input en -output niet op en loggen geen financiële details.",
          "AI-output is tijdelijk: je kunt deze lokaal exporteren als je dat wilt.",
        ],
      },
      {
        heading: "Analytics (optioneel)",
        bullets: [
          "Analytics is opt-in en alleen bedoeld om de app te verbeteren.",
          "Geen tracking, geen advertenties, geen profielen.",
          "We sturen geen financiële inhoud mee in analytics-events.",
        ],
      },
      {
        heading: "Jouw keuzes",
        bullets: [
          "Je bepaalt zelf of analytics aanstaat via het cookie-instellingenpaneel.",
          "Je kunt je gegevens exporteren als JSON en lokaal bewaren als back-up.",
          "Vragen over privacy? Mail ons via info@moneylith.nl.",
        ],
      },
    ],
  },
  disclaimer: {
    title: "Disclaimer",
    blocks: [
      {
        heading: "Inzicht is geen advies",
        bullets: [
          "Moneylith geeft inzicht, maar geen financieel advies.",
          "Je blijft zelf verantwoordelijk voor alle keuzes en acties.",
          "Gebruik de output als hulpmiddel, niet als besluit.",
        ],
      },
      {
        heading: "Geen garanties",
        bullets: [
          "We garanderen geen volledigheid of juistheid van AI-output.",
          "Resultaten kunnen afwijken door ontbrekende of onvolledige data.",
          "Controleer altijd je cijfers en bronnen.",
        ],
      },
    ],
  },
  terms: {
    title: "Voorwaarden (light)",
    blocks: [
      {
        heading: "Gebruik van Moneylith",
        bullets: [
          "Moneylith is bedoeld voor persoonlijke financiële reflectie.",
          "Je data blijft lokaal in je browser; er zijn geen accounts of server-opslag.",
          "Je bent zelf verantwoordelijk voor het bewaren van een back-up.",
        ],
      },
      {
        heading: "Fair use",
        bullets: [
          "Gebruik de app redelijk en niet voor misbruik of automatisering buiten normaal gebruik.",
          "AI-calls zijn bedoeld voor jouw eigen analyses, niet voor bulkverwerking van derden.",
          "Misbruik kan leiden tot beperking of blokkade van toegang.",
        ],
      },
      {
        heading: "Eigen verantwoordelijkheid",
        bullets: [
          "Je beslist zelf welke acties je neemt op basis van de inzichten.",
          "We zijn niet aansprakelijk voor beslissingen die je maakt.",
          "Contact voor vragen: info@moneylith.nl.",
        ],
      },
    ],
  },
  cookies: {
    title: "Cookies",
    blocks: [
      {
        heading: "Functionele cookies",
        bullets: [
          "Nodig voor basisfunctionaliteit en voorkeuren.",
          "Bewaren o.a. je consent-keuze (cookie: moneylith_consent).",
          "Geen tracking of advertenties.",
        ],
      },
      {
        heading: "Analytics (optioneel)",
        bullets: [
          "Alleen met jouw toestemming.",
          "Geanonimiseerd, zonder financiële inhoud.",
          "Geen profielen, geen advertentienetwerken.",
        ],
      },
      {
        heading: "Beheer van je keuze",
        bullets: [
          "Je kunt analytics altijd aan- of uitzetten via de cookie-instellingen.",
          "Bij wijzigen passen we de instellingen direct toe.",
        ],
      },
    ],
  },
};

const pageOrder: LegalKind[] = ["privacy", "disclaimer", "terms", "cookies"];

export function LegalPage({ path }: { path: string }) {
  const key = path.replace("/", "") as LegalKind;
  const content = sections[key] ?? sections.privacy;

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
          <h1 className="text-3xl font-semibold">{content.title}</h1>
          <p className="text-sm text-slate-400">Laatst bijgewerkt: {lastUpdated}</p>
          <p className="text-sm text-slate-300">
            Contact: <a href="mailto:info@moneylith.nl" className="underline hover:text-white">info@moneylith.nl</a>
          </p>
        </header>

        <div className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-slate-900/30">
          {content.blocks.map((block, idx) => (
            <section key={idx} className="space-y-2">
              <h2 className="text-lg font-semibold text-white">{block.heading}</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
                {block.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </section>
          ))}

          {path === "/cookies" && (
            <section className="pt-4 border-t border-white/10">
              <CookieSettings />
            </section>
          )}
        </div>

        <footer className="flex flex-wrap gap-3 text-sm text-slate-300">
          {pageOrder.map((p) => (
            <a key={p} href={`/${p}`} className="hover:text-white underline-offset-4 hover:underline">
              {sections[p].title.split(" ")[0]}
            </a>
          ))}
        </footer>

        <AnalyticsGate />
      </div>
    </div>
  );
}
