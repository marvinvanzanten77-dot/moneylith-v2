import { useState } from "react";

type OnboardingMode = "bank" | "manual" | null;

interface OnboardingChoiceProps {
  onChoice: (mode: OnboardingMode) => void;
}

export function OnboardingChoice({ onChoice }: OnboardingChoiceProps) {
  const [selected, setSelected] = useState<OnboardingMode>(null);

  const handleStart = () => {
    if (selected) {
      onChoice(selected);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white">Welkom bij Moneylith</h1>
          <p className="text-lg text-slate-300">Hoe wil je je financiën instellen?</p>
        </div>

        {/* Choice Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Bank Connection Option */}
          <button
            type="button"
            onClick={() => setSelected("bank")}
            className={`relative overflow-hidden rounded-xl border-2 p-6 text-left transition-all duration-200 ${
              selected === "bank"
                ? "border-amber-500 bg-amber-50 shadow-lg shadow-amber-500/20"
                : "border-slate-300 bg-white hover:border-amber-300 hover:shadow-md"
            }`}
          >
            {/* Decorative background */}
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-100/20 opacity-50" />

            <div className="relative z-10">
              {/* Icon */}
              <div className="mb-4 inline-flex rounded-lg bg-amber-100 p-3">
                <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>

              {/* Content */}
              <h2 className="mb-2 text-xl font-bold text-slate-900">🏦 Bankkoppeling</h2>
              <p className="mb-4 text-sm text-slate-600">
                Verbind automatisch je bank. Moneylith haalt je transacties op en vult alles automatisch in.
              </p>

              {/* Features */}
              <ul className="space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Automatisch gegevens importeren
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                  AI-analyse van je uitgaven
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Real-time synchronisatie
                </li>
              </ul>

              {/* Checkbox */}
              <div className="mt-4 flex items-center">
                <div
                  className={`h-5 w-5 rounded border-2 transition-all ${
                    selected === "bank"
                      ? "border-amber-500 bg-amber-500"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {selected === "bank" && (
                    <svg className="h-full w-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </button>

          {/* Manual Entry Option */}
          <button
            type="button"
            onClick={() => setSelected("manual")}
            className={`relative overflow-hidden rounded-xl border-2 p-6 text-left transition-all duration-200 ${
              selected === "manual"
                ? "border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/20"
                : "border-slate-300 bg-white hover:border-blue-300 hover:shadow-md"
            }`}
          >
            {/* Decorative background */}
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-100/20 opacity-50" />

            <div className="relative z-10">
              {/* Icon */}
              <div className="mb-4 inline-flex rounded-lg bg-blue-100 p-3">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>

              {/* Content */}
              <h2 className="mb-2 text-xl font-bold text-slate-900">📝 Handmatige Invoer</h2>
              <p className="mb-4 text-sm text-slate-600">
                Voer alles zelf in. Upload afschriften wanneer je wilt en bepaal je eigen tijdschema.
              </p>

              {/* Features */}
              <ul className="space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Volledige controle over je gegevens
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Upload afschriften (PDF/Excel/CSV)
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Stap voor stap invullen
                </li>
              </ul>

              {/* Checkbox */}
              <div className="mt-4 flex items-center">
                <div
                  className={`h-5 w-5 rounded border-2 transition-all ${
                    selected === "manual"
                      ? "border-blue-500 bg-blue-500"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {selected === "manual" && (
                    <svg className="h-full w-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* CTA Button */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleStart}
            disabled={!selected}
            className={`flex-1 rounded-lg px-6 py-3 font-semibold transition-all duration-200 ${
              selected
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg hover:shadow-xl hover:scale-105"
                : "bg-slate-200 text-slate-500 cursor-not-allowed"
            }`}
          >
            Beginnen
          </button>
        </div>

        {/* Info Footer */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-center text-xs text-slate-600">
          <p>
            Je kunt je keuze later altijd nog wijzigen. Beide opties zijn even veilig en werken 100% lokaal.
          </p>
        </div>
      </div>
    </div>
  );
}
