import React, { useEffect, useMemo, useState } from "react";
import { SchuldenkaartCard, type SchuldItem } from "../SchuldenkaartCard";
import type { FinancialSnapshot } from "../../types";
import type { AiActions } from "../../logic/extractActions";
import { buildDebtsPatchesFromActions, canApplyDebtsSuggestions } from "../../logic/applyDebtsSuggestions";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useAiOrchestrator, type TabKey } from "../../hooks/useAiOrchestrator";
import { appendAiMessage } from "../../logic/aiMessageBus";
import { TurnstileWidget } from "../TurnstileWidget";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "../../utils/format";
import { simulatePayoff, type StrategyKey, type CustomPlan } from "../../logic/debtSimulator";
import { buildCustomPlanFromAI } from "../../logic/buildCustomPlan";

interface StepSchuldenProps {
  onDebtSummary: (s: { totalDebt: number; totalMinPayment: number; debtCount: number }) => void;
  financialSnapshot?: FinancialSnapshot | null;
  debtSummary?: { totalDebt: number; totalMinPayment: number; debtCount: number };
  debts?: SchuldItem[];
  onDebtsChange?: (items: SchuldItem[]) => void;
  variant?: "personal" | "business";
  readOnly?: boolean;
  mode?: "personal" | "business";
  actions?: AiActions | null;
}

