import type { MoneylithSnapshotDomain } from "../core/moneylithSnapshot.js";
import {
  manualReviewRows,
  reviewSection,
  type InputReviews,
} from "../logic/inputReadiness.js";
import {
  calculateBusiness,
  missingFor,
  forecastBusiness,
} from "../business/finance.js";
import { gross, vat, monthEnd, type BusinessData } from "../business/model.js";
import {
  addDays,
  monthlyDates,
  validDate,
  type Event,
  type Input,
  type Options,
} from "./engine.js";
const rows = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v)
    ? v.filter(
        (r): r is Record<string, unknown> =>
          !!r && typeof r === "object" && !Array.isArray(r),
      )
    : [];
const amount = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e9
    ? Math.round(v * 100)
    : null;
const cents = (v: unknown): number | null =>
  typeof v === "number" && Number.isSafeInteger(v) && Math.abs(v) <= 1e11
    ? v
    : null;
const name = (r: Record<string, unknown>) =>
  String(r.naam ?? r.label ?? r.name ?? "Naam ontbreekt");
function recurring(
  input: Input,
  id: string,
  label: string,
  value: number | null,
  day: number | null,
  source: string,
  extra: Partial<Event> = {},
  start?: string,
) {
  const dates = monthlyDates(input.asOf, day, start);
  if (!dates.length)
    input.events.push({
      id,
      label,
      date: null,
      amount: value,
      source,
      basis: "assumption",
      ...extra,
    });
  for (const date of dates)
    input.events.push({
      id: id + ":" + date,
      label,
      date,
      amount: value,
      source,
      basis: "assumption",
      ...extra,
    });
}
export function personalInput(
  data: MoneylithSnapshotDomain,
  options: Options,
  asOf: string,
): Input {
  const input: Input = {
    scope: "personal",
    asOf,
    opening: null,
    reserve: options.reservedNow ?? null,
    events: [],
    debts: {},
    missing: [],
    assumptions: [],
    goals: [],
  };
  const income = rows(data.income),
    fixed = rows(data.fixedCosts),
    detected = rows(data.detectedFixedCosts).filter(
      (r) => r.isFixed && !r.isIgnored,
    ),
    debts = rows(data.debts);
  const receipts = (data.inputReviews ?? {}) as InputReviews;
  const manual = (rs: Record<string, unknown>[]) =>
    manualReviewRows(rs as unknown as Parameters<typeof manualReviewRows>[0]);
  const checks = {
    income: reviewSection("income", "Inkomen", manual(income), receipts),
    fixed: reviewSection(
      "fixed",
      "Vaste lasten",
      detected.length
        ? detected.map((r) => ({
            id: String(r.id),
            name: String(r.customLabel || r.descriptionPattern),
            amount: (r.customMonthlyAmount ??
              r.estimatedMonthlyAmount) as number,
            details: r,
          }))
        : manual(fixed),
      receipts,
    ),
    debts: reviewSection(
      "debts",
      "Schulden",
      debts.map((r) => ({
        id: String(r.id),
        name: name(r),
        amount: (r.saldo ?? r.openBedrag ?? NaN) as number,
        complete:
          Number.isFinite(r.minimaleMaandlast ?? r.minBetaling) &&
          Number(r.minimaleMaandlast ?? r.minBetaling ?? -1) >= 0,
        details: r,
      })),
      receipts,
    ),
  };
  for (const check of Object.values(checks))
    if (!check.ready) input.missing.push(check.label + " nog controleren");
  const accounts = rows(data.accounts).filter((r) => r.active === true);
  if (!accounts.length || accounts.some((r) => amount(r.startBalance) === null))
    input.missing.push("Actieve rekeningen met ingevulde saldi");
  else if (!options.confirmOpening)
    input.missing.push(
      "Bevestig dat de rekeningbedragen de huidige saldi zijn",
    );
  else {
    input.opening = accounts.reduce(
      (sum, r) => sum + amount(r.startBalance)!,
      0,
    );
    input.assumptions.push(
      "De rekeningbedragen zijn expliciet bevestigd als huidige saldi. Historische transacties worden niet opnieuw opgeteld.",
    );
  }
  for (const r of income)
    recurring(
      input,
      "income:" + r.id,
      name(r),
      r.amountEntered === false ? null : amount(r.bedrag),
      Number.isInteger(r.dagVanMaand) &&
        Number(r.dagVanMaand) >= 1 &&
        Number(r.dagVanMaand) <= 31
        ? Number(r.dagVanMaand)
        : options.monthlyDay,
      "income",
    );
  if (detected.length) {
    input.assumptions.push(
      "Gecontroleerde vaste-lastenpatronen vervangen handmatige vaste lasten; transacties worden niet nogmaals geboekt.",
    );
    for (const r of detected)
      recurring(
        input,
        "fixed:" + r.id,
        String(r.customLabel || r.descriptionPattern),
        amount(r.customMonthlyAmount ?? r.estimatedMonthlyAmount) === null
          ? null
          : -amount(r.customMonthlyAmount ?? r.estimatedMonthlyAmount)!,
        options.monthlyDay,
        "pattern",
      );
  } else
    for (const r of fixed)
      recurring(
        input,
        "fixed:" + r.id,
        name(r),
        r.amountEntered === false || amount(r.bedrag) === null
          ? null
          : -amount(r.bedrag)!,
        Number.isInteger(r.dagVanMaand) &&
          Number(r.dagVanMaand) > 0 &&
          Number(r.dagVanMaand) <= 31
          ? Number(r.dagVanMaand)
          : options.monthlyDay,
        "fixed",
      );
  for (const r of rows(data.futureIncome))
    input.events.push({
      id: "future:" + r.id,
      label: name(r),
      date: validDate(r.datum) ? r.datum : null,
      amount: amount(r.bedrag),
      basis: "input",
      source: "futureIncome",
    });
  for (const r of debts) {
    const principal = amount(r.saldo ?? r.openBedrag),
      payment = amount(r.minimaleMaandlast ?? r.minBetaling);
    if (principal !== null && principal >= 0)
      input.debts[String(r.id)] = principal;
    const day =
      Number.isInteger(r.afschrijfDag) &&
      Number(r.afschrijfDag) > 0 &&
      Number(r.afschrijfDag) <= 31
        ? Number(r.afschrijfDag)
        : options.monthlyDay;
    if (principal !== 0)
      recurring(
        input,
        "debt:" + r.id,
        name(r),
        payment === null ? null : -payment,
        day,
        "debt",
        { kind: "repayment", debtId: String(r.id) },
      );
  }
  recurring(
    input,
    "variable",
    "Variabele uitgaven",
    options.variableMonthly === null ? null : -options.variableMonthly,
    options.monthlyDay,
    "assumption",
  );
  if (options.variableMonthly !== null)
    input.assumptions.push(
      "Variabele uitgaven zijn een expliciet gekozen maandbudget; historische patronen zijn geen toekomstige boekingen.",
    );
  for (const r of rows(data.goals).filter((r) => r.isActive))
    input.goals.push({
      label: name(r),
      date: validDate(r.deadline) ? r.deadline : null,
      remaining:
        amount(r.targetAmount) === null || amount(r.currentAmount) === null
          ? null
          : Math.max(0, amount(r.targetAmount)! - amount(r.currentAmount)!),
      monthly: amount(r.monthlyContribution),
    });
  input.assumptions.push(
    "Maandinkomsten en lasten herhalen volgens de ingevoerde bedragen. Rente en tariefwijzigingen zonder invoer zijn niet berekend. Doelen zijn voornemens, geen extra automatische betalingen.",
  );
  if (options.monthlyDay !== null)
    input.assumptions.push(
      `Ontbrekende maandelijkse betaalmomenten zijn aangenomen op dag ${options.monthlyDay}; korte maanden gebruiken hun laatste dag.`,
    );
  return input;
}
export function businessInput(
  data: BusinessData,
  options: Options,
  asOf: string,
): Input {
  const now = calculateBusiness(data, asOf);
  const input: Input = {
    scope: "business-real",
    asOf,
    opening: now.checks.cash.ready ? now.cash : null,
    reserve: null,
    events: [],
    debts: {},
    missing: missingFor(data, "forecast"),
    assumptions: [],
    goals: [],
  };
  if (data.workspace !== "real")
    throw Error("Alleen de eigen zakelijke administratie is beschikbaar.");
  if (data.debts.some((d) => d.date > asOf))
    input.missing.push(
      "Toekomstige openingsdatum van een lening: controleer het aflosschema",
    );
  if (data.accounts.some((a) => a.date > asOf))
    input.missing.push(
      "Toekomstige openingsdatum van een rekening: huidig saldo onbekend",
    );
  if (data.month !== asOf.slice(0, 7))
    input.missing.push(
      "Selecteer de huidige maand voor een actuele vooruitblik",
    );
  if (data.plan.buffer !== null && now.taxReserve !== null)
    input.reserve = now.vatReserve + now.taxReserve + data.plan.buffer;
  const futureMovements = data.movements.filter((m) => m.date > asOf);
  for (const m of futureMovements) {
    if (m.kind === "transfer") continue;
    const doc = data.documents.find((d) => d.id === m.documentId);
    const positive =
      m.kind === "loan_in" ||
      m.kind === "owner_deposit" ||
      (m.kind === "document" && doc?.kind === "sale");
    input.events.push({
      id: "movement:" + m.id,
      label: m.label,
      date: m.date,
      amount: (positive ? 1 : -1) * m.amount,
      source: "payment",
      basis: "input",
      ...(m.kind === "loan_out"
        ? { kind: "repayment" as const, debtId: m.debtId }
        : {}),
    });
    if (m.kind === "loan_in")
      input.missing.push(
        "Toekomstige leningontvangst: aflosschema na opname nog niet bekend",
      );
  }
  for (const d of data.documents) {
    const paid = data.movements
      .filter((m) => m.kind === "document" && m.documentId === d.id)
      .reduce((s, m) => s + m.amount, 0);
    const unpaid = gross(d) - paid;
    if (unpaid <= 0) continue;
    input.events.push({
      id: "invoice:" + d.id,
      label: d.label,
      date: d.due > asOf ? d.due : null,
      amount: (d.kind === "sale" ? 1 : -1) * unpaid,
      source: "invoice",
      basis: "assumption",
    });
  }
  for (const d of now.debts) {
    input.debts[d.id] = d.balance;
    const dates = monthlyDates(asOf, options.monthlyDay);
    if (d.balance > 0) {
      if (!dates.length)
        recurring(
          input,
          "debt:" + d.id,
          d.label,
          d.monthly === null ? null : -d.monthly,
          null,
          "debt",
          { kind: "repayment", debtId: d.id },
        );
      for (const date of dates) {
        const explicit = futureMovements
          .filter(
            (m) =>
              m.kind === "loan_out" &&
              m.debtId === d.id &&
              m.date.slice(0, 7) === date.slice(0, 7),
          )
          .reduce((s, m) => s + m.amount, 0);
        input.events.push({
          id: "debt:" + d.id + ":" + date,
          label: d.label,
          date,
          amount:
            d.monthly === null ? null : -Math.max(0, d.monthly - explicit),
          source: "debt",
          basis: "assumption",
          kind: "repayment",
          debtId: d.id,
        });
      }
    }
  }
  const nextMonth = new Date(
    Date.UTC(Number(asOf.slice(0, 4)), Number(asOf.slice(5, 7)), 1),
  )
    .toISOString()
    .slice(0, 10);
  const p = data.plan;
  const revenue =
    p.revenue === null || p.salesVat === null
      ? null
      : p.revenue + vat(p.revenue, p.salesVat);
  const costs =
    p.costs === null || p.costsVat === null
      ? null
      : p.costs + vat(p.costs, p.costsVat);
  recurring(
    input,
    "plan-income",
    "Nieuw werk inclusief btw",
    revenue,
    options.monthlyDay,
    "plan",
    {},
    nextMonth,
  );
  recurring(
    input,
    "plan-costs",
    "Nieuwe bedrijfskosten inclusief btw",
    costs === null ? null : -costs,
    options.monthlyDay,
    "plan",
    {},
    nextMonth,
  );
  recurring(
    input,
    "draw",
    "Geplande privéonttrekking",
    p.draw === null ? null : -p.draw,
    options.monthlyDay,
    "plan",
    {},
    nextMonth,
  );
  const taxReady = revenue !== null && costs !== null && p.taxPercent !== null;
  const taxAccrual = taxReady
    ? Math.max(
        0,
        vat(p.revenue!, p.salesVat!) -
          (p.deductible ? vat(p.costs!, p.costsVat!) : 0),
      ) +
      Math.round(
        (Math.max(
          0,
          p.revenue! -
            p.costs! -
            (p.deductible ? 0 : vat(p.costs!, p.costsVat!)),
        ) *
          p.taxPercent!) /
          100,
      )
    : null;
  let taxHeld =
    now.taxReserve === null ? null : now.vatReserve + now.taxReserve;
  const taxActions: {
    date: string;
    kind: "explicit" | "auto" | "accrual";
    amount: number | null;
    id: string;
  }[] = [];
  const taxPayments = futureMovements.filter((m) =>
    ["vat_payment", "tax_payment"].includes(m.kind),
  );
  for (const m of taxPayments)
    taxActions.push({
      date: m.date,
      kind: "explicit",
      amount: m.amount,
      id: m.id,
    });
  for (const date of monthlyDates(asOf, options.monthlyDay)) {
    const pay =
      p.taxPaymentCadence === "monthly" ||
      (p.taxPaymentCadence === "quarterly" &&
        Number(date.slice(5, 7)) % 3 === 0);
    if (
      pay &&
      !taxPayments.some((m) => m.date.slice(0, 7) === date.slice(0, 7))
    )
      taxActions.push({ date, kind: "auto", amount: null, id: date });
    if (date >= nextMonth)
      taxActions.push({ date, kind: "accrual", amount: taxAccrual, id: date });
  }
  const rank = { explicit: 0, auto: 1, accrual: 2 };
  taxActions.sort(
    (a, b) => a.date.localeCompare(b.date) || rank[a.kind] - rank[b.kind],
  );
  for (const a of taxActions) {
    if (a.kind === "accrual") {
      input.events.push({
        id: "tax-accrual:" + a.id,
        label: "Nieuwe btw- en belastingreserve",
        date: a.date,
        amount: a.amount,
        source: "tax",
        basis: "assumption",
        kind: "reserve",
      });
      taxHeld =
        taxHeld === null || a.amount === null ? null : taxHeld + a.amount;
    } else {
      const payment = a.kind === "auto" ? taxHeld : a.amount;
      const release =
        payment === null || taxHeld === null
          ? null
          : Math.min(taxHeld, payment);
      if (a.kind === "auto")
        input.events.push({
          id: "tax:" + a.id,
          label: "Geschatte belastingbetaling",
          date: a.date,
          amount: payment === null ? null : -payment,
          source: "tax",
          basis: "assumption",
        });
      input.events.push({
        id: "tax-release:" + a.id,
        label: "Vrijval betaalde belastingreserve",
        date: a.date,
        amount: release === null ? null : -release,
        source: "tax",
        basis: a.kind === "explicit" ? "input" : "assumption",
        kind: "reserve",
      });
      taxHeld = taxHeld === null || release === null ? null : taxHeld - release;
    }
  }
  if (
    options.monthlyDay === null &&
    p.taxPaymentCadence !== "hold" &&
    taxHeld !== 0
  )
    input.missing.push("Betaaldag voor geschatte belastingen");
  if (data.documents.some((d) => d.date > asOf))
    input.missing.push(
      "Toekomstig gedateerde facturen: belastingeffect nog niet verwerkt in de actuele maand",
    );
  for (const g of data.goals.filter((g) => g.isActive !== false))
    input.goals.push({
      label: g.label,
      date: g.date,
      remaining:
        g.target === null || g.current === null
          ? null
          : Math.max(0, g.target - g.current),
      monthly: g.monthly,
    });
  input.assumptions.push(
    "Open facturen worden op hun vervaldatum betaald; achterstallige facturen hebben een onbekend betaalmoment. Geregistreerde toekomstige betalingen tellen één keer mee.",
    "Nieuw werk en nieuwe kosten starten vanaf de volgende kalendermaand, los van reeds ingevoerde facturen.",
    "Expliciete belastingbetalingen vervangen de geschatte betaling in dezelfde kalendermaand.",
    "Belastingreserve volgt het bestaande maandmodel en is geen aanslag. Betalingen volgen de gekozen frequentie; kwartaalbetaling is aan het eind van een kalenderkwartaal. Doelen zijn voornemens en worden niet nogmaals als betaling geboekt.",
  );
  if (p.taxPaymentCadence === "hold")
    input.assumptions.push(
      "Belastingreserve blijft op de bank staan: er zijn geen automatische belastingbetalingen aangenomen.",
    );
  if (options.monthlyDay !== null)
    input.assumptions.push(
      `Voor maandplan, aflossingen en geschatte belastingen is dag ${options.monthlyDay} aangenomen.`,
    );
  if (Object.values(data.scenario).some((n) => n !== 0)) {
    const base = forecastBusiness(data),
      changed = forecastBusiness(data, data.scenario);
    input.savedScenario = [];
    if (base && changed)
      for (let m = 1; m <= 12; m++) {
        const date =
          options.monthlyDay === null
            ? null
            : base[m].month +
              "-" +
              String(
                Math.min(
                  options.monthlyDay,
                  Number(monthEnd(base[m].month).slice(8)),
                ),
              ).padStart(2, "0");
        const cashDelta =
          changed[m].bank -
          base[m].bank -
          (changed[m - 1].bank - base[m - 1].bank);
        const reserveDelta =
          changed[m].reserves -
          base[m].reserves -
          (changed[m - 1].reserves - base[m - 1].reserves);
        input.savedScenario.push({
          id: "saved-cash:" + m,
          label: "Opgeslagen zakelijk scenario",
          date,
          amount: cashDelta,
          source: "saved",
          basis: "scenario",
        });
        input.savedScenario.push({
          id: "saved-reserve:" + m,
          label: "Reserve-effect opgeslagen scenario",
          date,
          amount: reserveDelta,
          source: "saved",
          basis: "scenario",
          kind: "reserve",
        });
      }
    else
      input.savedScenario.push({
        id: "saved-unknown",
        label: "Opgeslagen scenario: controleer eerst de administratie",
        date: null,
        amount: null,
        source: "saved",
        basis: "scenario",
      });
  }
  return input;
}
