import type { Observation } from "../hooks/useObserver";
import type { SnapshotV2 } from "./snapshot";

export type AnalysisMode = "personal" | "business";
export type AnalysisLevel = "ok" | "warning" | "critical";

export type TabKey =
  | "income"
  | "fixedCosts"
  | "cashflow"
  | "debts"
  | "assets"
  | "goals"
  | "risk"
  | "overview";

export interface TabAnalysis {
  level: AnalysisLevel;
  messages: string[];
  metrics: Record<string, number | null>;
}

export interface AnalysisResult {
  mode: AnalysisMode;
  tabs: Record<TabKey, TabAnalysis>;
  overallScore: number;
  overallLevel: AnalysisLevel;
  lastUpdated: string;
}

const levelFromPressure = (ratio: number): AnalysisLevel => {
  if (ratio <= 0.5) return "ok";
  if (ratio <= 0.7) return "warning";
  return "critical";
};

const analyseIncome = (source: Observation["personal"]): TabAnalysis => {
  const snap = source?.snapshot as SnapshotV2;
  const income = snap?.netIncome ?? 0;
  const level: AnalysisLevel = income > 0 ? "ok" : "warning";
  const messages: string[] = [];
  if (income > 0) {
    messages.push("Er komt maandelijks omzet binnen.");
  } else {
    messages.push("Nog geen omzet ingevuld.");
  }
  return { level, messages, metrics: { income } };
};

const analyseFixedCosts = (source: Observation["personal"]): TabAnalysis => {
  const snap = source?.snapshot as SnapshotV2;
  const fixed = snap?.fixedCosts ?? 0;
  const level: AnalysisLevel = fixed > 0 ? "ok" : "warning";
  const messages: string[] = [];
  if (fixed > 0) {
    messages.push("Vaste kosten zijn geregistreerd.");
  } else {
    messages.push("Nog geen vaste kosten ingevuld.");
  }
  return { level, messages, metrics: { fixed } };
};

const analyseCashflow = (source: Observation["personal"]): TabAnalysis => {
  const snap = source?.snapshot as SnapshotV2;
  const income = snap?.netIncome ?? 0;
  const fixed = snap?.fixedCosts ?? 0;
  const netFree = snap?.freeCash ?? income - fixed;
  const pressureRatio = snap?.fixedCostPressure ?? (income > 0 ? fixed / income : 0);
  const level = levelFromPressure(pressureRatio);
  const messages: string[] = [];
  if (income <= 0) {
    messages.push("Nog geen inkomsten, cashflow niet berekenbaar.");
  } else {
    messages.push(`Vaste lasten nemen ${Math.round(pressureRatio * 100)}% van de omzet in.`);
  }
  return {
    level,
    messages,
    metrics: {
      income,
      fixed,
      netFree,
      pressureRatio,
    },
  };
};

const analyseDebts = (source: Observation["personal"]): TabAnalysis => {
  const snap = source?.snapshot as SnapshotV2;
  const totalDebt = snap?.totalDebts ?? 0;
  const income = snap?.netIncome ?? 0;
  const minPayment = source?.totals?.minPayment ?? 0;
  const ratio = income > 0 ? totalDebt / income : null;
  let level: AnalysisLevel = "ok";
  if (totalDebt === 0) level = "ok";
  else if ((ratio ?? 0) > 6) level = "critical";
  else if ((ratio ?? 0) > 3) level = "warning";
  const messages: string[] = [];
  if (totalDebt > 0) {
    messages.push(`Totale schuld: €${totalDebt.toFixed(0)}; maanddruk: €${minPayment.toFixed(0)}.`);
  } else {
    messages.push("Geen schulden ingevoerd.");
  }
  return {
    level,
    messages,
    metrics: { totalDebt, minPayment, debtIncomeRatio: ratio ?? null },
  };
};

const analyseAssets = (source: Observation["personal"]): TabAnalysis => {
  const snap = source?.snapshot as SnapshotV2;
  const assets = snap?.totalAssets ?? 0;
  const fixed = snap?.fixedCosts ?? 0;
  const runway = snap?.bufferMonths ?? (fixed > 0 ? assets / fixed : null);
  let level: AnalysisLevel = "warning";
  if (runway === null) level = "warning";
  else if (runway < 1) level = "critical";
  else if (runway < 3) level = "warning";
  else level = "ok";
  const messages: string[] = [];
  if (assets > 0 && runway !== null) {
    messages.push(`Buffer dekt ongeveer ${runway.toFixed(1)} maanden vaste lasten.`);
  } else {
    messages.push("Buffer/runway niet berekenbaar.");
  }
  return {
    level,
    messages,
    metrics: { assets, runway: runway ?? null },
  };
};

