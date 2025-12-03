import type { ChangeEvent } from "react";
import { POTJES } from "../data/potjes";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { MonthId } from "../types";

type Props = {
  selectedMonth: MonthId;
};

const PotjesPaneel = ({ selectedMonth }: Props) => {
  const potjesData = POTJES.map((potje) => {
    const baseLimit = potje.limits.find((entry) => entry.month === selectedMonth)?.limit ?? 0;
    const [overrideLimit, setOverrideLimit] = useLocalStorage<number>(
      `potje-${potje.id}-${selectedMonth}-limitOverride`,
      NaN as any
    );
    const hasOverride = !isNaN(overrideLimit as number);
    const effectiveLimit = hasOverride ? (overrideLimit as number) : baseLimit;

    const [spentRaw, setSpent] = useLocalStorage<number>(
      `potje-${potje.id}-${selectedMonth}`,
      0
    );
    const spent = Number.isFinite(spentRaw) ? spentRaw : 0;
    const remaining = Math.max(0, effectiveLimit - spent);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      const parsed = parseFloat(event.target.value);
      const nextValue = Number.isNaN(parsed) ? 0 : parsed;
      setSpent(nextValue);
    };

    return {
      potje,
      baseLimit,
      effectiveLimit,
      spent,
      remaining,
      handleChange,
      hasOverride,
      setOverrideLimit,
    };
  });

  let totalLimit = 0;
  let totalSpent = 0;
  potjesData.forEach(({ effectiveLimit, spent }) => {
    totalLimit += effectiveLimit;
    totalSpent += spent;
  });
  const totalRemaining = totalLimit - totalSpent;
  const remainingClass =
    totalRemaining >= 0
      ? "px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
      : "px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-800";

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Potjes per categorie</h2>
          <p className="text-xs text-slate-500">Limieten en bestedingen voor de geselecteerde maand.</p>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2 text-xs font-medium text-slate-800">
          <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
            <span className="font-semibold">Totaal budget:</span> €{totalLimit.toFixed(0)}
          </div>
          <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
            <span className="font-semibold">Totaal uitgegeven:</span> €{totalSpent.toFixed(0)}
          </div>
          <div className={remainingClass}>
            <span className="font-semibold">Resterend:</span> €{totalRemaining.toFixed(0)}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {potjesData.map(({ potje, baseLimit, effectiveLimit, spent, remaining, handleChange, hasOverride, setOverrideLimit }) => (
            <div
              key={potje.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm shadow-sm"
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{potje.label}</h3>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  {potje.description ?? potje.id}
                </p>
                <p className="text-xs text-slate-700">Limiet: €{effectiveLimit}</p>
                <label className="mt-1 block text-[11px] font-medium text-slate-500">
                  Aangepaste limiet voor deze maand (optioneel)
                </label>
                <input
                  type="number"
                  className="mt-0.5 block w-full rounded-md border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={hasOverride ? overrideLimit : ""}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val)) {
                      setOverrideLimit(NaN as any);
                    } else {
                      setOverrideLimit(val);
                    }
                  }}
                />
                {hasOverride && (
                  <p className="text-[11px] text-slate-500">Origineel: €{baseLimit}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700" htmlFor={`spent-${potje.id}`}>
                  Uitgegeven deze maand
                </label>
                <input
                  id={`spent-${potje.id}`}
                  type="number"
                  inputMode="decimal"
                  className="mt-1 block w-full rounded-md border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={Number.isFinite(spent) ? spent : 0}
                  onChange={handleChange}
                />
                {effectiveLimit === 0 ? (
                  <p className="mt-1 text-xs text-slate-600">Geen budget ingepland</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-600">Resterend: €{remaining}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PotjesPaneel;
