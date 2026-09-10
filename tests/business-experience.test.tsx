import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createBusinessDemo } from "./fixtures/business";
import {
  changeBusiness,
  confirmSection,
  forecastBusiness,
} from "../src/business/finance";
import {
  analyzePatterns,
  goalProgress,
  stepProgress,
} from "../src/business/insights";
import { emptyBusiness, sections } from "../src/business/model";
import { GoalSummary, PatternsPanel } from "../src/business/InsightPanels";
import { NavigationStep } from "../src/components/NavigationStep";
const demo = () => createBusinessDemo("2026-09");
function checked(data: ReturnType<typeof demo>) {
  for (const key of sections) data = confirmSection(data, key, true);
  return data;
}

test("patterns require checked sources and leave unobserved months unknown", () => {
  assert.equal(analyzePatterns(emptyBusiness("real")), null);
  const result = analyzePatterns(demo())!;
  assert.equal(result.trend.filter((m) => m.observed).length, 3);
  assert.equal(result.trend[0].observed, false);
  assert.equal(result.largestShare, 71);
  const changed = changeBusiness(demo(), (next) => {
    next.documents[1].net += 1;
  });
  assert.equal(analyzePatterns(changed), null);
});
test("recurrence groups multiple invoices across months, not payments of one invoice", () => {
  const result = analyzePatterns(demo())!;
  const office = result.recurring.find((g) => g.label.includes("maandhuur"))!;
  assert.equal(office.months, 3);
  assert.equal(office.average, 65000);
  let data = demo();
  data.documents = data.documents.filter((d) => d.id === "sale-brand");
  data.movements = [0, 1].map((i) => ({
    id: `part-${i}`,
    label: "Deelbetaling",
    date: `2026-0${8 + i}-10`,
    kind: "document" as const,
    amount: 10000,
    accountId: data.accounts[0].id,
    documentId: "sale-brand",
    debtId: "",
    toAccountId: "",
  }));
  data.documents[0].date = "2026-08-01";
  data = checked(data);
  assert.equal(analyzePatterns(data)!.recurring.length, 0);
});
test("revenue goals use checked actual month revenue rather than a manual savings balance", () => {
  const data = demo(),
    goal = data.goals.find((g) => g.kind === "revenue")!;
  assert.equal(goal.current, 600000);
  assert.equal(goalProgress(data, goal).current, 840000);
  assert.equal(goalProgress(data, goal).remaining, 0);
  const changed = changeBusiness(data, (next) => {
    next.documents[0].net += 100;
  });
  assert.equal(goalProgress(changed, goal).current, null);
  const html = renderToStaticMarkup(<GoalSummary data={data} goal={goal} />);
  assert.ok(!html.includes("Voorgenomen inleg"));
  assert.ok(html.includes("Maandomzetdoel"));
});
test("repayment goals describe paid principal instead of a savings contribution", () => {
  const goal = {
    ...demo().goals[0],
    kind: "repay" as const,
    current: 10000,
    target: 50000,
  };
  assert.equal(goalProgress(demo(), goal).remaining, 40000);
  const html = renderToStaticMarkup(<GoalSummary data={demo()} goal={goal} />);
  assert.ok(html.includes("Al") || html.includes("afgelost"));
  assert.ok(html.includes("Geplande aflossing"));
});
test("tax payments reduce both bank and reserve once, preserving available cash", () => {
  const monthly = demo();
  const hold = checked(
    changeBusiness(monthly, (next) => {
      next.plan.taxPaymentCadence = "hold";
    }),
  );
  const a = forecastBusiness(monthly)!,
    b = forecastBusiness(hold)!;
  assert.equal(a[0].bank, b[0].bank);
  assert.equal(a[1].taxPaid, a[0].reserves);
  const paid = a.reduce((sum, row) => sum + row.taxPaid, 0);
  assert.equal(a[12].bank, b[12].bank - paid);
  assert.equal(a[12].reserves, b[12].reserves - paid);
  assert.equal(a[12].available, b[12].available);
  assert.ok(a[12].bank < b[12].bank);
});
test("three-month planning cadence pays only on its configured intervals", () => {
  const data = checked(
    changeBusiness(demo(), (next) => {
      next.plan.taxPaymentCadence = "quarterly";
    }),
  );
  const rows = forecastBusiness(data)!;
  assert.equal(rows[1].taxPaid, 0);
  assert.equal(rows[2].taxPaid, 0);
  assert.ok(rows[3].taxPaid > 0);
  assert.equal(rows[4].taxPaid, 0);
  assert.ok(rows[6].taxPaid > 0);
});
test("old saved workspaces remain readable but never silently receive a tax payment assumption", () => {
  const data = demo();
  delete data.plan.taxPaymentCadence;
  assert.equal(forecastBusiness(data), null);
  assert.equal(data.documents[0].net, 600000);
  const changed = changeBusiness(demo(), (next) => {
    next.plan.taxPaymentCadence = "hold";
  });
  assert.equal(changed.reviews.reserves, null);
});
test("navigation shares current-step semantics and progress reflects invalidated reviews", () => {
  assert.equal(stepProgress(demo(), "patterns"), "Gecontroleerd");
  assert.equal(
    stepProgress(emptyBusiness("real"), "foundation"),
    "Nog te doen",
  );
  const changed = changeBusiness(demo(), (next) => {
    next.movements[0].label = "Gewijzigd";
  });
  assert.equal(stepProgress(changed, "patterns"), "Te controleren");
  const html = renderToStaticMarkup(
    <NavigationStep
      label="Fundament"
      status="Actief"
      description="Invoer"
      active
    />,
  );
  assert.ok(html.includes('aria-current="step"'));
  assert.ok(html.includes("Actief"));
  const empty = renderToStaticMarkup(
    <PatternsPanel data={emptyBusiness("real")} />,
  );
  assert.ok(empty.includes("Nog onvoldoende"));
});