export function StepSchulden({
  onDebtSummary,
  financialSnapshot,
  debtSummary,
  debts = [],
  onDebtsChange,
  variant = "personal",
  readOnly = false,
  mode = "personal",
  actions = null,
}: StepSchuldenProps) {
  const snapshot = financialSnapshot ?? null;
  const debtCount = debtSummary?.debtCount ?? debts.length;
  const netFree = snapshot?.netFree ?? 0;
  const isReadOnly = readOnly === true;
  const storageKey = `moneylith.${variant}.debts.uploadStatus`;
  const pendingRowsKey = `moneylith.${variant}.debts.pendingRows`;
  const pendingNameKey = `moneylith.${variant}.debts.pendingFileName`;
  const [uploadStatus, setUploadStatus] = useLocalStorage<string | null>(storageKey, null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useLocalStorage<string | null>(pendingNameKey, null);
  const [pendingRows, setPendingRows] = useLocalStorage<SchuldItem[]>(pendingRowsKey, []);
  const applyCheck = canApplyDebtsSuggestions({ mode, actions, currentDebts: debts });
  const [view, setView] = useLocalStorage<"list" | "analysis">(`moneylith.${variant}.debts.view`, "list");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileNonce, setTurnstileNonce] = useState(0);
  const turnstileOptional =
    import.meta.env.VITE_TURNSTILE_OPTIONAL !== "false" || !import.meta.env.VITE_TURNSTILE_SITE_KEY;

  type StrategyCard = {
    key: StrategyKey;
    title: string;
    summary: string;
    pros: string[];
    cons: string[];
    recommended?: boolean;
  };
  const [strategies, setStrategies] = useLocalStorage<StrategyCard[]>(
    `moneylith.${variant}.debts.strategies`,
    []
  );
  const [selectedStrategy, setSelectedStrategy] = useLocalStorage<StrategyKey | null>(
    `moneylith.${variant}.debts.selectedStrategy`,
    null
  );
  const [aiNotes, setAiNotes] = useLocalStorage<Record<string, string>>(
    `moneylith.${variant}.debts.aiNotes`,
    {}
  );
  const [customStrategyText, setCustomStrategyText] = useState("");
  const [customPlan, setCustomPlan] = useState<CustomPlan | null>(null);
  const [lastSnapshot, setLastSnapshot] = useState<SchuldItem[] | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const [strategyProposals, setStrategyProposals] = useState<
    Record<
      string,
      {
        minPayment: number;
        monthsToClear: number | null;
        note: string;
        strategyKey?: StrategyKey;
      }
    >
  >({});

  const strategyKey: StrategyKey = (selectedStrategy as StrategyKey | null) ?? "balanced";
  const monthlyBudget = Math.max(
    netFree,
    snapshot?.monthlyPressure ?? debtSummary?.totalMinPayment ?? debts.reduce((sum, d) => sum + (d.minimaleMaandlast || 0), 0),
  );
  const simulation = simulatePayoff(
    debts,
    customPlan?.monthlyBudgetOverride ?? monthlyBudget,
    strategyKey,
    strategyKey === "custom" ? customPlan : undefined,
  );
  const totalDebt = simulation.totalDebtStart;
  const totalMinPayment = debts.reduce((sum, d) => sum + (d.minimaleMaandlast || 0), 0);
  const monthsToClear = simulation.monthsToZero;
  const freeAfterDebt = simulation.freeRoomNow;

  const { runAi } = useAiOrchestrator({
    mode,
    appendMessage: appendAiMessage,
    setLoading: setAiLoading,
    setLastActions: () => {},
  });

  const pressureLine =
    totalDebt > 0 && totalMinPayment > 0
      ? `Bij dit tempo: ${monthsToClear} maanden tot schuldenvrij`
      : "Nog geen realistisch aflostempo berekend";

  const psychologicalLine =
    totalDebt > 0 && totalMinPayment > 0
      ? `Bij dit tempo blijft deze schuld je nog ${monthsToClear ?? "?"} maanden volgen.`
      : totalMinPayment > 0
      ? `Elke maand gaat hier minimaal ${formatCurrency(totalMinPayment)} vast naar het verleden.`
      : "";

  const title = variant === "business" ? "Verplichtingen" : "Schulden";
  const subtitle =
    variant === "business"
      ? "Zakelijke schulden, contracten en regelingen die hoe dan ook betaald moeten worden."
      : "Zie in één oogopslag hoeveel druk je schulden zetten op je maand en waar de grootste knelpunten zitten.";

  const donutData = useMemo(() => {
    const paid = 0; // geen tracking van afbetaald, placeholder 0
    const remaining = totalDebt;
    const monthly = simulation.monthlyPressureNow > 0 ? simulation.monthlyPressureNow : 0;
    return {
      main: [
        { name: "Resterend", value: remaining },
        { name: "Afgelost", value: paid },
      ],
      monthly,
    };
  }, [totalDebt, simulation.monthlyPressureNow]);

  const createId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

  const parseCsvDebts = (text: string): SchuldItem[] => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return [];
    const delimiter = lines[0].includes(";") && lines[0].split(";").length >= lines[0].split(",").length ? ";" : ",";
    const parseLine = (line: string) => line.split(delimiter).map((s) => s.trim());
    const headerCells = parseLine(lines[0]).map((h) => h.toLowerCase());
    const hasHeader = headerCells.some((h) => h.includes("naam") || h.includes("bedrag") || h.includes("maand"));
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const headers = hasHeader ? headerCells : [];

    const nameIdx = headers.findIndex(
      (h) => h.includes("naam") || h.includes("schuld") || h.includes("crediteur") || h.includes("beschrijving")
    );
    const amountIdx = headers.findIndex(
      (h) =>
        h.includes("saldo") ||
        h.includes("bedrag") ||
        h.includes("rest") ||
        h.includes("openstaand") ||
        h.includes("restbedrag")
    );
    const minIdx = headers.findIndex(
      (h) =>
        h.includes("maand") ||
        h.includes("termijn") ||
        h.includes("minim") ||
        h.includes("betaling") ||
        h.includes("aflossing")
    );

    const toNumber = (value: string) => {
      const normalized = value.replace(/[€\s]/g, "").replace(",", ".");
      const num = parseFloat(normalized);
      return Number.isFinite(num) ? num : 0;
    };

    return dataLines
      .map((line) => {
        const cells = parseLine(line);
        const get = (idx: number | undefined, fallbackIdx?: number) => {
          if (typeof idx === "number" && idx >= 0 && idx < cells.length) return cells[idx];
          if (typeof fallbackIdx === "number" && fallbackIdx >= 0 && fallbackIdx < cells.length) return cells[fallbackIdx];
          return "";
        };
        const naam = get(nameIdx >= 0 ? nameIdx : 0);
        const saldoRaw = get(amountIdx >= 0 ? amountIdx : 1);
        const maandRaw = get(minIdx >= 0 ? minIdx : 2);
        const saldo = toNumber(saldoRaw);
        const minimaleMaandlast = toNumber(maandRaw);
        if (!naam && saldo === 0 && minimaleMaandlast === 0) return null;
        return { id: createId(), naam: naam || "Schuld", saldo, minimaleMaandlast: minimaleMaandlast || undefined };
      })
      .filter(Boolean) as SchuldItem[];
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const file = event.target.files?.[0];
    if (file) {
      setUploadError(null);
      setPendingFileName(file.name);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = (ev.target?.result as string) ?? "";
        const parsed = parseCsvDebts(text);
        if (!parsed.length) {
          setPendingRows([]);
          setUploadStatus(null);
          setUploadError("Kon geen schulden uit dit bestand lezen. Gebruik kolommen: naam, bedrag, maandbedrag.");
          return;
        }
        setPendingRows(parsed);
        setUploadStatus(`Bestand geladen (${file.name}). Klik 'Bestand uploaden' om over te nemen.`);
      };
      reader.onerror = () => {
        setPendingRows([]);
        setUploadStatus(null);
        setUploadError("Lezen van het bestand is mislukt.");
      };
      reader.readAsText(file);
    }
  };

  const handleApplyUpload = () => {
    if (isReadOnly || pendingRows.length === 0) return;
    const merged = [...debts, ...pendingRows];
    onDebtsChange?.(merged);
    setPendingRows([]);
    setPendingFileName(null);
    setUploadError(null);
    setUploadStatus("Bestand verwerkt en schulden toegevoegd.");
  };

  const uploadButtonDisabled = useMemo(() => isReadOnly || pendingRows.length === 0, [isReadOnly, pendingRows.length]);

  const handleApplyAiDebts = () => {
    if (isReadOnly || !applyCheck.ok || !actions) return;
    const patches = buildDebtsPatchesFromActions(actions);
    if (!patches.length) return;
    onDebtsChange?.(patches);
  };

  const runAiStrategies = async () => {
    if (isReadOnly) return;
    if (!turnstileOptional && !turnstileToken) {
      setAiError("Verificatie mislukt, probeer opnieuw.");
      return;
    }
    setAiError(null);
    setAiLoading(true);
    const system =
      "Moneylith schuldenanalyse. Geef exact 4 strategieën: snowball (klein->groot), balanced (mix), avalanche (groot->klein), custom (afgestemd op gebruiker).";
    const debtsList = debts
      .map(
        (d, idx) =>
          `${idx + 1}. ${d.naam || "schuld"} | saldo: €${d.saldo ?? 0} | maanddruk: €${d.minimaleMaandlast ?? 0} | afschrijfdag: ${
            d.afschrijfDag ?? 0
          }`,
      )
      .join("\n");
    const user = [
      "Genereer 4 strategieën met velden: key (snowball|balanced|avalanche|custom), title, summary, pros[], cons[], recommended (bool).",
      "Eerst een korte NL-samenvatting in mensentaal. Daarna alleen JSON tussen <STRAT_JSON> ... </STRAT_JSON> tags. Root: { strategies: Strategy[] }.",
      "Gebruik beknopte NL tekst; geen codeblokken.",
      "Schuldenlijst:",
      debtsList || "Geen schulden opgegeven",
    ].join("\n");
    try {
      const result = await runAi({
        tab: "schulden" as TabKey,
        system,
        user,
        turnstileToken: turnstileOptional ? undefined : turnstileToken,
      });
      if (!result) {
        setAiError("AI-analyse mislukt.");
        return;
      }
      // try parse JSON
      let parsed: any = null;
      try {
        const start = result.indexOf("<STRAT_JSON>");
        const end = result.indexOf("</STRAT_JSON>");
        const jsonPart = start >= 0 && end > start ? result.slice(start + "<STRAT_JSON>".length, end) : result;
        parsed = JSON.parse(jsonPart);
      } catch {
        parsed = null;
      }
      const list: StrategyCard[] =
        parsed?.strategies?.map((s: any) => ({
          key: s.key as StrategyKey,
          title: s.title || "",
          summary: s.summary || "",
          pros: Array.isArray(s.pros) ? s.pros : [],
          cons: Array.isArray(s.cons) ? s.cons : [],
          recommended: !!s.recommended,
        })) ?? [];
      if (list.length) {
        setStrategies(list.slice(0, 4));
        const rec = list.find((s) => s.recommended) ?? list[0];
        setSelectedStrategy(rec?.key ?? null);
        appendAiMessage({
          role: "assistant",
          content: `Strategieën gegenereerd. ${rec ? `Aanbevolen: ${rec.title}.` : ""} Klik een strategie om maanddruk in te vullen.`,
        });
      } else {
        setAiError("Geen strategieën gevonden.");
      }
    } catch (err) {
      console.error(err);
      setAiError("AI-analyse mislukt.");
    } finally {
      setAiLoading(false);
      setTurnstileToken(null);
      setTurnstileNonce((n) => n + 1);
    }
  };

  const applyStrategyToDebts = (strategy: StrategyCard) => {
    if (isReadOnly) return;
    setSelectedStrategy(strategy.key);
    setLastSnapshot(debts);
    if (strategy.key === "custom") {
      setStrategyProposals({});
      setView("list");
      return;
    }
    setCustomPlan(null);
    setCustomStrategyText("");
    const proposals: Record<string, { minPayment: number; monthsToClear: number | null; note: string; strategyKey?: StrategyKey }> = {};
    debts.forEach((d) => {
      const base =
        typeof d.minimaleMaandlast === "number" && d.minimaleMaandlast > 0
          ? d.minimaleMaandlast
          : Math.max(25, Math.round((d.saldo || 0) / 24) || 0);
      const factor = strategy.key === "snowball" ? 1.05 : strategy.key === "avalanche" ? 1.15 : 1.1;
      const minPayment = Math.max(1, Math.round(base * factor));
      const monthsToClear = minPayment > 0 ? Math.ceil((d.saldo || 0) / minPayment) : null;
      proposals[d.id] = {
        minPayment,
        monthsToClear,
        note: `Strategie ${strategy.title}: focus op ${
          strategy.key === "snowball" ? "kleinere" : strategy.key === "avalanche" ? "grotere" : "een mix van"
        } schulden. Bij ƒ,ª${minPayment} p/m is deze schuld in ${monthsToClear ?? "?"} maand(en) klaar.`,
        strategyKey: strategy.key,
      };
    });
    setStrategyProposals(proposals);
    setView("list");
  };

  const applyProposalToDebt = (debtId: string) => {
    if (isReadOnly) return;
    const proposal = strategyProposals[debtId];
    if (!proposal) return;
    const nextDebts = debts.map((d) =>
      d.id === debtId
        ? { ...d, minimaleMaandlast: proposal.minPayment, aiOpmerking: proposal.note }
        : d
    );
    onDebtsChange?.(nextDebts);
    setAiNotes((prev) => ({ ...prev, [debtId]: proposal.note }));
    setStrategyProposals((prev) => {
      const next = { ...prev };
      delete next[debtId];
      return next;
    });
  };

  const rejectProposalForDebt = (debtId: string) => {
    setStrategyProposals((prev) => {
      const next = { ...prev };
      delete next[debtId];
      return next;
    });
  };

  const clearAiNotes = () => {
    if (isReadOnly) return;
    setSelectedStrategy(null);
    setCustomPlan(null);
    setCustomStrategyText("");
    setAiNotes({});
    setStrategyProposals({});
    const reset = debts.map((d) => ({ ...d, aiOpmerking: undefined }));
    onDebtsChange?.(reset);
  };

  const undoAiApply = () => {
    if (isReadOnly) return;
    if (lastSnapshot) {
      onDebtsChange?.(lastSnapshot);
      setSelectedStrategy(null);
      setAiNotes({});
      setUndoVisible(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">{title}</h1>
          <p className="text-sm text-slate-400">{subtitle}</p>
          <p className="text-[11px] text-slate-500">
            AI leest je ingevoerde schulden mee en vult alleen voorstellen aan; je eigen waarden blijven staan.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-xs">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded-full px-3 py-1.5 font-semibold shadow ${
              view === "list"
                ? "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 shadow-amber-500/50"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Lijstweergave
          </button>
          <button
            type="button"
            onClick={() => setView("analysis")}
            className={`rounded-full px-3 py-1.5 font-semibold shadow ${
              view === "analysis"
                ? "bg-gradient-to-r from-indigo-400 to-purple-500 text-slate-900 shadow-purple-500/50"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Analyse
          </button>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>Strategie:</span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-amber-200">
              {selectedStrategy ? selectedStrategy : "geen"}
            </span>
            {!isReadOnly && (
              <button
                type="button"
                onClick={clearAiNotes}
                className="underline text-slate-300 hover:text-white"
              >
                Wis AI-opmerkingen
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
            <span className="rounded-full bg-slate-800 px-2 py-0.5">Schulden: {debts.length}</span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5">
              Laatste analyse: {strategies.length ? "aanwezig" : "nog niet"}
            </span>
            {!isReadOnly && (
              <button
                type="button"
                onClick={runAiStrategies}
                className="rounded-full bg-amber-500 px-2 py-0.5 font-semibold text-slate-900"
              >
                Analyseer opnieuw
              </button>
            )}
          </div>
          {Object.keys(strategyProposals).length > 0 && (
            <div className="text-[11px] text-amber-200">
              AI-voorstellen staan klaar. Je vindt ze in de lijstweergave per schuld en kunt ze per stuk accepteren.
            </div>
          )}
        </div>
      </div>

      {view === "list" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 flex flex-col gap-3">
            <div className="card-shell p-4 text-slate-900">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {variant === "business" ? "Je zakelijke verplichtingen" : "Je schulden"}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {variant === "business"
                      ? "Overzicht van leningen, belastingregelingen, leases en andere vaste verplichtingen. Dit bepaalt je minimale maanddruk."
                      : "Breng al je schulden in kaart en zie meteen de impact."}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {applyCheck.ok && !isReadOnly && (
                    <button
                      type="button"
                      onClick={handleApplyAiDebts}
                      className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-400"
                    >
                      Neem AI-suggesties over
                    </button>
                  )}
                  <span className="text-xs text-slate-500">Totaal: {debtCount} stuks</span>
                </div>
              </div>
              <div className="mb-3 rounded-lg border border-amber-200/70 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Je zit nu in lijstweergave. Wissel naar <span className="font-semibold">Analyse</span> voor strategieën, donut
                en AI-opmerkingen; terug naar lijst om bedragen te bewerken.
              </div>
              <SchuldenkaartCard
                items={debts.map((d) => ({
                  ...d,
                  aiOpmerking: d.aiOpmerking ?? aiNotes[d.id],
                }))}
                proposals={strategyProposals}
                onAcceptProposal={applyProposalToDebt}
                onRejectProposal={rejectProposalForDebt}
                onChange={(next) => {
                  if (isReadOnly) return;
                  (onDebtsChange ?? (() => {}))(next);
                }}
                onSummaryChange={onDebtSummary}
                variant={variant}
                readOnly={isReadOnly}
              />
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white/60 p-4 text-sm text-slate-800">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Totaal schuld</span>
                    <span className="font-semibold">{formatCurrency(totalDebt)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Maanddruk (maand 1, strategie)</span>
                    <span className="font-semibold">{formatCurrency(simulation.monthlyPressureNow)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Vrije ruimte na schulden</span>
                    <span className="font-semibold">{formatCurrency(freeAfterDebt)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tijd tot nul bij huidig tempo</span>
                    <span className="font-semibold">
                      {monthsToClear ? `${monthsToClear} maanden` : "Nog geen realistisch aflostempo berekend"}
                    </span>
                  </div>
                </div>
                {psychologicalLine ? <p className="mt-3 text-xs text-slate-600">{psychologicalLine}</p> : null}
              </div>
            </div>

            {variant === "personal" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
                <h3 className="text-lg font-semibold text-slate-50">Bulk-upload schulden</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Upload een CSV (kolommen: naam, bedrag, maandbedrag). Klik daarna op "Bestand uploaden" om ze toe te voegen.
                </p>
                <div className="mt-3">
                  <input
                    type="file"
                    accept=".csv"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-amber-500 file:px-3 file:py-2 file:font-semibold file:text-slate-900"
                    onChange={handleUpload}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApplyUpload}
                    disabled={uploadButtonDisabled}
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 disabled:opacity-50"
                  >
                    Bestand uploaden
                  </button>
                  {pendingFileName && (
                    <span className="text-[11px] text-slate-300">
                      {pendingFileName} ({pendingRows.length} regel{pendingRows.length === 1 ? "" : "s"})
                    </span>
                  )}
                </div>
                {uploadStatus && <p className="mt-2 text-xs text-amber-200">{uploadStatus}</p>}
                {uploadError && <p className="mt-1 text-xs text-red-300">{uploadError}</p>}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-slate-50">
            <h2 className="text-lg font-semibold text-slate-50">Schulddruk op je maand</h2>
            <p className="mt-1 text-xs text-slate-400">Samenvatting van je totale schuld en minimale maandelijkse druk.</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Totaal schuld</span>
                <span className="font-semibold">{formatCurrency(totalDebt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Maanddruk (maand 1, strategie)</span>
                <span className="font-semibold">{formatCurrency(simulation.monthlyPressureNow)}</span>
              </div>
              <div className="flex justify-between">
                <span>Vrije ruimte na schulden</span>
                <span className="font-semibold">{formatCurrency(freeAfterDebt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tijd tot nul bij huidig tempo</span>
                <span className="font-semibold">
                  {monthsToClear ? `${monthsToClear} maanden` : "Nog geen realistisch aflostempo berekend"}
                </span>
              </div>
            </div>
            {pressureLine ? <p className="mt-3 text-xs text-slate-400">{pressureLine}</p> : null}
          </div>
        </div>
      )}

      {view === "analysis" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">AI-analyse</h3>
                  <p className="text-xs text-slate-400">
                    Genereer 4 strategieën (incl. Custom) en kies er één. AI leest je ingevulde schulden mee, vult alleen aan en laat jouw invoer staan.
                  </p>
                  <p className="text-[11px] text-slate-500">Stap 1: Analyseer schulden · Stap 2: Kies strategie · Stap 3: Bekijk ingevulde lijst.</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={runAiStrategies}
                    disabled={aiLoading}
                    className="rounded-lg bg-purple-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {aiLoading ? "Analyseren..." : "Analyseer schulden"}
                  </button>
                  <TurnstileWidget
                    key={`debts-turnstile-${turnstileNonce}`}
                    siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ""}
                    onVerify={(token) => setTurnstileToken(token)}
                    theme="dark"
                  />
                </div>
              </div>
              {aiError && <p className="mt-2 text-xs text-red-300">{aiError}</p>}
              <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {strategies.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => applyStrategyToDebts(s)}
                    className={`rounded-xl border p-3 text-left text-xs transition ${
                      selectedStrategy === s.key
                        ? "border-amber-400 bg-amber-500/20 shadow-amber-500/30"
                        : "border-slate-700 bg-slate-900/40 hover:border-amber-300 hover:bg-slate-900/60"
                    }`}
                    title="AI vult alleen aan; jouw invoer blijft staan."
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-100">{s.title}</span>
                      {/* Aanbevolen badge verwijderd voor rust */}
                    </div>
                    <p className="mt-2 text-slate-200">{s.summary}</p>
                    <div className="mt-2 space-y-1 text-slate-300">
                      <div>
                        <span className="font-semibold text-emerald-400">+ Pro's:</span>
                        <ul className="ml-3 list-disc">
                          {s.pros.map((p, idx) => (
                            <li key={idx}>{p}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="font-semibold text-red-300">- Con's:</span>
                        <ul className="ml-3 list-disc">
                          {s.cons.map((c, idx) => (
                            <li key={idx}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </button>
                ))}
                {!strategies.length && <p className="text-xs text-slate-400">Nog geen strategieën. Klik op Analyseer.</p>}
              </div>

      {selectedStrategy === "custom" && (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-200">
          <p className="text-[11px] text-slate-300">
            Custom: geef je wensen. Voorbeeld: “Prioriteit: schuldA,schuldB. Extra: schuldA=150. Budget: 450”.
          </p>
                  <textarea
                    className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900/80 p-2 text-xs text-slate-100"
                    rows={3}
                    value={customStrategyText}
                    onChange={(e) => setCustomStrategyText(e.target.value)}
                    placeholder="Typ instructies voor de custom strategie..."
                  />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-900"
                onClick={() => {
                  const idByName: Record<string, string> = {};
                  debts.forEach((d) => {
                    if (d.naam) {
                      idByName[d.naam.toLowerCase()] = d.id;
                      idByName[d.naam] = d.id;
                    }
                  });
                  const plan = buildCustomPlanFromAI(customStrategyText, idByName);
                  setCustomPlan(plan);
                  setView("list");
                }}
              >
                Zet om naar plan
              </button>
                    {customPlan && (
                      <span className="text-[11px] text-emerald-200">
                        Plan actief: {customPlan.priorityOrder?.length ? `volgorde ${customPlan.priorityOrder.length}` : "geen volgorde"} · extra:{" "}
                        {customPlan.extraPerDebt ? Object.keys(customPlan.extraPerDebt).length : 0} · budget:{" "}
                        {customPlan.monthlyBudgetOverride ?? "standaard"}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-slate-50">
            <h3 className="text-lg font-semibold">Visualisatie</h3>
            <p className="text-xs text-slate-400">Totaal vs. maanddruk</p>
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    dataKey="value"
                    data={donutData.main}
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {donutData.main.map((_, idx) => (
                      <Cell key={idx} fill={idx === 0 ? "#f97316" : "#1d4ed8"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }}
                    itemStyle={{ color: "#e2e8f0" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {donutData.monthly > 0 && (
              <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-200">
                <div className="flex items-center justify-between">
                  <span>Maanddruk (maand 1, strategie)</span>
                  <span className="font-semibold">{formatCurrency(donutData.monthly)}</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-amber-400"
                    style={{ width: "70%" }}
                  />
                </div>
              </div>
            )}
            <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-200 space-y-1">
              <div className="flex justify-between">
                <span>Schulden</span>
                <span className="font-semibold">{formatCurrency(totalDebt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Maanddruk (maand 1, strategie)</span>
                <span className="font-semibold">{formatCurrency(simulation.monthlyPressureNow)}</span>
              </div>
              <div className="flex justify-between">
                <span>Vrij na schulden</span>
                <span className="font-semibold">{formatCurrency(freeAfterDebt)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
