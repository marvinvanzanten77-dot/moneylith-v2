import type { AnalysisResult } from "./analysis";
import type {
  IncomeItem,
  FixedCostManualItem,
  SchuldItem,
  MoneylithBucket,
  MoneylithTransaction,
} from "../types";

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
  transactions?: MoneylithTransaction[];
  netFree?: number;
};

const formatCurrency = (v: number) => `€${Math.round(v).toLocaleString("nl-NL")}`;

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
      lines.push(`- ${d.naam}: saldo ${formatCurrency(d.saldo || 0)}, min pm ${formatCurrency(d.minBetaling || 0)}`)
    );
  }
  if (raw.assets?.length) {
    lines.push("Vermogen/buffers:");
    raw.assets.slice(0, 10).forEach((a) => lines.push(`- ${a.naam}: ${formatCurrency(a.bedrag || 0)}`));
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
      `Transacties: ${raw.transactions.length} stuks, in: ${formatCurrency(totalIn)}, uit: ${formatCurrency(Math.abs(totalOut))}`
    );
  }

  return lines;
}

export function buildMoneylithPrompt(analysis: AnalysisResult, raw?: RawContext): MoneylithAiPayload {
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

  const user = [
    `Je bent een nuchtere financieel sparringpartner.`,
    `Je reageert in het Nederlands, kort en concreet.`,
    ``,
    `Hier is de geanalyseerde situatie uit Moneylith:`,
    ``,
    ...lines,
    ``,
    `Op basis hiervan:`,
    `1. Geef in 3 tot 5 bullets wat hier NU het belangrijkste is om op te focussen.`,
    `2. Geef één kernadvies in maximaal 3 zinnen.`,
    `3. Als er iets urgent is, noem dat expliciet als "WAARSCHUWING: ...".`,
    `4. Maak onderscheid tussen de korte termijn (0–3 maanden) en middellange termijn (3–24 maanden).`,
    ``,
    `Sluit af met een JSON-blok tussen <ACTIONS_JSON> en </ACTIONS_JSON>. Gebruik alleen dit schema; laat velden leeg als je het niet zeker weet:`,
    `<ACTIONS_JSON>`,
    `{`,
    `  "income": { "label": "", "amount": 0, "cadence": "monthly|weekly|yearly|unknown", "confidence": 0 },`,
    `  "fixedCosts": [{ "name": "", "amount": 0, "cadence": "monthly|weekly|yearly|unknown", "confidence": 0 }],`,
    `  "debts": [{ "name": "", "amount": 0, "confidence": 0 }],`,
    `  "goals": [{ "name": "", "target": 0, "deadline": "YYYY-MM-DD", "confidence": 0 }],`,
    `  "notes": []`,
    `}`,
    `</ACTIONS_JSON>`,
  ].join("\n");

  const system = [
    `Je bent de AI-adviseur van de app Moneylith.`,
    `Je krijgt al een voorbewerkte analyse (scores, niveaus, teksten).`,
    `Je hoeft geen berekeningen over te doen, alleen te interpreteren en helder te verwoorden.`,
    `Wees direct, eerlijk en to the point. Geen smalltalk, geen excuses, geen disclaimer-spam.`,
    `Je geeft geen juridisch of fiscaal advies, alleen praktische financiële duiding.`,
  ].join("\n");

  return { system, user };
}
