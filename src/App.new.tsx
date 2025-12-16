import { useEffect, useMemo, useState } from "react";
import { IncomeFixedCard } from "./components/IncomeFixedCard";
import { FixedCostsList } from "./components/FixedCostsList";
import { SchuldenkaartCard } from "./components/SchuldenkaartCard";
import { VermogenCard } from "./components/VermogenCard";
import { AiAssistantCard } from "./components/AiAssistantCard";
import { DashboardSummary } from "./components/DashboardSummary";
import { useLocalStorage } from "./hooks/useLocalStorage";
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

type StepKey = "fundament" | "ritme" | "focus" | "action";
type ActionZoneType = "overleven" | "aflossen" | "opbouwen" | "stabiliseren";
type AflosMode = "minimum" | "aggressive";

type DebtSummary = {
  totalDebt: number;
  totalMinPayment: number;
  debtCount: number;
};

type AssetSummary = {
  totalAssets: number;
  assetsCount: number;
};

const steps: { key: StepKey; label: string; desc: string }[] = [
  { key: "fundament", label: "Fundament", desc: "Inkomen, vaste lasten, netto ruimte" },
  { key: "ritme", label: "Ritme", desc: "Maandbudget, afschrijvingsritme, maandstatus" },
  { key: "focus", label: "Focus", desc: "Kies je richting voor deze maand" },
  { key: "action", label: "Actie", desc: "Modules passend bij je focus" },
];

const focusOptions = ["Overleven", "Schulden afbouwen", "Opbouwen", "Stabiliseren"];

const normalizeFocus = (focus: string) => focus.trim().toLowerCase();

