import React from "react";

type LegalKind = "privacy" | "disclaimer" | "terms" | "cookies";

const lastUpdated = "2025-01-01";

const sections: Record<LegalKind, { title: string; blocks: { heading: string; bullets: string[] }[] }> = {
  privacy: {
    title: "Privacyverklaring",
    blocks: [
      {
        heading: "Wat we verzamelen",
        bullets: ["TODO: beschrijf welke gegevens we verzamelen", "TODO: leg uit waarom we deze nodig hebben", "TODO: vermeld bewaartermijnen"],
      },
      {
        heading: "Jouw rechten",
        bullets: ["TODO: recht op inzage en correctie", "TODO: recht op verwijdering", "TODO: hoe je contact opneemt"],
      },
    ],
  },
  disclaimer: {
    title: "Disclaimer",
    blocks: [
      { heading: "Gebruik op eigen risico", bullets: ["TODO: geen financieel advies", "TODO: wij garanderen geen uitkomsten", "TODO: controleer cijfers altijd zelf"] },
      { heading: "Aansprakelijkheid", bullets: ["TODO: beperkingen van aansprakelijkheid", "TODO: verwijzingen naar externe bronnen"] },
    ],
  },
  terms: {
    title: "Voorwaarden (light)",
    blocks: [
      { heading: "Gebruik van de dienst", bullets: ["TODO: beschrijf waarvoor de dienst bedoeld is", "TODO: wat wel/niet is toegestaan", "TODO: fair use verwachtingen"] },
      { heading: "Account & gedrag", bullets: ["TODO: verantwoordelijkheid voor eigen gegevens", "TODO: meld misbruik", "TODO: wanneer toegang kan worden ingetrokken"] },
    ],
  },
  cookies: {
    title: "Cookies",
    blocks: [
      { heading: "Welke cookies", bullets: ["TODO: functionele cookies", "TODO: analytische cookies", "TODO: geen/alleen beperkte tracking"] },
      { heading: "Keuzes", bullets: ["TODO: hoe je cookies kunt beheren", "TODO: hoe je toestemming wijzigt"] },
    ],
  },
};

const pageOrder: LegalKind[] = ["privacy", "disclaimer", "terms", "cookies"];

export function LegalPage({ path }: { path: string }) {
  const key = path.replace("/", "") as LegalKind;
  const content = sections[key] ?? sections.privacy;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Moneylith</p>
          <h1 className="text-3xl font-semibold">{content.title}</h1>
          <p className="text-sm text-slate-400">Laatst bijgewerkt: {lastUpdated}</p>
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
        </div>

        <footer className="flex flex-wrap gap-3 text-sm text-slate-300">
          {pageOrder.map((p) => (
            <a key={p} href={`/${p}`} className="hover:text-white underline-offset-4 hover:underline">
              {sections[p].title.split(" ")[0]}
            </a>
          ))}
        </footer>
      </div>
    </div>
  );
}
