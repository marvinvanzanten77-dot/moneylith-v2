import {
  addDays,
  compare,
  monthlyDates,
  type Input,
  type Options,
  type Scenario,
} from "./engine.js";
/** Deliberately bounded parser: one explicit euro amount, no guessed debt or invoice. */
export function questionScenario(
  question: string,
  input: Input,
  options: Options,
): { scenario: Scenario | null; note: string } {
  const q = question.toLowerCase();
  const values = [
    ...q.matchAll(
      /(?:€\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*euro\b)/g,
    ),
  ];
  if (
    values.length !== 1 ||
    /\d{1,3}[.]\d{3}|\d{1,3},\d{3}/.test(q) ||
    /\b(niet|geen|minder)\b/.test(q)
  )
    return { scenario: null, note: "" };
  const amount = Math.round(
    Number((values[0][1] ?? values[0][2]).replace(",", ".")) * 100,
  );
  let kind: Scenario["kind"] | null = null,
    target: string | undefined;
  if (/extra.{0,25}aflos|aflos.{0,25}extra/.test(q)) {
    kind = "repayment";
    const ids = Object.keys(input.debts);
    if (ids.length !== 1)
      return {
        scenario: null,
        note: "Kies bij Vooruitblik welke schuld je extra wilt aflossen.",
      };
    target = ids[0];
    if (amount > input.debts[target])
      return {
        scenario: null,
        note: "Het gevraagde bedrag is hoger dan de bekende hoofdsom; kies een geldig aflosbedrag.",
      };
  } else if (/reserver|apart zet/.test(q)) kind = "reserve";
  else if (/inkomsten|inkomen/.test(q) && /extra|stijg|meer/.test(q))
    kind = "income";
  else if (/eenmalig|aankoop/.test(q)) kind = "purchase";
  if (!kind) return { scenario: null, note: "" };
  const explicit = q.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (explicit)
    return {
      scenario: null,
      note: "Pas een scenario met een specifieke datum toe via Vooruitblik.",
    };
  const date =
    kind === "income"
      ? monthlyDates(input.asOf, options.monthlyDay)[0]
      : addDays(input.asOf, 1);
  if (!date)
    return {
      scenario: null,
      note: "Kies eerst een maandelijks betaalmoment bij Vooruitblik.",
    };
  return {
    scenario: { kind, amount, date, target },
    note: `Alleen voor deze vraag doorgerekend: ${kind === "income" ? "maandelijkse netto verandering vanaf" : "eenmalige verandering op"} ${date}. Dit is een expliciete rekenaanname, geen gewijzigde administratie.`,
  };
}
export function projectionQuestion(q: string) {
  return /vooruitblik|scenario|\b(7|30|90) dagen|krap|komende betaling|extra.{0,25}aflos|aflos.{0,25}extra|reserver|inkom.{0,50}(stijg|extra)|extra.{0,30}inkom/iu.test(
    q,
  );
}
const euro = (n: number | null) =>
  n === null
    ? "onbekend"
    : new Intl.NumberFormat("nl-NL", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
      }).format(n / 100);
export function projectionSummary(
  result: ReturnType<typeof compare>,
  note: string,
) {
  const { baseline, scenario, differences } = result;
  const lines = [
    "Berekend door Moneylith (peildatum " + baseline.asOf + "):",
    ...(note ? [note] : []),
  ];
  for (const [i, p] of baseline.horizons.slice(0, 3).entries())
    lines.push(
      `${p.day} dagen: beschikbaar ${euro(p.available)}${scenario.scenario ? ` → scenario ${euro(scenario.horizons[i].available)}; verschil ${euro(differences[i].available)}` : ""}.`,
    );
  const week = scenario.tightestWeek;
  lines.push(
    week
      ? `Laagste week: ${week.from} t/m ${week.to}; beschikbaar minimaal ${euro(week.minimum)}.`
      : "De krapste week is nog onbekend.",
  );
  const biggest = scenario.events
    .filter(
      (e) =>
        e.date &&
        e.date <= addDays(baseline.asOf, 90) &&
        e.amount !== null &&
        e.kind !== "reserve",
    )
    .sort((a, b) => Math.abs(b.amount!) - Math.abs(a.amount!))[0];
  if (biggest)
    lines.push(
      `Grootste bekende geldbeweging: ${biggest.label.slice(0, 160)}, ${biggest.date}, ${euro(biggest.amount)} (${biggest.basis === "input" ? "ingevoerd" : "aanname/scenario"}).`,
    );
  if (scenario.missing.length)
    lines.push(
      "Nog nodig: " +
        scenario.missing.slice(0, 8).join("; ") +
        (scenario.missing.length > 8
          ? "; overige ontbrekende gegevens staan bij Vooruitblik"
          : "") +
        ".",
    );
  lines.push(
    "Deze verwachting hangt af van de getoonde aannames en volledigheid van de invoer; dit is geen garantie.",
  );
  return lines.join("\n");
}