const ActionZone = ({
  type,
  onDebtSummary,
  aflosMode,
  setAflosMode,
  debtClearMonthsAggressive,
  onAssetSummary,
  assetTarget,
  setAssetTarget,
  assetMonthlyContribution,
  setAssetMonthlyContribution,
}: {
  type: ActionZoneType;
  onDebtSummary: (s: DebtSummary) => void;
  aflosMode: AflosMode;
  setAflosMode: (mode: AflosMode) => void;
  debtClearMonthsAggressive: number | null;
  onAssetSummary: (s: AssetSummary) => void;
  assetTarget: number;
  setAssetTarget: (val: number) => void;
  assetMonthlyContribution: number;
  setAssetMonthlyContribution: (val: number) => void;
}) => {
  let primary: React.ReactNode = (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-slate-700">Primary slot (leeg)</div>
  );
  let secondary: React.ReactNode = (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-slate-700">Secondary slot (leeg)</div>
  );
  let timeline: React.ReactNode = (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-slate-700">Timeline slot (leeg)</div>
  );

  if (type === "aflossen") {
    primary = (
      <div className="space-y-3">
        <div className="mb-2 flex flex-col gap-2 text-sm text-slate-800 md:flex-row md:items-center md:gap-4">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="aflosMode"
              value="minimum"
              checked={aflosMode === "minimum"}
              onChange={() => setAflosMode("minimum")}
            />
            Aflossen op minimum (minimale maandlast)
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="aflosMode"
              value="aggressive"
              checked={aflosMode === "aggressive"}
              onChange={() => setAflosMode("aggressive")}
              disabled={!debtClearMonthsAggressive}
            />
            Aflossen op maximale ruimte
          </label>
        </div>
        <SchuldenkaartCard onSummaryChange={onDebtSummary} />
      </div>
    );
    secondary = (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-slate-700">
        Hier komt later offersimulatie.
      </div>
    );
    timeline = (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-slate-700">
        Hier komt later een aflostijdlijn.
      </div>
    );
  }

  if (type === "opbouwen") {
    primary = (
      <div className="space-y-3">
        <div className="card-shell p-3 text-slate-900 space-y-2">
          <p className="text-sm text-slate-700">Opbouw-instellingen</p>
          <label className="flex flex-col gap-1 text-sm text-slate-800">
            <span className="text-xs font-semibold text-slate-600">Doelvermogen</span>
            <input
              type="number"
              min={0}
              className="rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
              value={Number.isFinite(assetTarget) ? assetTarget : 0}
              onChange={(e) => setAssetTarget(parseFloat(e.target.value) || 0)}
              placeholder="10000"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-800">
            <span className="text-xs font-semibold text-slate-600">Maandelijkse inleg voor opbouw</span>
            <input
              type="number"
              min={0}
              className="rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
              value={Number.isFinite(assetMonthlyContribution) ? assetMonthlyContribution : 0}
              onChange={(e) => setAssetMonthlyContribution(parseFloat(e.target.value) || 0)}
              placeholder="300"
            />
          </label>
        </div>
        <VermogenCard onSummaryChange={onAssetSummary} />
      </div>
    );
    secondary = (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-slate-700">
        Hier komt later een groeiplan.
      </div>
    );
    timeline = (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-slate-700">
        Hier komt later een vermogenslijn.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card-shell p-4 text-slate-900 space-y-3">
        <p className="text-sm text-slate-600">Actiepad</p>
        <h3 className="text-lg font-semibold text-slate-900">Actiemodules voor {type}</h3>
        <p className="text-sm text-slate-700">Actiemodules voor {type} komen hier.</p>
        <div className="space-y-2 text-xs text-slate-500">
          <div className="action-primary">{primary}</div>
          <div className="action-secondary">{secondary}</div>
          <div className="action-timeline">{timeline}</div>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [currentStep, setCurrentStep] = useState<StepKey>("fundament");
  const [unlockedSteps, setUnlockedSteps] = useState<StepKey[]>(["fundament"]);
  const [selectedMonth, setSelectedMonth] = useState<MonthId>("2025-12");
  const [selectedFocus, setSelectedFocus] = useState<string>("");
  const [showOverview, setShowOverview] = useState(false);
  const [debtsSummary, setDebtsSummary] = useState<DebtSummary>({ totalDebt: 0, totalMinPayment: 0, debtCount: 0 });
  const [assetsSummary, setAssetsSummary] = useState<AssetSummary>({ totalAssets: 0, assetsCount: 0 });
  const [aflosMode, setAflosMode] = useState<AflosMode>("minimum");
  const [assetMonthlyContribution, setAssetMonthlyContribution] = useState<number>(0);
  const [assetTarget, setAssetTarget] = useState<number>(0);

  const [netIncome] = useLocalStorage<number>("income-netto", 0);
  const [fixedCosts] = useLocalStorage<number>("fixed-costs", 0);

  // systeemaanname v1 (geen UI)
  const bufferTargetMonths = 3;
  const bufferMonthlyReserve = 200;

  const isFundamentValid = (income: number, costs: number) => income > 0 && costs >= 0 && Number.isFinite(income - costs);

  const fundamentValid = isFundamentValid(netIncome ?? 0, fixedCosts ?? 0);
  const ritmeValid = fundamentValid && !!selectedMonth;
  const focusValid = ritmeValid && selectedFocus.length > 0;

  const debtClearMonths =
    debtsSummary.totalDebt > 0 && debtsSummary.totalMinPayment > 0
      ? Math.ceil(debtsSummary.totalDebt / debtsSummary.totalMinPayment)
      : null;
  const debtClearMonthsAggressive =
    netIncome > 0 && debtsSummary.totalDebt > 0 ? Math.ceil(debtsSummary.totalDebt / netIncome) : null;
  const debtClearMonthsBuffered =
    netIncome - bufferMonthlyReserve > 0 && debtsSummary.totalDebt > 0
      ? Math.ceil(debtsSummary.totalDebt / (netIncome - bufferMonthlyReserve))
      : null;

  const assetTargetMonths =
    assetMonthlyContribution > 0
      ? Math.ceil(Math.max(assetTarget - assetsSummary.totalAssets, 0) / assetMonthlyContribution)
      : null;

  const fixedCostPressure = netIncome > 0 ? fixedCosts / netIncome : null;
  const runwayMonths = fixedCosts > 0 && assetsSummary.totalAssets > 0 ? Math.floor(assetsSummary.totalAssets / fixedCosts) : null;

  useEffect(() => {
    setUnlockedSteps((prev) => {
      const next = new Set(prev);
      if (fundamentValid) next.add("ritme");
      if (ritmeValid) next.add("focus");
      if (focusValid) next.add("action");
      return Array.from(next) as StepKey[];
    });
  }, [fundamentValid, ritmeValid, focusValid]);

  useEffect(() => {
    if (focusValid && !unlockedSteps.includes("action")) {
      setCurrentStep("action");
    }
  }, [focusValid, unlockedSteps]);

  const quickSummary = useMemo(() => {
    const free = (netIncome ?? 0) - (fixedCosts ?? 0);
    return {
      free,
      month: selectedMonth,
      focus: selectedFocus || "Nog geen focus gekozen",
      status: free >= 0 ? "Onder controle" : "Kwetsbaar",
    };
  }, [netIncome, fixedCosts, selectedMonth, selectedFocus]);

  const handleStepClick = (step: StepKey) => {
    if (unlockedSteps.includes(step)) {
      setCurrentStep(step);
    }
  };

  const renderFundament = () => (
    <div className="space-y-4">
      <p className="text-sm text-slate-200">Hier leg je je basis vast: wat komt er elke maand binnen en wat gaat er zeker uit.</p>
      <IncomeFixedCard />
    </div>
  );

  const renderRitme = () => {
    const statusColor = quickSummary.free > 0 ? "text-emerald-500" : "text-red-500";
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-200">Hier geef je je maand een ritme: welke maand bekijk je, en wat is je vaste afschrijvingspatroon.</p>
        <div className="card-shell p-4 text-slate-900 space-y-2">
          <label className="block text-sm font-semibold text-slate-800" htmlFor="month-select">
            Maandbudget (periode)
          </label>
          <input
            id="month-select"
            type="month"
            min="2020-01"
            max="2035-12"
            list="month-options"
            className="mt-1 block w-full rounded-lg border border-white/40 bg-white/80 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value as MonthId)}
          />
          <datalist id="month-options">
            {MONTHS.map((month) => (
              <option key={month.id} value={month.id}>
                {month.label}
              </option>
            ))}
          </datalist>
          <div className="text-xs text-slate-600">
            Maandstatus: <span className={statusColor}>{quickSummary.status}</span>
          </div>
        </div>
        <FixedCostsList />
      </div>
    );
  };

  const renderFocus = () => (
    <div className="space-y-4">
      <p className="text-sm text-slate-200">Kies wat deze maand voor jou het belangrijkst is: overleven, aflossen, opbouwen of stabiliseren.</p>
      <div className="card-shell p-4 text-slate-900 space-y-2">
        {focusOptions.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="radio"
              name="focus"
              value={opt}
              checked={selectedFocus === opt}
              onChange={(e) => setSelectedFocus(e.target.value)}
            />
            {opt}
          </label>
        ))}
      </div>
      <DashboardSummary selectedMonth={selectedMonth} />
    </div>
  );

  const renderAction = () => {
    const focusKey = normalizeFocus(selectedFocus);

    if (!focusKey) {
      return (
        <div className="space-y-4">
          <div className="card-shell p-4 text-slate-900 space-y-2">
            <p className="text-sm text-slate-600">Actiepad</p>
            <h3 className="text-lg font-semibold text-slate-900">Nog geen focus</h3>
            <p className="text-sm text-slate-700">Maak eerst je focus-keuze in stap 3.</p>
          </div>
        </div>
      );
    }

    return (
      <ActionZone
        type={focusKey as ActionZoneType}
        onDebtSummary={(s) => setDebtsSummary(s)}
        onAssetSummary={(s) => setAssetsSummary(s)}
        aflosMode={aflosMode}
        setAflosMode={setAflosMode}
        debtClearMonthsAggressive={debtClearMonthsAggressive}
        assetTarget={assetTarget}
        setAssetTarget={setAssetTarget}
        assetMonthlyContribution={assetMonthlyContribution}
        setAssetMonthlyContribution={setAssetMonthlyContribution}
      />
    );
  };

  const renderContent = () => {
    if (currentStep === "fundament") return renderFundament();
    if (currentStep === "ritme") return renderRitme();
    if (currentStep === "focus") return renderFocus();
    if (currentStep === "action") return renderAction();
    return null;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-50">
      <div className="grid min-h-screen grid-cols-1 gap-4 lg:grid-cols-[220px_1fr_320px]">
        <aside className="border-r border-white/10 bg-white/10 px-4 py-6 backdrop-blur">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">Pad</h2>
          <div className="space-y-2">
            {steps.map((step) => {
              const unlocked = unlockedSteps.includes(step.key);
              const active = currentStep === step.key;
              return (
                <button
                  key={step.key}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => handleStepClick(step.key)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    active
                      ? "bg-white text-slate-900 shadow-md"
                      : unlocked
                        ? "bg-white/10 text-slate-200 hover:bg-white/20"
                        : "cursor-not-allowed bg-white/5 text-slate-500"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{step.label}</span>
                    <span className="text-[10px]">{active ? "Actief" : unlocked ? "Open" : "Gesloten"}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{step.desc}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-6">
            <button
              type="button"
              className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/20"
              onClick={() => setShowOverview(true)}
              disabled={!focusValid}
              title="Toon het totaaloverzicht"
            >
              Totaaloverzicht
            </button>
          </div>
        </aside>

        <section className="px-4 py-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">Moneylith / Finance OS</p>
              <h1 className="text-2xl font-semibold text-white">Finance Planner</h1>
            </div>
            <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
              Stap: {steps.find((s) => s.key === currentStep)?.label}
            </div>
          </div>
          <div className="space-y-4">{renderContent()}</div>
        </section>

        <aside className="border-l border-white/10 bg-white/10 px-4 py-6 backdrop-blur">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">AI gids</h2>
          <AiAssistantCard
            selectedMonth={selectedMonth}
            currentStep={currentStep}
            selectedFocus={selectedFocus}
            debtsTotal={debtsSummary.totalDebt}
            debtsMinPayment={debtsSummary.totalMinPayment}
            debtsCount={debtsSummary.debtCount}
            debtClearMonths={debtClearMonths}
            debtClearMonthsAggressive={debtClearMonthsAggressive}
            debtClearMonthsBuffered={debtClearMonthsBuffered}
            aflosMode={aflosMode}
            bufferMonthlyReserve={bufferMonthlyReserve}
            bufferTargetMonths={bufferTargetMonths}
            assetsTotal={assetsSummary.totalAssets}
            assetsCount={assetsSummary.assetsCount}
            assetsMonthlyContribution={assetMonthlyContribution}
            assetTarget={assetTarget}
            assetTargetMonths={assetTargetMonths}
            fixedCostPressure={fixedCostPressure}
            runwayMonths={runwayMonths}
          />
          <div className="mt-3 text-[11px] text-slate-400">
            Context: stap {currentStep}, maand {selectedMonth}, focus {selectedFocus || "-"}
          </div>
        </aside>
      </div>

      {showOverview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur">
          <div className="card-shell w-full max-w-3xl p-6 text-slate-900">
            <h3 className="text-lg font-semibold text-slate-900">Totaaloverzicht</h3>
            <p className="text-xs text-slate-600">
              Maand: {selectedMonth} • Focus: {selectedFocus || "Nog niet gekozen"} • Netto ruimte: €{quickSummary.free.toFixed(0)} • Actief pad: {selectedFocus ? `${selectedFocus} → Actie` : "Nog geen focus"}
            </p>
            <p className="text-xs text-slate-600">
              Actiemodules: {normalizeFocus(selectedFocus) === "schulden afbouwen"
                ? `Schulden: ${debtsSummary.debtCount} stuks • Totaal: €${debtsSummary.totalDebt.toFixed(2)} • Min. maandlast: €${debtsSummary.totalMinPayment.toFixed(2)}`
                : normalizeFocus(selectedFocus) === "opbouwen"
                  ? `Vermogen: ${assetsSummary.assetsCount} posten • Totaal: €${assetsSummary.totalAssets.toFixed(2)}`
                  : "(nog leeg)"}
            </p>
            {normalizeFocus(selectedFocus) === "schulden afbouwen" ? (
              debtClearMonths !== null ? (
                <p className="text-xs text-slate-600">Geschatte aflostijd: ± {debtClearMonths} maanden (op basis van minimale maandlast)</p>
              ) : debtsSummary.totalDebt > 0 ? (
                <p className="text-xs text-slate-600">Geen aflostijd te berekenen (minimale maandlast = €0)</p>
              ) : null
            ) : null}
            {normalizeFocus(selectedFocus) === "schulden afbouwen" && debtClearMonthsAggressive !== null ? (
              <p className="text-xs text-slate-600">Aflostijd bij maximale ruimte: ± {debtClearMonthsAggressive} maanden (op basis van volledige netto maandruimte)</p>
            ) : null}
            {normalizeFocus(selectedFocus) === "schulden afbouwen" && debtClearMonthsBuffered !== null ? (
              <p className="text-xs text-slate-600">Met buffer-opbouw: ± {debtClearMonthsBuffered} maanden (eerst €{bufferMonthlyReserve} p/m naar buffer)</p>
            ) : null}
            {normalizeFocus(selectedFocus) === "schulden afbouwen" ? (
              <p className="text-xs text-slate-600">
                Actieve modus: {aflosMode === "minimum" ? "Aflossen op minimum (minimale maandlast)" : "Aflossen op maximale ruimte (volledige netto maandruimte)"}
              </p>
            ) : null}
            {normalizeFocus(selectedFocus) === "opbouwen" ? (
              assetMonthlyContribution > 0 && assetTargetMonths !== null ? (
                assetTargetMonths === 0 ? (
                  <p className="text-xs text-slate-600">Doelvermogen: doel al bereikt</p>
                ) : (
                  <p className="text-xs text-slate-600">Doelvermogen: nog ± {assetTargetMonths} maanden bij huidige inleg</p>
                )
              ) : assetMonthlyContribution === 0 ? (
                <p className="text-xs text-slate-600">Doelvermogen: geen opbouwtempo (maandelijkse inleg is 0)</p>
              ) : (
                <p className="text-xs text-slate-600">Doelvermogen: niet berekenbaar</p>
              )
            ) : null}
            <div className="mt-3 grid gap-3 text-sm text-slate-800 md:grid-cols-2">
              <div className="rounded-xl border border-white/30 bg-white/80 p-3 shadow-sm">
                <p className="text-xs uppercase text-slate-500">Fundament</p>
                <p>Inkomen: €{(netIncome ?? 0).toFixed(0)}</p>
                <p>Vaste lasten: €{(fixedCosts ?? 0).toFixed(0)}</p>
                <p>Vrij: €{quickSummary.free.toFixed(0)}</p>
              </div>
              <div className="rounded-xl border border-white/30 bg-white/80 p-3 shadow-sm">
                <p className="text-xs uppercase text-slate-500">Ritme</p>
                <p>Maand: {selectedMonth}</p>
                <p>Status: {quickSummary.status}</p>
              </div>
              <div className="rounded-xl border border-white/30 bg-white/80 p-3 shadow-sm">
                <p className="text-xs uppercase text-slate-500">Focus</p>
                <p>Keuze: {selectedFocus || "Nog niet gekozen"}</p>
              </div>
              <div className="rounded-xl border border-white/30 bg-white/80 p-3 shadow-sm">
                <p className="text-xs uppercase text-slate-500">Stabiliteit</p>
                <p>Lastendruk: {fixedCostPressure !== null ? `${(fixedCostPressure * 100).toFixed(0)}% van je inkomen naar vaste lasten` : "Niet berekenbaar"}</p>
                <p>Runway: {runwayMonths !== null ? `${runwayMonths} maanden vaste lasten uit vermogen` : "Geen runway berekenbaar"}</p>
                <p>
                  Doelvermogen: {
                    assetMonthlyContribution > 0 && assetTargetMonths !== null
                      ? assetTargetMonths === 0
                        ? "doel al bereikt"
                        : `nog ± ${assetTargetMonths} maanden bij huidige inleg`
                      : assetMonthlyContribution === 0
                        ? "geen opbouwtempo (maandelijkse inleg is 0)"
                        : "niet berekenbaar"
                  }
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:shadow-md"
                onClick={() => setShowOverview(false)}
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default App;
