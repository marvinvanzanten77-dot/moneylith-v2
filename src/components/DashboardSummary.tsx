import { POTJES } from "../data/potjes";
import { SCHULDENPLAN } from "../data/schuldenplan";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { MonthId } from "../types";

interface DashboardSummaryProps {
  selectedMonth: MonthId;
}

export function DashboardSummary({ selectedMonth }: DashboardSummaryProps) {
  let totalLimit = 0;
  let totalSpent = 0;

  POTJES.forEach((potje) => {
    const limit = potje.limits.find((entry) => entry.month === selectedMonth)?.limit ?? 0;
    const [spentRaw] = useLocalStorage<number>(`potje-${potje.id}-${selectedMonth}`, 0);
    const spent = Number.isFinite(spentRaw) ? spentRaw : 0;
    totalLimit += limit;
    totalSpent += spent;
  });

  const totalRemaining = totalLimit - totalSpent;

  const item = SCHULDENPLAN.find((i) => i.month === selectedMonth);
  const doneKey = item ? `schuldenplan-${item.month}` : `schuldenplan-${selectedMonth}`;
  const [storedDone] = useLocalStorage<boolean>(doneKey, false);
  const done = item ? storedDone : false;

  const [netIncome] = useLocalStorage<number>("income-netto", 0);
  const [fixedCosts] = useLocalStorage<number>("fixed-costs", 0);

  const safeIncome = isNaN(netIncome) ? 0 : netIncome;
  const safeFixed = isNaN(fixedCosts) ? 0 : fixedCosts;
  const freeBudget = safeIncome - safeFixed;

  const schuldDoel = item ? item.doelBedrag : 0;
  const plannedTotal = totalLimit + schuldDoel;
  const afterPlan = freeBudget - plannedTotal;

  const remainingClass =
    totalRemaining >= 0
      ? "px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
      : "px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-800";

  return (
    <div className="mb-6 card-shell p-5 text-slate-900">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Missie van de maand</h2>
        <p className="text-xs text-slate-500">Context: {item ? item.labelMaand : selectedMonth}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
          <span className="font-semibold">Potjesbudget:</span> €{totalLimit.toFixed(0)}
        </div>
        <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
          <span className="font-semibold">Nu uitgegeven:</span> €{totalSpent.toFixed(0)}
        </div>
        <div className={remainingClass}>
          <span className="font-semibold">Nog beschikbaar:</span> €{totalRemaining.toFixed(0)}
        </div>
      </div>

      <div className="mt-2 space-y-1 text-[11px] text-slate-600">
        <p>
          <span className="font-semibold text-slate-800">Vrij na vaste lasten:</span> €{freeBudget.toFixed(0)}
        </p>
        <p>
          <span className="font-semibold text-slate-800">Gepland (potjes + schuld):</span> €{plannedTotal.toFixed(0)}
          <span className="ml-2">
            → daarna over: <span className={afterPlan >= 0 ? "text-emerald-700" : "text-red-700"}>€{afterPlan.toFixed(0)}</span>
          </span>
        </p>
      </div>

      {item ? (
        <p className="mt-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Maandfocus:</span> {item.focusSchuld || "Kies later welke schuld je aanpakt"} · <span className="font-semibold text-slate-800">Doel:</span> €{item.doelBedrag} · <span className="font-semibold text-slate-800">Status:</span> {done ? "Afgerond" : "Nog bezig"}
        </p>
      ) : (
        <p className="mt-3 text-xs text-slate-600">Nog geen schuld gekozen voor deze maand.</p>
      )}
    </div>
  );
}
