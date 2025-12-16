import { lazy, Suspense } from "react";
import { POTJES, getDefaultPotjes } from "../data/potjes";
import { SCHULDENPLAN } from "../data/schuldenplan";
import type { MonthId } from "../types";
import type { MonthlySpendingChartDatum } from "./charts/MonthlySpendingStackedChart";

const MonthlySpendingStackedChart = lazy(() =>
  import("./charts/MonthlySpendingStackedChart").then((m) => ({
    default: m.MonthlySpendingStackedChart,
  }))
);

const MONTHS: { id: MonthId; label: string }[] = [
  { id: "2025-12", label: "dec 2025" },
  { id: "2026-01", label: "jan 2026" },
  { id: "2026-02", label: "feb 2026" },
  { id: "2026-03", label: "mrt 2026" },
  { id: "2026-04", label: "apr 2026" },
  { id: "2026-05", label: "mei 2026" },
  { id: "2026-06", label: "jun 2026" },
  { id: "2026-07", label: "jul 2026" },
  { id: "2026-08", label: "aug 2026" },
  { id: "2026-09", label: "sep 2026" },
  { id: "2026-10", label: "okt 2026" },
  { id: "2026-11", label: "nov 2026" },
  { id: "2026-12", label: "dec 2026" },
];

const readNumber = (key: string) => {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(key);
  if (!raw) return 0;
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export function AnalyticsCard() {
  const storedPotjes = (() => {
    if (typeof window === "undefined") return POTJES;
    try {
      const raw = window.localStorage.getItem("potjes-config");
      if (!raw) return POTJES;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return POTJES;
      return parsed;
    } catch {
      return POTJES;
    }
  })();

  const potjesToUse = storedPotjes && storedPotjes.length > 0 ? storedPotjes : getDefaultPotjes();

  const rows = MONTHS.map((month) => {
    let potjesSpent = 0;
    potjesToUse.forEach((potje) => {
      const key = `potje-${potje.id}-${month.id}`;
      potjesSpent += readNumber(key);
    });

    const schuldPaid = readNumber(`schuldenplan-paid-${month.id}`);
    return {
      month,
      potjesSpent,
      schuldPaid,
      total: potjesSpent + schuldPaid,
    };
  });

  const chartData: MonthlySpendingChartDatum[] = rows.map((row) => ({
    maand: row.month.label,
    potjes: row.potjesSpent,
    schuld: row.schuldPaid,
    totaal: row.total,
  }));

  return (
    <div className="mt-8 card-shell p-5 text-slate-900">
      <h2 className="text-lg font-semibold">Tijdslijn</h2>
      <p className="text-xs text-slate-600">Zie per maand hoeveel naar potjes en schulden ging.</p>

      <div className="mt-4">
        <Suspense fallback={<div className="h-64 rounded-2xl bg-white/50" />}>
          <MonthlySpendingStackedChart data={chartData} />
        </Suspense>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full table-auto text-xs">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Maand</th>
              <th className="px-3 py-2 text-right font-semibold">Potjes uitgegeven (€)</th>
              <th className="px-3 py-2 text-right font-semibold">Betaald aan schuld (€)</th>
              <th className="px-3 py-2 text-right font-semibold">Totaal (€)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.month.id} className="border-b last:border-b-0">
                <td className="px-3 py-2 align-top text-slate-900">{row.month.label}</td>
                <td className="px-3 py-2 align-top text-right text-slate-900">€{row.potjesSpent.toFixed(0)}</td>
                <td className="px-3 py-2 align-top text-right text-slate-900">€{row.schuldPaid.toFixed(0)}</td>
                <td className="px-3 py-2 align-top text-right text-slate-900">€{row.total.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

