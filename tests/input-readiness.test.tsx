import test from "node:test";
import React from "react";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { reviewSection, manualReviewRows, missingInputs, foundationStatus, type ReviewRow } from "../src/logic/inputReadiness";
import { StepVooruitblik } from "../src/components/steps/StepActie";
import { InputReview } from "../src/components/InputReview";
import { IncomeList } from "../src/components/IncomeList";
import { FixedCostsList } from "../src/components/FixedCostsList";

const row = (amount: number): ReviewRow => ({ id: "synthetic", name: "Test", amount });
const checked = (key: "income" | "fixed", rows: ReviewRow[]) => {
  const section = reviewSection(key, key, rows, {});
  return reviewSection(key, key, rows, { [key]: section.signature });
};
const snapshot = {
  totalIncome: { value: 0, source: "manual" as const }, fixedCostsTotal: { value: 0, source: "manual" as const },
  netFree: 0, totalDebt: 0, assetsTotal: 0, monthlyPressure: 0, runwayMonths: null,
};

test("empty defaults are unknown, never financial evidence", () => {
  const income = reviewSection("income", "Inkomen", [], {});
  const fixed = reviewSection("fixed", "Vaste lasten", [], {});
  assert.deepEqual(missingInputs([income, fixed]), ["Inkomen", "Vaste lasten"]);
  assert.equal(foundationStatus(income, fixed, []), "Nog onvoldoende gegevens");
});

test("explicitly confirmed absence is valid zero, not an unsustainable pace", () => {
  const income = checked("income", []), fixed = checked("fixed", []);
  assert.equal(income.ready, true);
  assert.equal(income.total, 0);
  assert.equal(foundationStatus(income, fixed, []), "Inkomen en vaste lasten zijn in evenwicht");
});

test("positive income alone is insufficient", () => {
  assert.equal(foundationStatus(checked("income", [row(2500)]), reviewSection("fixed", "Lasten", [], {}), []), "Nog onvoldoende gegevens");
});

test("confirmed actual deficit and goal pressure retain their conclusions", () => {
  assert.match(foundationStatus(checked("income", [row(0)]), checked("fixed", [row(500)]), []), /hoger/);
  assert.equal(foundationStatus(checked("income", [row(2000)]), checked("fixed", [row(1000)]), [1100]), "Onhoudbaar tempo");
  assert.equal(foundationStatus(checked("income", [row(2000)]), checked("fixed", [row(1000)]), [100]), "Stabiel tempo");
});

test("editing, deleting and replacing equally priced rows invalidates review", () => {
  const original = checked("income", [row(100)]);
  for (const rows of [[row(200)], [], [{ ...row(100), id: "replacement" }]]) {
    assert.equal(reviewSection("income", "Inkomen", rows, { income: original.signature }).ready, false);
  }
});

test("review survives reload of unchanged data and cannot cross categories", () => {
  const original = checked("income", [row(0)]);
  const receipts = JSON.parse(JSON.stringify({ income: original.signature, fixed: original.signature }));
  assert.equal(reviewSection("income", "Inkomen", [row(0)], receipts).ready, true);
  assert.equal(reviewSection("fixed", "Lasten", [row(0)], receipts).ready, false);
});

test("invalid, negative, blank or unfinished input cannot be confirmed", () => {
  for (const bad of [row(NaN), row(Infinity), row(-1), { ...row(0), name: " " }, { ...row(0), complete: false }]) {
    assert.equal(checked("income", [bad]).ready, false);
  }
});

test("debt payment changes invalidate the forecast even with unchanged principal", () => {
  const first = reviewSection("debts", "Schulden", [{ ...row(1000), details: { payment: 100 } }], {});
  const changed = reviewSection("debts", "Schulden", [{ ...row(1000), details: { payment: 50 } }], { debts: first.signature });
  assert.equal(changed.ready, false);
});

test("projection renders unknown separately from confirmed zero", async () => {
  const { emptyOptions } = await import("../src/projection/engine");
  const props = {options:emptyOptions(), onOptions:()=>{}, scenario:null, onScenario:()=>{}};
  const input = {scope:"personal" as const,asOf:"2026-10-01",opening:null,reserve:0,events:[],debts:{},missing:["Rekeningsaldo"],assumptions:[],goals:[]};
  const html = renderToStaticMarkup(<StepVooruitblik {...props} input={input} />);
  assert.match(html,/Nog niet ingevuld/);
  assert.match(html,/Nog onvoldoende gegevens om de krapste week/);
  assert.doesNotMatch(html,/Onhoudbaar|Onbenutte vrije ruimte/);
  const zero = renderToStaticMarkup(<StepVooruitblik {...props} input={{...input,opening:0,missing:[]}} />);
  assert.match(zero,/Laagste ruimte in de week/);
  assert.match(zero,/€\s*0/);
});

test("unknown versus confirmed zero is visible in review UI", () => {
  const unknown = reviewSection("income", "Inkomen", [], {});
  assert.match(renderToStaticMarkup(<InputReview section={unknown} onReview={() => {}} />), /Nog niet ingevuld/);
  const confirmed = { ...checked("income", []), label: "Inkomen" };
  const html = renderToStaticMarkup(<InputReview section={confirmed} onReview={() => {}} />);
  assert.doesNotMatch(html, /Nog niet ingevuld/);
  assert.match(html, /checked/);
});

test("empty source lists do not present default zero as a known total", () => {
  for (const Component of [IncomeList, FixedCostsList]) {
    assert.match(renderToStaticMarkup(<Component items={[]} />), /Nog niet ingevuld/);
    assert.doesNotMatch(renderToStaticMarkup(<Component items={[]} confirmed />), /Nog niet ingevuld/);
  }
});


test("manual drafts, cleared values and legacy default zeros remain unknown", () => {
  const legacy = { id: "a", naam: "Test", bedrag: 0 };
  assert.equal(checked("income", manualReviewRows([legacy])).ready, false);
  assert.equal(checked("income", manualReviewRows([{ ...legacy, amountEntered: false }])).ready, false);
  assert.equal(checked("income", manualReviewRows([{ ...legacy, amountEntered: true }])).ready, true);
  assert.equal(checked("income", manualReviewRows([{ ...legacy, bedrag: 1200 }])).ready, true);
});
