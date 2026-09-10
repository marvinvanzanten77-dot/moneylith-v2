import { addMonth, cashSign, monthEnd, type BusinessData } from "./model";
import { calculateBusiness, missingFor, reviewSections } from "./finance";
import type { BusinessTab } from "./copy";

export function analyzePatterns(data: BusinessData) {
  const checks = reviewSections(data);
  if (![checks.cash, checks.income, checks.costs].every((r) => r.ready))
    return null;
  const months = Array.from({ length: 6 }, (_, index) =>
    addMonth(data.month, index - 5),
  );
  const start = months[0] + "-01",
    end = monthEnd(data.month);
  const movements = data.movements.filter(
    (m) => m.date >= start && m.date <= end && m.kind !== "transfer",
  );
  const trend = months.map((month) => {
    const rows = movements.filter((m) => m.date.startsWith(month));
    const incoming = rows
      .filter((m) => cashSign(m, data) > 0)
      .reduce((s, m) => s + m.amount, 0);
    const outgoing = rows
      .filter((m) => cashSign(m, data) < 0)
      .reduce((s, m) => s + m.amount, 0);
    return {
      month,
      observed: rows.length > 0,
      incoming,
      outgoing,
      net: incoming - outgoing,
    };
  });
  // Group invoice observations, not instalment payments of the same invoice.
  const groups = new Map<
    string,
    { label: string; kind: "sale" | "cost"; months: Map<string, number> }
  >();
  for (const doc of data.documents.filter(
    (d) => d.date >= start && d.date <= end && d.kind !== "asset",
  )) {
    const key =
      doc.kind +
      ":" +
      doc.label.trim().toLocaleLowerCase("nl-NL").replace(/\s+/g, " ");
    const group = groups.get(key) ?? {
      label: doc.label,
      kind: doc.kind as "sale" | "cost",
      months: new Map<string, number>(),
    };
    const month = doc.date.slice(0, 7);
    group.months.set(month, (group.months.get(month) ?? 0) + doc.net);
    groups.set(key, group);
  }
  const recurring = [...groups.values()]
    .filter((g) => g.months.size >= 2)
    .map((g) => ({
      label: g.label,
      kind: g.kind,
      months: g.months.size,
      average: Math.round(
        [...g.months.values()].reduce((s, n) => s + n, 0) / g.months.size,
      ),
      varying: new Set(g.months.values()).size > 1,
    }));
  const current = data.documents.filter((d) => d.date.startsWith(data.month));
  const topCosts = current
    .filter((d) => d.kind === "cost")
    .sort((a, b) => b.net - a.net)
    .slice(0, 3);
  const income = current
    .filter((d) => d.kind === "sale")
    .reduce((s, d) => s + d.net, 0);
  const largestSale = current
    .filter((d) => d.kind === "sale")
    .sort((a, b) => b.net - a.net)[0];
  return {
    trend,
    recurring,
    topCosts,
    largestSale,
    largestShare:
      income > 0 && largestSale
        ? Math.round((largestSale.net / income) * 100)
        : null,
  };
}

export function goalProgress(
  data: BusinessData,
  goal: BusinessData["goals"][number],
) {
  const result = calculateBusiness(data);
  const current =
    goal.kind === "revenue"
      ? result.checks.income.ready
        ? result.income
        : null
      : goal.current;
  return {
    current,
    remaining: current === null ? null : Math.max(0, goal.target - current),
    source:
      goal.kind === "revenue"
        ? `Gecontroleerde omzet excl. btw in ${data.month}`
        : goal.kind === "repay"
          ? "Handmatig bijgehouden afgelost bedrag"
          : "Handmatig bijgehouden gereserveerd bedrag",
  };
}

export function stepProgress(
  data: BusinessData,
  tab: BusinessTab,
  checks = reviewSections(data),
): string {
  const keys = {
    foundation: ["income", "costs", "plan"],
    debts: ["debts"],
    assets: ["assets", "reserves"],
    accounts: ["cash"],
    patterns: ["cash", "income", "costs"],
    inbox: ["income", "costs"],
  } as const;
  if (tab in keys) {
    const relevant = keys[tab as keyof typeof keys];
    const hasInput = relevant.some((key) =>
      key === "plan"
        ? [data.plan.revenue, data.plan.costs, data.plan.draw].some(
            (v) => v !== null,
          )
        : key === "reserves"
          ? data.plan.taxPercent !== null ||
            data.plan.buffer !== null ||
            data.plan.taxPaymentCadence != null
          : checks[key].hasRows,
    );
    return relevant.every((key) => checks[key].ready)
      ? "Gecontroleerd"
      : hasInput
        ? "Te controleren"
        : "Nog te doen";
  }

  if (tab === "forecast")
    return missingFor(data, "forecast").length ? "Nog te doen" : "Beschikbaar";
  if (tab === "intent")
    return data.profile.name && data.profile.goal ? "Ingevuld" : "Nog te doen";
  if (tab === "goals") return data.goals.length ? "Ingevuld" : "Optioneel";
  return "Optioneel";
}

export function guideFor(
  data: BusinessData,
  tab: BusinessTab,
): { text: string; target: BusinessTab; action: string } {
  const checks = reviewSections(data);
  if (tab === "patterns")
    return {
      text: [checks.cash, checks.income, checks.costs].every((r) => r.ready)
        ? "Vergelijk de maanden met geregistreerde betalingen. Herhaling in facturen is een aanwijzing, geen garantie voor volgend werk."
        : "Controleer eerst beginsaldi, facturen en betalingen. Zonder die controle geeft de gids geen patroonoordeel.",
      target:
        !checks.income.ready || !checks.costs.ready ? "foundation" : "accounts",
      action:
        !checks.income.ready || !checks.costs.ready
          ? "Controleer facturen"
          : "Controleer rekeningen",
    };
  if (tab === "goals")
    return {
      text: "Een omzetdoel volgt de gecontroleerde maandomzet. Een buffer of investering volgt apart gezet geld; een aflosdoel volgt al afgeloste hoofdsom. Doelen boeken zelf geen bedragen.",
      target: "foundation",
      action: "Controleer de omzetbasis",
    };
  if (tab === "inbox")
    return {
      text: "Registreer eerst de factuur en koppel daarna de betaling. Documentupload en OCR zijn nog niet aangesloten.",
      target: "patterns",
      action: "Koppel een betaling",
    };
  if (tab === "forecast")
    return {
      text: missingFor(data, "forecast").length
        ? "Nog nodig: " +
          missingFor(data, "forecast").join(", ") +
          ". Vul aan en bevestig opnieuw."
        : "De prognose maakt onderscheid tussen belastingbetaling en geld dat nog gereserveerd blijft. Controleer de gekozen betaalfrequentie; dit is geen aangifteschema.",
      target: "settings",
      action: "Controleer reserveringen",
    };
  const next =
    !checks.income.ready || !checks.costs.ready
      ? "foundation"
      : !checks.cash.ready
        ? "accounts"
        : !checks.debts.ready
          ? "debts"
          : "forecast";
  return {
    text: "Werk per stap je administratie bij. Na een relevante wijziging vervalt de controlebevestiging. Een ontbrekend bedrag is geen nul.",
    target: next,
    action:
      next === "forecast"
        ? "Bekijk de vooruitblik"
        : "Ga naar de volgende controle",
  };
}
