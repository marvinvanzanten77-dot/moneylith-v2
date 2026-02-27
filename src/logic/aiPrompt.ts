import type { AnalysisResult } from "./analysis";
import type {
  IncomeItem,
  FixedCostManualItem,
  SchuldItem,
  MoneylithBucket,
  MoneylithTransaction,
  FutureIncomeItem,
} from "../types";
import type { MoneylithSnapshot } from "../core/moneylithSnapshot";

export interface MoneylithAiPayload {
  system: string;
  user: string;
}

type RawContext = {
  incomes?: IncomeItem[];
  fixed?: FixedCostManualItem[];
  debts?: SchuldItem[];
  assets?: { id: string; naam: string; bedrag: number }[];
  buckets?: MoneylithBucket[];
  futureIncomes?: FutureIncomeItem[];
  transactions?: MoneylithTransaction[];
  netFree?: number;
};

type ExtraRawContext = { label: string; raw: RawContext };

const formatCurrency = (v: number) => `€ ${Math.round(v).toLocaleString("nl-NL")}`;

function buildRawSection(raw?: RawContext): string[] {
  if (!raw) return [];
  const lines: string[] = [];

  if (typeof raw.netFree === "number") {
    lines.push(`Netto vrije ruimte p/m: ${formatCurrency(raw.netFree)}`);
  }

  if (raw.incomes?.length) {
    lines.push("Inkomen (handmatig):");
    raw.incomes.slice(0, 10).forEach((i) => lines.push(`- ${i.naam || "inkomen"}: ${formatCurrency(i.bedrag || 0)}`));
  }
  if (raw.fixed?.length) {
    lines.push("Vaste lasten (handmatig):");
    raw.fixed.slice(0, 10).forEach((f) => lines.push(`- ${f.naam}: ${formatCurrency(f.bedrag || 0)}`));
  }
  if (raw.debts?.length) {
    lines.push("Schulden:");
    raw.debts.slice(0, 10).forEach((d) =>
      lines.push(`- ${d.naam}: saldo ${formatCurrency(d.saldo || 0)}, min pm ${formatCurrency(d.minBetaling || 0)}`),
    );
  }
  if (raw.assets?.length) {
    lines.push("Vermogen/buffers:");
    raw.assets.slice(0, 10).forEach((a) => lines.push(`- ${a.naam}: ${formatCurrency(a.bedrag || 0)}`));
  }
  if (raw.futureIncomes?.length) {
    lines.push("Toekomstige inkomsten:");
    raw.futureIncomes.slice(0, 10).forEach((i) => {
      const date = i.datum ? ` (${i.datum})` : "";
      lines.push(`- ${i.naam || "inkomen"}: ${formatCurrency(i.bedrag || 0)}${date}`);
    });
  }
  if (raw.buckets?.length) {
    lines.push("Potjes (variabel):");
    raw.buckets
      .filter((b) => b.type !== "fixed")
      .slice(0, 10)
      .forEach((b) => lines.push(`- ${b.label}: ${formatCurrency(b.monthlyAvg || 0)} p/m`));
  }
  if (raw.transactions?.length) {
    const totalIn = raw.transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalOut = raw.transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
    lines.push(
      `Transacties: ${raw.transactions.length} stuks, in: ${formatCurrency(totalIn)}, uit: ${formatCurrency(Math.abs(totalOut))}`,
    );
  }

  return lines;
}

function buildMissingSection(raw?: RawContext): string[] {
  if (!raw) return [];
  const missing: string[] = [];
  if (!raw.incomes?.length) missing.push("inkomen");
  if (!raw.fixed?.length) missing.push("vaste lasten");
  if (!raw.debts?.length) missing.push("schulden");
  if (!raw.assets?.length) missing.push("vermogen/buffers");
  if (!raw.buckets?.length) missing.push("potjes");
  if (!raw.transactions?.length) missing.push("transacties/imports");
  return missing.length ? [`Ontbrekende invoer: ${missing.join(", ")}.`] : [];
}

