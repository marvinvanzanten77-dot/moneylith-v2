import { useState } from "react";

type OnboardingMode = "bank" | "manual" | "cloud" | null;

interface OnboardingChoiceProps {
  onChoice: (mode: OnboardingMode) => void;
}

export function OnboardingChoice({ onChoice }: OnboardingChoiceProps) {
  const [selected, setSelected] = useState<OnboardingMode>(null);

  const handleStart = () => {
    if (selected) onChoice(selected);
  };

  const cardClass = (active: boolean, activeClass: string) =>
    `relative overflow-hidden rounded-xl border-2 p-6 text-left transition-all duration-200 ${
      active ? activeClass : "border-slate-300 bg-white hover:shadow-md"
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-5xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white">Welkom bij Moneylith</h1>
          <p className="text-lg text-slate-300">Kies je startmodus</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setSelected("bank")}
            className={cardClass(selected === "bank", "border-amber-500 bg-amber-50 shadow-lg shadow-amber-500/20")}
          >
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-100/20 opacity-50" />
            <div className="relative z-10">
              <h2 className="mb-2 text-xl font-bold text-slate-900">Bankkoppeling</h2>
              <p className="mb-4 text-sm text-slate-600">Automatische ingest via bankkoppeling met AI-verrijking.</p>
              <ul className="space-y-2 text-xs text-slate-700">
                <li>Automatische transacties</li>
                <li>Snelle onboarding</li>
                <li>Direct inzicht</li>
              </ul>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelected("manual")}
            className={cardClass(selected === "manual", "border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/20")}
          >
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-100/20 opacity-50" />
            <div className="relative z-10">
              <h2 className="mb-2 text-xl font-bold text-slate-900">Handmatige invoer</h2>
              <p className="mb-4 text-sm text-slate-600">Volledig lokaal, zelf invoeren en afschriften uploaden.</p>
              <ul className="space-y-2 text-xs text-slate-700">
                <li>Volledige controle</li>
                <li>CSV/PDF ingest</li>
                <li>Local-first</li>
              </ul>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelected("cloud")}
            className={cardClass(selected === "cloud", "border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-500/20")}
          >
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-100/20 opacity-50" />
            <div className="relative z-10">
              <h2 className="mb-2 text-xl font-bold text-slate-900">Cloud account (beta)</h2>
              <p className="mb-4 text-sm text-slate-600">Tweede modus naast local-first: registratie/login + cloud sync.</p>
              <ul className="space-y-2 text-xs text-slate-700">
                <li>Local-first blijft basis</li>
                <li>Account scaffold</li>
                <li>Secure sync v1.1</li>
              </ul>
              <div className="mt-4 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Binnenkort beschikbaar
              </div>
            </div>
          </button>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleStart}
            disabled={!selected}
            className={`flex-1 rounded-lg px-6 py-3 font-semibold transition-all duration-200 ${
              selected
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg hover:shadow-xl"
                : "bg-slate-200 text-slate-500 cursor-not-allowed"
            }`}
          >
            Beginnen
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-center text-xs text-slate-600">
          <p>Je keuze is later aanpasbaar. Local-first blijft altijd beschikbaar.</p>
        </div>
      </div>
    </div>
  );
}

