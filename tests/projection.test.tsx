import test from "node:test";
import assert from "node:assert/strict";
import {
  project,
  compare,
  monthlyDates,
  emptyOptions,
  validateOptions,
  type Input,
  type Scenario,
} from "../src/projection/engine";
import { personalInput, businessInput } from "../src/projection/adapters";
import {
  emptyBusiness,
  sections,
  type BusinessData,
} from "../src/business/model";
import { confirmSection, calculateBusiness } from "../src/business/finance";
import { manualReviewRows, reviewSection } from "../src/logic/inputReadiness";
import { buildChatRequest } from "../src/ai/context";
const base = (): Input => ({
  scope: "personal",
  asOf: "2026-10-01",
  opening: 100000,
  reserve: 10000,
  events: [],
  debts: {},
  missing: [],
  assumptions: [],
  goals: [],
});
const opts = {
  monthlyDay: 25,
  variableMonthly: 0,
  confirmOpening: true,
  reservedNow: 0,
};
const reviewed = (data: BusinessData) =>
  sections.reduce((d, k) => confirmSection(d, k, true), data);
function business() {
  const d = emptyBusiness("real", "2026-10");
  d.plan = {
    revenue: 0,
    costs: 0,
    salesVat: 0,
    costsVat: 0,
    deductible: true,
    draw: 0,
    taxPercent: 0,
    buffer: 0,
    taxPaymentCadence: "monthly",
  };
  d.accounts = [
    {
      id: "a",
      label: "TEST",
      type: "payment",
      opening: 100000,
      date: "2026-10-01",
    },
  ];
  return d;
}
test("7/30/90 days use dated cashflows, keep negative balances, and do not pay on day zero", () => {
  const i = base();
  i.events = [
    {
      id: "1",
      label: "Income",
      date: "2026-10-03",
      amount: 50000,
      source: "income",
      basis: "input",
    },
    {
      id: "2",
      label: "Cost",
      date: "2026-10-12",
      amount: -180000,
      source: "fixed",
      basis: "input",
    },
    {
      id: "3",
      label: "Later",
      date: "2026-11-10",
      amount: 40000,
      source: "income",
      basis: "input",
    },
    {
      id: "past",
      label: "Already in balance",
      date: i.asOf,
      amount: 999999,
      source: "income",
      basis: "input",
    },
  ];
  const p = project(i);
  assert.deepEqual(
    p.horizons.slice(0, 3).map((p) => p.cash),
    [150000, -30000, 10000],
  );
  assert.equal(p.lowest?.available, -40000);
  assert.equal(p.tightestWeek?.from, "2026-10-09");
  assert.ok(p.pressureWeeks.length);
});
test("calendar recurrence handles short months, leap day and year transitions", () => {
  assert.deepEqual(monthlyDates("2028-01-31", 31).slice(0, 3), [
    "2028-02-29",
    "2028-03-31",
    "2028-04-30",
  ]);
  assert.equal(monthlyDates("2026-12-31", 1)[0], "2027-01-01");
});
test("missing amount, date or opening remains unknown; explicit zero is valid", () => {
  for (const event of [
    { amount: null, date: "2026-10-05" },
    { amount: -100, date: null },
  ]) {
    const i = base();
    i.events = [
      { id: "u", label: "unknown", source: "fixed", basis: "input", ...event },
    ];
    assert.equal(project(i).horizons[0].cash, null);
    assert.equal(project(i).tightestWeek, null);
  }
  assert.equal(project({ ...base(), opening: null }).horizons[0].cash, null);
  assert.equal(
    project({ ...base(), opening: 0, reserve: 0 }).horizons[0].cash,
    0,
  );
});
test("purchase, monthly income/expense and reserve scenarios are overlays, reset restores exact baseline", () => {
  const i = base(),
    before = JSON.stringify(i);
  const scenarios: [Scenario, number, number][] = [
    [{ kind: "purchase", amount: 25000, date: "2026-10-02" }, -25000, -25000],
    [{ kind: "income", amount: 20000, date: "2026-10-02" }, 20000, 20000],
    [{ kind: "expense", amount: -10000, date: "2026-10-02" }, 10000, 10000],
    [{ kind: "reserve", amount: 25000, date: "2026-10-02" }, 0, -25000],
  ];
  for (const [s, cash, available] of scenarios) {
    const r = compare(i, s);
    assert.equal(r.differences[0].cash, cash);
    assert.equal(r.differences[0].available, available);
  }
  assert.equal(compare(i, scenarios[1][0]).differences[2].cash, 60000);
  assert.equal(JSON.stringify(i), before);
  assert.deepEqual(compare(i, null).baseline, compare(i, null).scenario);
});
test("extra repayment reduces later installments without inventing interest or paying more than principal", () => {
  const i = base();
  i.debts = { loan: 35000 };
  i.events = ["2026-10-10", "2026-11-10", "2026-12-10"].map((date, j) => ({
    id: String(j),
    label: "Loan",
    date,
    amount: -20000,
    source: "debt",
    basis: "input",
    kind: "repayment",
    debtId: "loan",
  }));
  const p = compare(i, {
    kind: "repayment",
    amount: 30000,
    date: "2026-10-02",
    target: "loan",
  });
  assert.equal(p.differences[0].cash, -30000);
  assert.equal(p.differences[2].cash, 0);
  assert.equal(p.scenario.horizons[2].cash, 65000);
  assert.throws(() =>
    compare(i, {
      kind: "repayment",
      amount: 35001,
      date: "2026-10-02",
      target: "loan",
    }),
  );
});
test("invoice move changes timing only and can resolve an unknown overdue date", () => {
  const i = base();
  i.events = [
    {
      id: "invoice:a",
      label: "Invoice",
      date: "2026-10-15",
      amount: -25000,
      source: "invoice",
      basis: "assumption",
    },
  ];
  const r = compare(i, {
    kind: "move",
    amount: 0,
    date: "2026-11-15",
    target: "invoice:a",
  });
  assert.equal(r.differences[1].cash, 25000);
  assert.equal(r.differences[2].cash, 0);
  assert.equal(i.events[0].date, "2026-10-15");
  i.events[0].date = null;
  const moved = compare(i, {
    kind: "move",
    amount: 0,
    date: "2026-10-03",
    target: "invoice:a",
  });
  assert.equal(moved.baseline.horizons[0].cash, null);
  assert.equal(moved.scenario.horizons[0].cash, 75000);
  assert.equal(moved.differences[0].cash, null);
});
test("business as-of balances exclude future receipts; a linked future receipt is not counted twice as an invoice", () => {
  const d = business();
  d.documents = [
    {
      id: "f",
      number: "TEST",
      label: "Test invoice",
      kind: "sale",
      date: "2026-10-01",
      due: "2026-10-06",
      net: 10000,
      vatRate: 21,
      deductible: true,
    },
  ];
  d.movements = [
    {
      id: "p",
      label: "Receipt",
      date: "2026-10-05",
      amount: 12100,
      kind: "document",
      accountId: "a",
      documentId: "f",
      debtId: "",
      toAccountId: "",
    },
  ];
  const data = reviewed(d);
  assert.equal(calculateBusiness(data, "2026-10-01").cash, 100000);
  const input = businessInput(data, opts, "2026-10-01");
  assert.equal(input.events.filter((e) => e.source === "invoice").length, 0);
  assert.equal(project(input).horizons[0].cash, 112100);
});
test("business planned loan installments subtract explicit scheduled payments and respect outstanding principal", () => {
  const d = business();
  d.debts = [
    {
      id: "l",
      label: "Loan",
      date: "2026-10-01",
      opening: 30000,
      monthly: 10000,
      type: "loan",
    },
  ];
  d.movements = [
    {
      id: "p",
      label: "Scheduled repayment",
      date: "2026-10-05",
      amount: 10000,
      kind: "loan_out",
      accountId: "a",
      documentId: "",
      debtId: "l",
      toAccountId: "",
    },
  ];
  const p = project(businessInput(reviewed(d), opts, "2026-10-01"));
  assert.equal(p.horizons[1].cash, 90000);
  assert.equal(p.horizons[2].cash, 70000);
});
test("tax payment releases reserves without changing available funds twice; current buffer stays reserved", () => {
  const d = business();
  d.plan.buffer = 5000;
  d.documents = [
    {
      id: "f",
      number: "F",
      label: "Paid invoice",
      kind: "sale",
      date: "2026-10-01",
      due: "2026-10-01",
      net: 10000,
      vatRate: 21,
      deductible: true,
    },
  ];
  d.movements = [
    {
      id: "p",
      label: "Receipt",
      date: "2026-10-01",
      amount: 12100,
      kind: "document",
      accountId: "a",
      documentId: "f",
      debtId: "",
      toAccountId: "",
    },
  ];
  const p = project(businessInput(reviewed(d), opts, "2026-10-01"));
  assert.equal(p.horizons[0].available, 105000);
  assert.equal(p.horizons[1].cash, 110000);
  assert.equal(p.horizons[1].available, 105000);
});
test("personal sources use reviewed selected costs, future income and active accounts, never assets as bank money", () => {
  const income = [
      { id: "i", naam: "Salary", bedrag: 1000, amountEntered: true },
    ],
    fixed = [
      {
        id: "f",
        naam: "Rent",
        bedrag: 500,
        dagVanMaand: 5,
        amountEntered: true,
      },
    ];
  const data = {
    income,
    fixedCosts: fixed,
    debts: [],
    accounts: [
      { id: "a", name: "TEST", active: true, startBalance: 1000 },
      { id: "closed", active: false, startBalance: 99999 },
    ],
    assets: [{ bedrag: 999999 }],
    futureIncome: [
      { id: "gift", naam: "Gift", bedrag: 200, datum: "2026-10-07" },
    ],
    inputReviews: {
      income: reviewSection("income", "Inkomen", manualReviewRows(income), {})
        .signature,
      fixed: reviewSection("fixed", "Vaste lasten", manualReviewRows(fixed), {})
        .signature,
      debts: reviewSection("debts", "Schulden", [], {}).signature,
    },
  };
  const p = project(personalInput(data, opts, "2026-10-01"));
  assert.equal(p.complete, true);
  assert.equal(p.opening, 100000);
  assert.equal(p.horizons[0].cash, 70000);
  assert.equal(p.horizons[1].cash, 170000);
  assert.equal(
    project(personalInput(data, emptyOptions(), "2026-10-01")).horizons[0].cash,
    null,
  );
  data.income[0].bedrag = 2000;
  assert.equal(
    project(personalInput(data, opts, "2026-10-01")).complete,
    false,
  );
});
test("server computes projections from scoped source data, ignores forged totals and rejects foreign scenarios", () => {
  const d = reviewed(business());
  const r = buildChatRequest({
    scope: "business-real",
    context: d,
    projection: { horizons: [{ cash: 999999 }] },
    projectionOptions: opts,
    history: [],
    question: "Waar sta ik over 30 dagen?",
  });
  assert.match(r.messages.at(-1)!.content, /"projection"/);
  assert.ok(!r.messages.at(-1)!.content.includes("999999"));
  assert.match(r.messages[0].content, /serverberekende projection/);
  assert.throws(() =>
    buildChatRequest({
      scope: "business-real",
      context: d,
      projectionOptions: opts,
      projectionScenario: {
        kind: "repayment",
        amount: 10,
        date: "2099-01-01",
        target: "personal-loan",
      },
      history: [],
      question: "Wat als?",
    }),
  );
  assert.throws(() =>
    validateOptions({
      monthlyDay: 32,
      variableMonthly: 0,
      confirmOpening: true,
    }),
  );
  assert.throws(() =>
    businessInput({ ...d, workspace: "demo" }, opts, "2026-10-01"),
  );
});

