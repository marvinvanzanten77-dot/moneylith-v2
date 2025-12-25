import { useMemo } from "react";

import { formatCurrency } from "../../utils/format";
import type { FinancialSnapshot, FinanceMode, MonthFocus } from "../../types";

type StepVooruitblikProps = {
  financialSnapshot?: FinancialSnapshot | null;
  spendBuckets?: { id: string; name: string; monthlyAverage: number; shareOfFree?: number }[];
  monthFocus?: MonthFocus | null;
  variant?: "personal" | "business";
  mode?: FinanceMode;
  readOnly?: boolean;
  aiAnalysisDone?: boolean;
};

export function StepVooruitblik({
  financialSnapshot,
  spendBuckets,
  variant = "personal",
  mode = "personal",
  aiAnalysisDone = false,
}: StepVooruitblikProps) {
  const snapshot = financialSnapshot ?? null;
  const isBusiness = variant === "business";
  const totalDebt = snapshot?.totalDebt ?? 0;
  const monthlyPressure = snapshot?.monthlyPressure ?? 0;
  const runwayMonths = snapshot?.runwayMonths ?? null;
  const netFree = snapshot?.netFree ?? 0;
  const assetsTotal = snapshot?.assetsTotal ?? 0;
  const hasCoreData = totalDebt > 0 || assetsTotal > 0 || netFree !== 0;
  const locked = !isBusiness && aiAnalysisDone !== true && !hasCoreData;
  const debtMonths = monthlyPressure > 0 ? Math.ceil(totalDebt / monthlyPressure) : null;

  if (locked) {
    return (
      <div className="space-y-6">
        <div className="mb-6 flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-slate-50">Vooruitblik</h1>
          <p className="text-sm text-slate-400">Dit is wat er gebeurt als alles vanaf nu hetzelfde blijft.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-200">
          Voer eerst AI-analyse uit om Vooruitblik te vullen.
        </div>
      </div>
    );
  }

  const timeline = useMemo(() => {
    const items: { label: string; detail: string; highlight: boolean }[] = [];
    items.push({
      label: "Nu",
      detail: `Vrij: ${formatCurrency(netFree)} | Buffer: ${runwayMonths !== null ? `${runwayMonths}m` : "onbekend"}`,
      highlight: true,
    });
    items.push({
      label: "Schuldvrij",
      detail: monthlyPressure > 0 && debtMonths ? `+/- ${debtMonths} maanden bij huidige maanddruk` : "Geen maandtempo ingesteld",
      highlight: monthlyPressure > 0 && Boolean(debtMonths) && debtMonths < 36,
    });
    items.push({
      label: "Buffer 3-6m",
      detail: runwayMonths !== null ? `Nog op te bouwen naar 3-6 maanden` : "Geen maandtempo ingesteld",
      highlight: runwayMonths !== null && runwayMonths >= 3,
    });
    return items;
  }, [netFree, runwayMonths, debtMonths, monthlyPressure]);

  const heading = "Vooruitblik";
  const subheading = isBusiness
    ? "Dit is het zakelijke scenario als je huidige koers, ritme en verplichtingen gelijk blijven."
    : "Dit is wat er gebeurt als alles vanaf nu hetzelfde blijft.";

  return (
    <div className="space-y-6">
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">{heading}</h1>
            <p className="text-sm text-slate-400">{subheading}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-3">
        <div className="2xl:col-span-2 flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-50">Schuldvrije projectie</h2>
            <p className="mb-2 text-xs text-slate-400">Op basis van je huidige maanddruk.</p>
            <div className="text-lg font-semibold text-slate-50">
              {monthlyPressure > 0 ? `+/- ${Math.ceil(totalDebt / monthlyPressure)} maanden` : "Geen maandelijkse aflossing ingesteld"}
            </div>
            {monthlyPressure <= 0 && <p className="mt-1 text-xs text-slate-400">Zonder aflosritme blijft je schuldpositie gelijk.</p>}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-50">Buffer-ontwikkeling</h2>
            <p className="mb-2 text-xs text-slate-400">Op basis van beschikbare vrije ruimte.</p>
            <div className="text-sm text-slate-50">{runwayMonths !== null ? `Huidig: ${runwayMonths} maanden` : "Geen maandelijkse inzet ingesteld"}</div>
            <div className="mt-1 text-xs text-slate-400">Richtwaarde: 3-6 maanden vaste lasten als zakelijke buffer.</div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-50">Vrije ruimte</h2>
            <p className="mb-2 text-xs text-slate-400">Op basis van je huidige vaste lasten en cashflow.</p>
            <div className="text-lg font-semibold text-slate-50">{formatCurrency(netFree)} / maand</div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-50">Als er niets verandert</h2>
            <p className="mb-2 text-xs text-slate-400">Dit is het zakelijke pad waar je nu feitelijk op zit.</p>
            <p className="text-sm text-slate-50">Zonder wijziging in aflossing, cashflow of doelen blijft dit scenario zich maandelijks herhalen.</p>
          </div>
        </div>

        <div className="2xl:col-span-1">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">Wat je hier ziet</h2>
                <p className="text-xs text-slate-400">
                  Dit is geen advies. Dit is de doorrekening van je huidige zakelijke inrichting in de tijd. Wijzigingen in cashflow, doelen of verplichtingen veranderen dit beeld direct.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-50">
              <div className="mb-2 flex justify-between text-xs text-slate-400">
                <span>Totale schuld</span>
                <span className="text-slate-50">{totalDebt === 0 && monthlyPressure === 0 ? "Niet ingevuld" : formatCurrency(totalDebt)}</span>
              </div>
              <div className="mb-2 flex justify-between text-xs text-slate-400">
                <span>Totale buffer/vermogen</span>
                <span className="text-slate-50">{assetsTotal === 0 ? "Niet ingevuld" : formatCurrency(assetsTotal)}</span>
              </div>
              <div className="mb-2 flex justify-between text-xs text-slate-400">
                <span>Structuur/ritme</span>
                <span className="text-slate-50">{(spendBuckets?.length ?? 0) > 0 ? `${spendBuckets?.length ?? 0} potjes` : "Nog geen ritme"}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-50">Tijdlijn</h3>
              <div className="flex flex-col gap-3">
                {timeline.map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full border ${item.highlight ? "bg-fuchsia-500 border-fuchsia-300" : "bg-slate-800 border-slate-700"}`} />
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-slate-100">{item.label}</div>
                      <div className="text-[11px] text-slate-400">{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
