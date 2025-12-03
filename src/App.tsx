import { useState } from "react";
import { BufferCard } from "./components/BufferCard";
import { DashboardSummary } from "./components/DashboardSummary";
import { FixedCostsList } from "./components/FixedCostsList";
import { IncomeFixedCard } from "./components/IncomeFixedCard";
import { AnalyticsCard } from "./components/AnalyticsCard";
import { SettingsCard } from "./components/SettingsCard";
import { UserProfileCard } from "./components/UserProfileCard";
import PotjesPaneel from "./components/PotjesPaneel";
import SchuldenPlanTable from "./components/SchuldenPlanTable";
import type { MonthId } from "./types";

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

const App = () => {
  const [selectedMonth, setSelectedMonth] = useState<MonthId>("2025-12");

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-slate-900">Finance Planner</h1>
          <p className="mt-1 text-sm text-slate-500">
            Overzicht van potjes & schuldenplan voor 2025–2026.
          </p>
        </header>

        <UserProfileCard />
        <IncomeFixedCard />
        <FixedCostsList />

        <section className="mb-6">
          <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="month-select">
              Maand
            </label>
            <select
              id="month-select"
              className="mt-1 block w-full rounded-md border-slate-300 shadow-sm text-sm"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value as MonthId)}
            >
              {MONTHS.map((month) => (
                <option key={month.id} value={month.id}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="space-y-6">
          <DashboardSummary selectedMonth={selectedMonth} />
          <PotjesPaneel selectedMonth={selectedMonth} />
          <SchuldenPlanTable selectedMonth={selectedMonth} />
          <BufferCard />
          <AnalyticsCard />
          <SettingsCard />
        </section>
      </div>
    </main>
  );
};

export default App;