test("multiple income dates, expired goals and goal deadlines remain distinct from actual payments", () => {
  const incomes = [
    {
      id: "a",
      naam: "First",
      bedrag: 100,
      amountEntered: true,
      dagVanMaand: 3,
    },
    {
      id: "b",
      naam: "Second",
      bedrag: 200,
      amountEntered: true,
      dagVanMaand: 20,
    },
  ];
  const data = {
    income: incomes,
    fixedCosts: [],
    debts: [],
    accounts: [{ id: "a", active: true, startBalance: 0 }],
    goals: [
      {
        id: "goal",
        isActive: true,
        label: "Buffer",
        targetAmount: 300,
        currentAmount: 0,
        monthlyContribution: 100,
        deadline: "2026-12-30",
      },
    ],
    inputReviews: {
      income: reviewSection("income", "Inkomen", manualReviewRows(incomes), {})
        .signature,
      fixed: reviewSection("fixed", "Vaste lasten", [], {}).signature,
      debts: reviewSection("debts", "Schulden", [], {}).signature,
    },
  };
  const p = project(personalInput(data, opts, "2026-10-01"));
  assert.equal(p.horizons[0].cash, 10000);
  assert.equal(p.horizons[1].cash, 30000);
  assert.equal(p.goals[0].requiredMonthly, 10000);
  assert.equal(p.horizons[1].available, 30000);
});
test("stored business scenario can be applied and removed without modifying existing stored amounts", () => {
  const d = reviewed({
    ...business(),
    scenario: { revenueDelta: 20000, extraCost: 0, oneOff: 30000 },
  });
  const original = JSON.stringify(d);
  const input = businessInput(d, opts, "2026-10-01");
  const r = compare(input, { kind: "saved", amount: 0, date: "2026-10-02" });
  assert.equal(r.differences[2].cash, 10000);
  assert.equal(JSON.stringify(d), original);
  assert.equal(compare(input, null).differences[2].cash, 0);
});
test("calendar quarterly tax schedule, explicit payments and reserve release are not doubled", () => {
  const d = business();
  d.plan = {
    ...d.plan,
    revenue: 10000,
    salesVat: 21,
    taxPaymentCadence: "quarterly",
  };
  const p = project(businessInput(reviewed(d), opts, "2026-10-01"));
  assert.ok(
    p.events.some((e) => e.id === "tax:2026-12-25" && e.amount === -2100),
  );
  assert.ok(!p.events.some((e) => e.id === "tax:2027-01-25"));
});
test("bounded question scenarios are calculated, never chosen from another context or applied to storage", async () => {
  const { questionScenario, projectionSummary } =
    await import("../src/projection/questions");
  const i = base();
  i.debts = { loan: 50000 };
  const before = JSON.stringify(i);
  const q = questionScenario(
    "Wat gebeurt er als ik €300 extra aflos?",
    i,
    opts,
  );
  assert.equal(q.scenario?.amount, 30000);
  assert.equal(compare(i, q.scenario).differences[0].cash, -30000);
  const income = questionScenario(
    "Wat verandert er als mijn inkomsten €200 stijgen?",
    i,
    opts,
  );
  assert.equal(income.scenario?.kind, "income");
  assert.equal(compare(i, income.scenario).differences[2].cash, 60000);
  const reserve = questionScenario(
    "Kan ik deze maand €250 reserveren?",
    i,
    opts,
  );
  assert.equal(compare(i, reserve.scenario).differences[0].available, -25000);
  assert.match(
    projectionSummary(compare(i, reserve.scenario), reserve.note),
    /250,00/,
  );
  assert.equal(
    questionScenario("Als ik niet €300 extra aflos?", i, opts).scenario,
    null,
  );
  assert.equal(
    questionScenario("€1.000 extra aflossen", i, opts).scenario,
    null,
  );
  assert.equal(
    questionScenario(
      "€300 extra aflossen",
      { ...i, debts: { a: 100000, b: 100000 } },
      opts,
    ).scenario,
    null,
  );
  assert.equal(JSON.stringify(i), before);
});
test("an unknown later amount does not erase earlier known horizons", () => {
  const i = base();
  i.events = [
    {
      id: "u",
      label: "Later unknown payment",
      date: "2026-11-15",
      amount: null,
      basis: "input",
      source: "fixed",
    },
  ];
  const p = project(i);
  assert.equal(p.horizons[0].cash, 100000);
  assert.equal(p.horizons[1].cash, 100000);
  assert.equal(p.horizons[2].cash, null);
});

test("unknown reservations preserve known cash but never imply zero reserved", () => {
  const input = { ...base(), reserve: null };
  const unknown = project(input);
  assert.equal(unknown.horizons[1].cash, 100000);
  assert.equal(unknown.horizons[1].available, null);
  const confirmedZero = project({ ...input, reserve: 0 });
  assert.equal(confirmedZero.horizons[1].available, 100000);
  assert.equal(input.reserve, null);
  assert.equal(validateOptions({ ...opts, reservedNow: 0 }).reservedNow, 0);
});
