import { useMemo, useState } from "react";

import { formatCurrency } from "../../utils/format";
import { numberInputValue, parseNumberInput } from "../../utils/numberInput";
import type { FinancialSnapshot, FinanceMode } from "../../types";

type ScenarioKey = "baseline" | "upside" | "worst";

type ScenarioDelta = {
  extraIncomePerMonth?: number;
  savingsPerMonth?: number;
  shockAmount?: number;
  shockPerMonth?: number;
  shockDurationMonths?: number;
  shockStartMonth?: number;
};

type ForecastInput = {
  debtNow: number;
  monthlyPayment: number;
  freeRoomNow: number;
  bufferNow: number;
};

type ForecastResult = {
  debtNow: number;
  debtAt12: number;
  bufferNow: number;
  bufferAt12: number;
  freeRoomNow: number;
  freeRoomAt12: number;
  monthsToDebtFree: number | null;
  debtTimeline: number[];
  bufferTimeline: number[];
  freeRoomTimeline: number[];
};

const clamp = (v: number) => (Number.isFinite(v) ? v : 0);

const simulateForecast = (input: ForecastInput, delta: ScenarioDelta, months = 12): ForecastResult => {
  const debtTimeline: number[] = [];
  const bufferTimeline: number[] = [];
  const freeRoomTimeline: number[] = [];

  let debt = Math.max(0, input.debtNow);
  let buffer = Math.max(0, input.bufferNow);
  const monthlyPay = Math.max(0, input.monthlyPayment);
  const extraIncome = clamp(delta.extraIncomePerMonth ?? 0);
  const savings = clamp(delta.savingsPerMonth ?? 0);
  const shockPerMonth = clamp(delta.shockPerMonth ?? 0);
  const shockDuration = Math.max(0, Math.round(delta.shockDurationMonths ?? 0));
  const shockStart = Math.max(0, Math.round(delta.shockStartMonth ?? 0));
  const shockAmount = clamp(delta.shockAmount ?? 0);

  let monthsToZero: number | null = null;

  for (let m = 0; m <= months; m++) {
    const inShockWindow = m >= shockStart && m < shockStart + shockDuration;
    const shockHit = m === shockStart && shockAmount > 0;
    let freeRoom = input.freeRoomNow + extraIncome - (inShockWindow ? shockPerMonth : 0);
    if (shockHit) buffer = Math.max(0, buffer - shockAmount);

    const pay = Math.min(debt, monthlyPay);
    debt = Math.max(0, debt - pay);

    buffer = Math.max(0, buffer + savings);

    debtTimeline.push(debt);
    bufferTimeline.push(buffer);
    freeRoomTimeline.push(freeRoom);

    if (debt === 0 && monthsToZero === null) monthsToZero = m;
  }

  return {
    debtNow: input.debtNow,
    debtAt12: debtTimeline[Math.min(12, debtTimeline.length - 1)] ?? debt,
    bufferNow: input.bufferNow,
    bufferAt12: bufferTimeline[Math.min(12, bufferTimeline.length - 1)] ?? buffer,
    freeRoomNow: input.freeRoomNow,
    freeRoomAt12: freeRoomTimeline[Math.min(12, freeRoomTimeline.length - 1)] ?? input.freeRoomNow,
    monthsToDebtFree: monthsToZero,
    debtTimeline,
    bufferTimeline,
    freeRoomTimeline,
  };
};

type StepVooruitblikProps = {
  financialSnapshot?: FinancialSnapshot | null;
  variant?: "personal" | "business";
  mode?: FinanceMode;
  readOnly?: boolean;
};