export function buildMoneylithPrompt(
  analysis: AnalysisResult,
  raw?: RawContext,
  extras?: ExtraRawContext[],
  snapshot?: MoneylithSnapshot,
): MoneylithAiPayload {
  const { mode, overallLevel, overallScore, tabs } = analysis;

  const modeLabel = mode === "personal" ? "persoonlijke financiën" : "zakelijke financiën";

  const lines: string[] = [];

  lines.push(`Modus: ${modeLabel}`);
  lines.push(`Algemene score: ${overallScore.toFixed(0)} / 100 (${overallLevel}).`);

  ("income,fixedCosts,cashflow,debts,assets,goals,risk,overview".split(",") as const).forEach((key) => {
    const tab = tabs[key];
    if (!tab) return;

    const titleMap: Record<string, string> = {
      income: "Inkomen",
      fixedCosts: "Vaste lasten",
      cashflow: "Cashflow",
      debts: "Schulden",
      assets: "Vermogen",
      goals: "Doelen",
      risk: "Risico & Zekerheid",
      overview: "Totaalbeeld",
    };

    lines.push("");
    lines.push(`== ${titleMap[key]} ==`);
    lines.push(`Niveau: ${tab.level}`);
    if (tab.messages?.length) {
      tab.messages.forEach((m) => lines.push(`- ${m}`));
    }
  });

  const rawSection = buildRawSection(raw);
  if (rawSection.length) {
    lines.push("");
    lines.push("== Invoer uit de app ==");
    lines.push(...rawSection);
  }

  const missing = buildMissingSection(raw);
  if (missing.length) {
    lines.push("");
    lines.push(...missing);
  }

  if (extras && extras.length) {
    extras.forEach((extra) => {
      const extraSection = buildRawSection(extra.raw);
      if (!extraSection.length) return;
      lines.push("");
      lines.push(`== Extra context (${extra.label}) ==`);
      lines.push(...extraSection);
      const missingExtra = buildMissingSection(extra.raw);
      if (missingExtra.length) lines.push(...missingExtra);
    });
  }

  if (snapshot) {
    lines.push("");
    lines.push("== Snapshot meta ==");
    if (snapshot.meta?.selectedMonth) lines.push(`Geselecteerde maand: ${snapshot.meta.selectedMonth}`);
    lines.push(`Bank gekoppeld: ${snapshot.meta?.bank?.connected ? "ja" : "nee"}`);
    if (snapshot.meta?.bank?.lastSyncAt) lines.push(`Laatste bank-sync: ${snapshot.meta.bank.lastSyncAt}`);
    const msgCount = snapshot.ai?.messages?.length ?? 0;
    lines.push(`AI chatgeschiedenis: ${msgCount} bericht(en)`);
    if (msgCount > 0) {
      snapshot.ai.messages.slice(-5).forEach((m) => lines.push(`- [${m.role}] ${m.content.slice(0, 140)}`));
    }
  }

  const user = [
    `Context uit Moneylith (snapshots, doelen, potjes, transacties):`,
    ...lines,
    ``,
    `Hanteer deze regels bij het beantwoorden van de gebruikersvraag:`,
    `- Antwoord in gewoon Nederlands, plain text.`,
    `- Geef geen advies tenzij de gebruiker er expliciet om vraagt; beschrijf en analyseer wat er nu speelt.`,
    `- Vermijd code, JSON en templates tenzij de gebruiker expliciet om "code" of "implementatie" vraagt. Als je code zou geven, herschrijf naar gewone taal.`,
    `- Als data ontbreekt, benoem dat en maak geen aannames.`,
    `- Dit antwoord is gebaseerd op de data die nu bekend is; meer ingevoerde data = scherper inzicht.`,
  ].join("\n");

  const system = [
    `Je bent de AI van Moneylith. Spreek altijd in plain text (geen code, geen JSON) en houd het kort en feitelijk.`,
    `Geen advies of stappenplan tenzij de gebruiker er expliciet om vraagt.`,
    `Als er toch code in je output sluipt, herschrijf je dit direct naar gewone taal.`,
    `Baseer je uitsluitend op de meegegeven Moneylith-context en benoem ontbrekende data in plaats van te raden.`,
  ].join("\n");

  return { system, user };
}