const analyseGoals = (source: Observation["personal"]): TabAnalysis => {
  const snap = source?.snapshot as SnapshotV2;
  const goalsCount = snap?.goalsCount ?? source?.goals?.length ?? 0;
  const messages: string[] = [];
  let level: AnalysisLevel = "ok";
  if (goalsCount === 0) {
    level = "warning";
    messages.push("Nog geen doelen ingesteld.");
  } else {
    messages.push(`Aantal doelen: ${goalsCount}.`);
  }
  return {
    level,
    messages,
    metrics: { goalsCount },
  };
};

const analyseRisk = (source: Observation["personal"]): TabAnalysis => {
  const fundamentFilled = source?.status?.fundamentFilled ?? false;
  const schuldenFilled = source?.status?.schuldenFilled ?? false;
  const vermogenFilled = source?.status?.vermogenFilled ?? false;
  const level: AnalysisLevel = fundamentFilled && (schuldenFilled || vermogenFilled) ? "ok" : "warning";
  const messages: string[] = [];
  if (!fundamentFilled) messages.push("Fundament mist gegevens.");
  if (!schuldenFilled) messages.push("Geen schuldenstatus bekend.");
  if (!vermogenFilled) messages.push("Buffer/vermogen onbekend.");
  if (messages.length === 0) messages.push("Basis voor risicobeeld aanwezig.");
  return {
    level,
    messages,
    metrics: {
      fundamentFilled: fundamentFilled ? 1 : 0,
      schuldenFilled: schuldenFilled ? 1 : 0,
      vermogenFilled: vermogenFilled ? 1 : 0,
    },
  };
};

const analyseOverview = (tabs: {
  income: TabAnalysis;
  fixedCosts: TabAnalysis;
  cashflow: TabAnalysis;
  debts: TabAnalysis;
  assets: TabAnalysis;
  goals: TabAnalysis;
  risk: TabAnalysis;
}): TabAnalysis => {
  const levels = Object.values(tabs).map((t) => t.level);
  let level: AnalysisLevel = "ok";
  if (levels.includes("critical")) level = "critical";
  else if (levels.includes("warning")) level = "warning";
  const messages: string[] = [];
  if (level === "ok") messages.push("Financiële basis is overwegend stabiel.");
  if (level === "warning") messages.push("Er zijn aandachtspunten die druk geven op je maand.");
  if (level === "critical") messages.push("Meerdere kritieke punten: cashflow en buffer herzien.");
  return { level, messages, metrics: {} };
};

const deriveOverall = (tabs: Record<TabKey, TabAnalysis>): { overallScore: number; overallLevel: AnalysisLevel } => {
  const mapScore: Record<AnalysisLevel, number> = { ok: 100, warning: 60, critical: 20 };
  const scores = Object.values(tabs).map((t) => mapScore[t.level]);
  const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  let overallLevel: AnalysisLevel = "ok";
  const levels = Object.values(tabs).map((t) => t.level);
  if (levels.filter((l) => l === "critical").length > 0) overallLevel = "critical";
  else if (levels.filter((l) => l === "warning").length > 0) overallLevel = "warning";
  return { overallScore, overallLevel };
};

export function analyseObservation(observation: Observation, mode: AnalysisMode): AnalysisResult {
  const source = mode === "business" ? observation.business : observation.personal;

  const income = analyseIncome(source);
  const fixedCosts = analyseFixedCosts(source);
  const cashflow = analyseCashflow(source);
  const debts = analyseDebts(source);
  const assets = analyseAssets(source);
  const goals = analyseGoals(source);
  const risk = analyseRisk(source);

  const tabs: Record<TabKey, TabAnalysis> = {
    income,
    fixedCosts,
    cashflow,
    debts,
    assets,
    goals,
    risk,
    overview: analyseOverview({ income, fixedCosts, cashflow, debts, assets, goals, risk }),
  };

  const { overallScore, overallLevel } = deriveOverall(tabs);

  return {
    mode,
    tabs,
    overallScore,
    overallLevel,
    lastUpdated: new Date().toISOString(),
  };
}
