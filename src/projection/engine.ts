/** Derived values only. Money is integer EUR cents; dates are calendar dates, never local instants. */
export type Event = {
  id: string;
  label: string;
  date: string | null;
  amount: number | null;
  source: string;
  basis: "input" | "assumption" | "scenario";
  kind?: "cash" | "reserve" | "repayment";
  debtId?: string;
};
export type Goal = {
  label: string;
  date: string | null;
  remaining: number | null;
  monthly: number | null;
};
export type Input = {
  scope: "personal" | "business-real";
  asOf: string;
  opening: number | null;
  reserve: number | null;
  events: Event[];
  debts: Record<string, number>;
  missing: string[];
  assumptions: string[];
  goals: Goal[];
  savedScenario?: Event[];
};
export type Options = {
  monthlyDay: number | null;
  variableMonthly: number | null;
  confirmOpening: boolean;
  reservedNow?: number | null;
};
export const emptyOptions = (): Options => ({
  monthlyDay: null,
  variableMonthly: null,
  confirmOpening: false,
  reservedNow: null,
});
export type Scenario = {
  kind:
    | "income"
    | "expense"
    | "purchase"
    | "repayment"
    | "reserve"
    | "move"
    | "saved";
  amount: number;
  date: string;
  target?: string;
};
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function validDate(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    s >= "1900-01-01" &&
    s <= "2200-12-31" &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s
  );
}
export function addDays(date: string, days: number) {
  return new Date(Date.parse(date + "T00:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function monthlyDates(asOf: string, day: number | null, start = asOf) {
  if (day === null) return [];
  const result: string[] = [];
  const origin = new Date(asOf + "T00:00:00Z");
  for (let m = 0; m < 14; m++) {
    const y = origin.getUTCFullYear(),
      month = origin.getUTCMonth() + m;
    const end = new Date(Date.UTC(y, month + 1, 0)).getUTCDate();
    const date = new Date(Date.UTC(y, month, Math.min(day, end)))
      .toISOString()
      .slice(0, 10);
    if (date > asOf && date >= start && date <= addDays(asOf, 365))
      result.push(date);
  }
  return result;
}
export function validateOptions(value: unknown): Options {
  if (!value || typeof value !== "object") return emptyOptions();
  const o = value as Options;
  if (
    o.reservedNow != null &&
    (!Number.isSafeInteger(o.reservedNow) ||
      o.reservedNow < 0 ||
      o.reservedNow > 1e11)
  )
    throw Error("Ongeldige huidige reservering.");
  if (
    (o.monthlyDay !== null &&
      (!Number.isInteger(o.monthlyDay) ||
        o.monthlyDay < 1 ||
        o.monthlyDay > 31)) ||
    (o.variableMonthly !== null &&
      (!Number.isSafeInteger(o.variableMonthly) ||
        o.variableMonthly < 0 ||
        o.variableMonthly > 1e11)) ||
    typeof o.confirmOpening !== "boolean"
  )
    throw Error("Ongeldige projectie-aannames.");
  return {
    monthlyDay: o.monthlyDay,
    variableMonthly: o.variableMonthly,
    confirmOpening: o.confirmOpening,
    reservedNow: o.reservedNow ?? null,
  };
}
export function validateScenario(
  value: unknown,
  input: Input,
): Scenario | null {
  if (value == null) return null;
  const s = value as Scenario;
  if (
    ![
      "income",
      "expense",
      "purchase",
      "repayment",
      "reserve",
      "move",
      "saved",
    ].includes(s.kind) ||
    !Number.isSafeInteger(s.amount) ||
    Math.abs(s.amount) > 1e11 ||
    !validDate(s.date) ||
    s.date <= input.asOf ||
    s.date > addDays(input.asOf, 365) ||
    (!["income", "expense"].includes(s.kind) && s.amount < 0)
  )
    throw Error(
      "Vul een geldig scenariobedrag en een toekomstige datum binnen één jaar in.",
    );
  if (
    s.kind === "repayment" &&
    (!s.target ||
      input.debts[s.target] === undefined ||
      s.amount > input.debts[s.target])
  )
    throw Error(
      "Kies een bestaande schuld; los niet meer af dan de bekende hoofdsom.",
    );
  if (s.kind === "saved" && !input.savedScenario?.length)
    throw Error("Geen opgeslagen scenario beschikbaar.");
  if (
    s.kind === "move" &&
    !input.events.some((e) => e.id === s.target && e.source === "invoice")
  )
    throw Error("Kies een openstaande factuur.");
  return {
    kind: s.kind,
    amount: s.amount,
    date: s.date,
    ...(s.target ? { target: s.target } : {}),
  };
}
export function project(input: Input, scenario: Scenario | null = null) {
  if (!validDate(input.asOf)) throw Error("Ongeldige peildatum.");
  const s = validateScenario(scenario, input);
  let events = input.events.map((e) => ({ ...e }));
  if (s?.kind === "saved")
    events.push(...input.savedScenario!.map((e) => ({ ...e })));
  else if (s?.kind === "move")
    events = events.map((e) =>
      e.id === s.target ? { ...e, date: s.date, basis: "scenario" } : e,
    );
  else if (s) {
    const dates = ["income", "expense"].includes(s.kind)
      ? monthlyDates(input.asOf, Number(s.date.slice(8)), s.date)
      : [s.date];
    for (const date of dates)
      events.push({
        id: "scenario:" + date,
        label: (
          {
            income: "Extra maandinkomen",
            expense: "Wijziging maandlast",
            purchase: "Eenmalige aankoop",
            repayment: "Extra aflossing",
            reserve: "Extra reservering",
          } as const
        )[s.kind],
        date,
        amount: ["income", "reserve"].includes(s.kind) ? s.amount : -s.amount,
        kind:
          s.kind === "reserve"
            ? "reserve"
            : s.kind === "repayment"
              ? "repayment"
              : "cash",
        debtId: s.target,
        source: "scenario",
        basis: "scenario",
      });
  }
  const missing = [...input.missing];
  for (const e of events)
    if (
      (e.date === null || e.date > input.asOf) &&
      (e.amount === null || (e.date === null && e.amount !== 0))
    )
      missing.push(
        `${e.label}: ${e.amount === null ? "bedrag onbekend" : "betaaldatum onbekend"}`,
      );
  if (input.reserve === null)
    missing.push("Huidige reserveringen niet ingevuld");
  if (input.opening === null)
    missing.push("Huidig rekeningsaldo ontbreekt of is niet bevestigd");
  const canProject =
    input.missing.length === 0 &&
    input.opening !== null &&
    !events.some((e) => e.date === null && e.amount !== 0);
  let bank = input.opening,
    reserve = input.reserve;
  const debts = { ...input.debts };
  const applied: Event[] = [];
  const days: {
    date: string;
    cash: number | null;
    available: number | null;
  }[] = [];
  events.sort(
    (a, b) =>
      (a.date ?? "9999").localeCompare(b.date ?? "9999") ||
      a.id.localeCompare(b.id),
  );
  const byDate = new Map<string, Event[]>();
  for (const e of events)
    if (e.date) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  for (let day = 1; day <= 365; day++) {
    const date = addDays(input.asOf, day);
    for (const original of byDate.get(date) ?? []) {
      const e = { ...original };
      if (e.kind === "repayment" && e.debtId && e.amount !== null) {
        e.amount = -Math.min(debts[e.debtId] ?? 0, Math.abs(e.amount));
        debts[e.debtId] = (debts[e.debtId] ?? 0) + e.amount;
      }
      if (e.kind === "reserve")
        reserve =
          reserve === null || e.amount === null ? null : reserve + e.amount;
      else bank = bank === null || e.amount === null ? null : bank + e.amount;
      applied.push(e);
    }
    days.push({
      date,
      cash: canProject ? bank : null,
      available:
        canProject && bank !== null && reserve !== null ? bank - reserve : null,
    });
  }
  const horizons = [7, 30, 90, 365].map((day) => ({ day, ...days[day - 1] }));
  const relevant = days.slice(0, 90);
  const lowest = relevant.every((d) => d.available !== null)
    ? relevant.reduce((a, b) => (b.available! < a.available! ? b : a))
    : null;
  const weeks = Array.from({ length: 13 }, (_, i) => {
    const ds = relevant.slice(i * 7, i * 7 + 7);
    return {
      from: ds[0].date,
      to: ds.at(-1)!.date,
      minimum: ds.every((d) => d.available !== null)
        ? Math.min(...ds.map((d) => d.available!))
        : null,
    };
  });
  const tightestWeek = lowest
    ? weeks.reduce((a, b) => (b.minimum! < a.minimum! ? b : a))
    : null;
  return {
    unit: "EUR-cent" as const,
    asOf: input.asOf,
    opening: input.opening,
    reserve: input.reserve,
    complete: horizons[2].available !== null,
    missing: [...new Set(missing)],
    assumptions: input.assumptions,
    goals: input.goals.map((g) => ({
      ...g,
      requiredMonthly:
        g.date && g.date > input.asOf && g.remaining !== null
          ? Math.ceil(
              g.remaining /
                Math.max(
                  1,
                  Math.ceil(
                    (Date.parse(g.date) - Date.parse(input.asOf)) /
                      86400000 /
                      30,
                  ),
                ),
            )
          : null,
    })),
    horizons,
    lowest,
    tightestWeek,
    pressureWeeks: weeks.filter((w) => w.minimum !== null && w.minimum < 0),
    events: [...applied, ...events.filter((e) => e.date === null)],
    scenario: s,
  };
}
export function compare(input: Input, scenario: Scenario | null) {
  const baseline = project(input),
    alternative = scenario ? project(input, scenario) : baseline;
  return {
    baseline,
    scenario: alternative,
    differences: baseline.horizons.map((p, i) => ({
      day: p.day,
      cash:
        p.cash === null || alternative.horizons[i].cash === null
          ? null
          : alternative.horizons[i].cash! - p.cash,
      available:
        p.available === null || alternative.horizons[i].available === null
          ? null
          : alternative.horizons[i].available! - p.available,
    })),
  };
}
