import type { ChangeEvent } from "react";
import { lazy, Suspense } from "react";
import { POT_CATEGORIE_OPTIONS, getPotCategorieLabel } from "../data/potCategorieOptions";
import { POTJES, createZeroLimits, getDefaultPotjes } from "../data/potjes";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { MonthId, PotjeDef } from "../types";
import type { CategoryDonutDatum } from "./charts/CategoryPotsDonut";

const CategoryPotsDonut = lazy(() =>
  import("./charts/CategoryPotsDonut").then((m) => ({ default: m.CategoryPotsDonut }))
);

type Props = {
  selectedMonth: MonthId;
};

const PotjesPaneel = ({ selectedMonth }: Props) => {
  const [potConfigs, setPotConfigs] = useLocalStorage<PotjeDef[]>(
    "potjes-config",
    getDefaultPotjes()
  );

  const normalizedPotjes = (potConfigs && potConfigs.length > 0 ? potConfigs : POTJES).map(
    (potje, index) => {
      const limits = potje.limits && potje.limits.length > 0 ? potje.limits : createZeroLimits();
      return {
        id: potje.id || `pot-${index + 1}`,
        label: potje.label ?? "",
        description: potje.description ?? "",
        limits,
        categoryKey: potje.categoryKey ?? "",
        customName: potje.customName ?? "",
      } as PotjeDef;
    }
  );

  const updatePotje = (id: string, partial: Partial<PotjeDef>) => {
    setPotConfigs((prev) => {
      const base = prev && prev.length > 0 ? prev : POTJES;
      return base.map((item, index) => {
        const limits = item.limits && item.limits.length > 0 ? item.limits : createZeroLimits();
        if ((item.id || `pot-${index + 1}`) !== id) {
          return { ...item, limits };
        }
        return {
          ...item,
          limits,
          ...partial,
        };
      });
    });
  };

  const potjesData = normalizedPotjes.map((potje) => {
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

    const handleSpendChange = (event: ChangeEvent<HTMLInputElement>) => {
      const parsed = parseFloat(event.target.value);
      const nextValue = Number.isNaN(parsed) ? 0 : parsed;
      setSpent(nextValue);
    };

    const displayName =
      potje.customName?.trim() ||
      (potje.categoryKey ? getPotCategorieLabel(potje.categoryKey) : "Kies een thema om te starten");

    return {
      potje,
      displayName,
      effectiveLimit,
      baseLimit,
      spent,
      remaining,
      hasOverride,
      overrideLimit,
      setOverrideLimit,
      handleSpendChange,
    };
  });

  const totals = potjesData.reduce(
    (acc, { effectiveLimit, spent }) => {
      acc.totalLimit += effectiveLimit;
      acc.totalSpent += spent;
      return acc;
    },
    { totalLimit: 0, totalSpent: 0 }
  );
  const totalRemaining = totals.totalLimit - totals.totalSpent;
  const remainingClass =
    totalRemaining >= 0
      ? "px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
      : "px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-800";

  const donutData: CategoryDonutDatum[] = potjesData
    .filter(({ effectiveLimit }) => effectiveLimit > 0)
    .map(({ displayName, effectiveLimit }) => ({ naam: displayName, bedrag: effectiveLimit }));

  const hasChartData = donutData.length > 0;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Potjes per thema</h2>
          <p className="text-xs text-slate-600">Stel per thema je limiet en volg wat je uitgeeft.</p>
        </div>
      </div>

      <div className="card-shell p-5 text-slate-900">
        <div className="mb-4 flex flex-wrap gap-2 text-xs font-medium text-slate-800">
          <div className="px-3 py-1.5 rounded-full bg-white/80 text-slate-800 shadow-sm">
            <span className="font-semibold">Budget potjes:</span> €{totals.totalLimit.toFixed(0)}
          </div>
          <div className="px-3 py-1.5 rounded-full bg-white/80 text-slate-800 shadow-sm">
            <span className="font-semibold">Nu uitgegeven:</span> €{totals.totalSpent.toFixed(0)}
          </div>
          <div className={remainingClass}>
            <span className="font-semibold">Nog beschikbaar:</span> €{totalRemaining.toFixed(0)}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <div className="w-full">
            {hasChartData ? (
              <Suspense fallback={<div className="h-64 rounded-2xl bg-white/50" />}>
                <CategoryPotsDonut data={donutData} />
              </Suspense>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-2xl bg-white/60 text-xs text-slate-500">
                Voeg een limiet toe om de verdeling te zien.
              </div>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {potjesData.map(
              ({
                potje,
                displayName,
                baseLimit,
                effectiveLimit,
                spent,
                remaining,
                hasOverride,
                overrideLimit,
                setOverrideLimit,
                handleSpendChange,
              }) => (
                <div
                  key={potje.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/30 bg-white/80 p-4 text-sm text-slate-900 shadow-lg transition duration-200 hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{displayName}</h3>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        {potje.description ?? "Geef dit potje een korte noemer."}
                      </p>
                    </div>
                    <span className="pill bg-purple-100 text-purple-700">€{effectiveLimit}</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <label className="block text-[11px] font-semibold text-slate-600">Thema</label>
                    <select
                      className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
                      value={potje.categoryKey}
                      onChange={(e) => {
                        const newKey = e.target.value;
                        updatePotje(potje.id, {
                          categoryKey: newKey,
                          customName: newKey === "other" ? potje.customName ?? "" : "",
                        });
                      }}
                    >
                      <option value="">Kies een thema...</option>
                      {POT_CATEGORIE_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {potje.categoryKey === "other" && (
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Eigen naam of sfeer
                        </label>
                        <input
                          type="text"
                          className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
                          value={potje.customName ?? ""}
                          onChange={(e) => updatePotje(potje.id, { customName: e.target.value })}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-xs">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Aangepaste limiet voor deze maand (optioneel)
                    </label>
                    <input
                      type="number"
                      className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
                      value={numberInputValue(hasOverride ? overrideLimit : 0)}
                      onChange={(e) => {
                        const val = parseNumberInput(e.target.value);
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

                  <div className="space-y-1 text-xs">
                    <label className="block text-[11px] font-semibold text-slate-600" htmlFor={`spent-${potje.id}`}>
                      Uitgegeven deze maand
                    </label>
                    <input
                      id={`spent-${potje.id}`}
                      type="number"
                      inputMode="decimal"
                      className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
                      value={numberInputValue(spent)}
                      onChange={handleSpendChange}
                    />
                    {effectiveLimit === 0 ? (
                      <p className="text-[11px] text-slate-500">Stel hier je limiet voor deze maand.</p>
                    ) : (
                      <p className="text-[11px] text-slate-600">Nog over binnen dit potje: €{remaining}</p>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-700">
                    Subtotaal potjes: <span className="font-semibold">€{totals.totalLimit.toFixed(0)}</span> · Uitgegeven: <span className="font-semibold">€{totals.totalSpent.toFixed(0)}</span> · Over: <span className="font-semibold">€{totalRemaining.toFixed(0)}</span>
        </div>
      </div>
    </section>
  );
};

export default PotjesPaneel;


