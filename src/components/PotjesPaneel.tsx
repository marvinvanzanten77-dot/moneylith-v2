import type { ChangeEvent } from "react";
import { POT_CATEGORIE_OPTIONS, getPotCategorieLabel } from "../data/potCategorieOptions";
import { POTJES, createZeroLimits, getDefaultPotjes } from "../data/potjes";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { MonthId, PotjeDef } from "../types";

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
      (potje.categoryKey ? getPotCategorieLabel(potje.categoryKey) : "Geen categorie gekozen");

    return {
      potje,
      displayName,
      effectiveLimit,
      baseLimit,
      spent,
      remaining,
      hasOverride,
      setOverrideLimit,
      handleSpendChange,
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
          {potjesData.map(
            ({
              potje,
              displayName,
              baseLimit,
              effectiveLimit,
              spent,
              remaining,
              handleSpendChange,
              hasOverride,
              setOverrideLimit,
            }) => (
              <div
                key={potje.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm shadow-sm"
              >
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{displayName}</h3>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    {potje.description ?? ""}
                  </p>
                  <p className="text-xs text-slate-700">Limiet: €{effectiveLimit}</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <label className="block text-[11px] font-medium text-slate-500">
                      Categorie
                    </label>
                    <select
                      className="block w-full rounded-md border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      value={potje.categoryKey}
                      onChange={(e) => {
                        const newKey = e.target.value;
                        updatePotje(potje.id, {
                          categoryKey: newKey,
                          customName: newKey === "other" ? potje.customName ?? "" : "",
                        });
                      }}
                    >
                      <option value="">Kies categorie...</option>
                      {POT_CATEGORIE_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {potje.categoryKey === "other" && (
                      <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-slate-500">
                          Eigen naam / thema
                        </label>
                        <input
                          type="text"
                          className="block w-full rounded-md border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          value={potje.customName ?? ""}
                          onChange={(e) =>
                            updatePotje(potje.id, { customName: e.target.value })
                          }
                        />
                      </div>
                    )}
                  </div>
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
                    onChange={handleSpendChange}
                  />
                  {effectiveLimit === 0 ? (
                    <p className="mt-1 text-xs text-slate-600">Geen budget ingepland</p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-600">Resterend: €{remaining}</p>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
};

export default PotjesPaneel;