export function StepVooruitblik({ financialSnapshot, variant = "personal" }: StepVooruitblikProps) {
  const snapshot = financialSnapshot ?? null;
  const debtNow = snapshot?.totalDebt ?? 0;
  const monthlyPayment = snapshot?.monthlyPressure ?? 0;
  const freeRoomNow = snapshot?.netFree ?? 0;
  const bufferNow = snapshot?.assetsTotal ?? 0;

  const baseInput: ForecastInput = {
    debtNow,
    monthlyPayment,
    freeRoomNow,
    bufferNow,
  };

  const [scenario, setScenario] = useState<ScenarioKey>("baseline");
  const [upside, setUpside] = useState<{ extraIncomePerMonth: number; savingsPerMonth: number }>({
    extraIncomePerMonth: 0,
    savingsPerMonth: 0,
  });
  const [worst, setWorst] = useState<{ shockAmount: number; shockPerMonth: number; shockDurationMonths: number; shockStartMonth: number }>({
    shockAmount: 0,
    shockPerMonth: 0,
    shockDurationMonths: 0,
    shockStartMonth: 0,
  });

  const deltas: Record<ScenarioKey, ScenarioDelta> = {
    baseline: {},
    upside,
    worst,
  };

  const results = {
    baseline: simulateForecast(baseInput, deltas.baseline),
    upside: simulateForecast(baseInput, deltas.upside),
    worst: simulateForecast(baseInput, deltas.worst),
  };

  const current = results[scenario];

  const conclusion = `Als je niets verandert, ziet je situatie er over 12 maanden zo uit: schuld ${formatCurrency(
    results.baseline.debtAt12,
  )}, buffer ${formatCurrency(results.baseline.bufferAt12)}, vrije ruimte ${formatCurrency(results.baseline.freeRoomAt12)}.`;

  const summaryText = (key: ScenarioKey) => {
    if (key === "upside") {
      return `Met +${formatCurrency(upside.extraIncomePerMonth)} inkomen en +${formatCurrency(
        upside.savingsPerMonth,
      )} sparen p/m: buffer na 6m ${formatCurrency(results.upside.bufferTimeline[6] ?? 0)}, na 12m ${formatCurrency(
        results.upside.bufferAt12,
      )}, vrije ruimte na 12m ${formatCurrency(results.upside.freeRoomAt12)}.`;
    }
    if (key === "worst") {
      return `Shock van ${formatCurrency(worst.shockAmount || worst.shockPerMonth)} ${
        worst.shockPerMonth ? "per maand" : "eenmalig"
      } vanaf maand ${worst.shockStartMonth || 0}: schuld na 12m ${formatCurrency(
        results.worst.debtAt12,
      )}, buffer ${formatCurrency(results.worst.bufferAt12)}, vrije ruimte ${formatCurrency(results.worst.freeRoomAt12)}.`;
    }
    return `Huidig pad: schuld na 12m ${formatCurrency(results.baseline.debtAt12)}, buffer ${formatCurrency(
      results.baseline.bufferAt12,
    )}, vrije ruimte ${formatCurrency(results.baseline.freeRoomAt12)}.`;
  };

  const metrics = [
    { key: "debt", label: "Schuld", get: (r: ForecastResult) => r.debtAt12 },
    { key: "buffer", label: "Buffer", get: (r: ForecastResult) => r.bufferAt12 },
    { key: "free", label: "Vrije ruimte", get: (r: ForecastResult) => r.freeRoomAt12 },
  ];
  const compareMax = Math.max(
    ...metrics.flatMap((m) => [m.get(results.baseline), m.get(current)]).map((v) => Math.max(0, v)),
    1,
  );

  const costNothing =
    results.baseline.freeRoomNow > 0
      ? results.baseline.freeRoomNow * 12
      : 0;

  const timelinePoints = [
    { label: "Nu", idx: 0 },
    { label: "6m", idx: 6 },
    { label: "12m", idx: 12 },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-4 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-50">Vooruitblik</h1>
        <p className="text-sm text-slate-400">Deterministische projectie van je huidige pad en scenario's.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-sm font-semibold text-slate-50">{conclusion}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["baseline", "upside", "worst"] as ScenarioKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setScenario(key)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              scenario === key ? "bg-amber-400 text-slate-900" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            {key === "baseline" ? "Huidig pad" : key === "upside" ? "Upside" : "Worst case"}
          </button>
        ))}
      </div>

      {scenario === "upside" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-50 space-y-3">
          <div className="flex flex-wrap gap-3">
            <label className="text-xs text-slate-300">
              Extra inkomen p/m
              <input
                type="number"
                className="mt-1 w-32 rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-slate-50"
                value={numberInputValue(upside.extraIncomePerMonth)}
                onChange={(e) => setUpside((p) => ({ ...p, extraIncomePerMonth: parseNumberInput(e.target.value) }))}
              />
            </label>
            <label className="text-xs text-slate-300">
              Sparen p/m
              <input
                type="number"
                className="mt-1 w-32 rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-slate-50"
                value={numberInputValue(upside.savingsPerMonth)}
                onChange={(e) => setUpside((p) => ({ ...p, savingsPerMonth: parseNumberInput(e.target.value) }))}
              />
            </label>
          </div>
        </div>
      )}

      {scenario === "worst" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-50 space-y-3">
          <div className="flex flex-wrap gap-3">
            <label className="text-xs text-slate-300">
              Shock bedrag (eenmalig)
              <input
                type="number"
                className="mt-1 w-32 rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-slate-50"
                value={numberInputValue(worst.shockAmount)}
                onChange={(e) => setWorst((p) => ({ ...p, shockAmount: parseNumberInput(e.target.value) }))}
              />
            </label>
            <label className="text-xs text-slate-300">
              Shock p/m
              <input
                type="number"
                className="mt-1 w-32 rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-slate-50"
                value={numberInputValue(worst.shockPerMonth)}
                onChange={(e) => setWorst((p) => ({ ...p, shockPerMonth: parseNumberInput(e.target.value) }))}
              />
            </label>
            <label className="text-xs text-slate-300">
              Duur (mnd)
              <input
                type="number"
                className="mt-1 w-24 rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-slate-50"
                value={numberInputValue(worst.shockDurationMonths)}
                onChange={(e) => setWorst((p) => ({ ...p, shockDurationMonths: parseNumberInput(e.target.value) }))}
              />
            </label>
            <label className="text-xs text-slate-300">
              Start maand
              <input
                type="number"
                className="mt-1 w-24 rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-slate-50"
                value={numberInputValue(worst.shockStartMonth)}
                onChange={(e) => setWorst((p) => ({ ...p, shockStartMonth: parseNumberInput(e.target.value) }))}
              />
            </label>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {metrics.map((m) => {
          const baselineVal = Math.max(0, m.get(results.baseline));
          const scenarioVal = Math.max(0, m.get(current));
          const basePct = Math.min(100, (baselineVal / compareMax) * 100);
          const scenarioPct = Math.min(100, (scenarioVal / compareMax) * 100);
          return (
            <div key={m.key} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-50 space-y-2">
              <p className="text-xs text-slate-400">{m.label} over 12 maanden</p>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Huidig pad</span>
                <span className="font-semibold text-slate-50">{formatCurrency(baselineVal)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-slate-500" style={{ width: `${basePct}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>{scenario === "baseline" ? "Scenario" : "Gekozen scenario"}</span>
                <span className="font-semibold text-amber-100">{formatCurrency(scenarioVal)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${scenarioPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-50 space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">Tijdslijn (nu → 6m → 12m)</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {timelinePoints.map((p) => (
            <div key={p.label} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-xs text-slate-400">{p.label}</div>
              <div className="mt-1 text-[11px] text-slate-300">Schuld: {formatCurrency(current.debtTimeline[p.idx] ?? current.debtNow)}</div>
              <div className="text-[11px] text-slate-300">Buffer: {formatCurrency(current.bufferTimeline[p.idx] ?? bufferNow)}</div>
              <div className="text-[11px] text-slate-300">Vrij: {formatCurrency(current.freeRoomTimeline[p.idx] ?? freeRoomNow)}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-amber-100">{summaryText(scenario)}</p>
        <p className="text-[11px] text-slate-500">Tip: Versnel schulden aflossen in de Schulden-tab - buffer kan kort dalen, maar looptijd wordt korter en maanddruk zakt later.</p>
      </div>

      <div className="rounded-2xl border border-amber-300/50 bg-amber-500/10 p-4 text-sm text-amber-50 space-y-2">
        <h3 className="text-sm font-semibold text-amber-100">Wat kost niets doen?</h3>
        <p className="text-xs text-amber-100">Verloren maanden: {results.baseline.monthsToDebtFree ?? "onbekend"} (bij huidig tempo).</p>
        <p className="text-xs text-amber-100">Onbenutte vrije ruimte (12m): {formatCurrency(costNothing)}</p>
        {results.baseline.bufferAt12 === 0 && <p className="text-xs text-amber-100">Buffer blijft 0 → kwetsbaarheid blijft hoog.</p>}
        {debtNow === 0 && bufferNow === 0 && freeRoomNow === 0 && (
          <p className="text-xs text-amber-100">
            Vul inkomen, vaste lasten en schulden in voor een betekenisvolle vooruitblik. Zonder data blijft de simulatie leeg.
          </p>
        )}
      </div>
    </div>
  );
}
