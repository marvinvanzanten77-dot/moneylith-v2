import test from "node:test";
import assert from "node:assert/strict";
import { analyzeFinancialImport, prefillFinancialImport } from "../src/bank/financialImport";
import { persistLunchflow } from "../src/bank/lunchflowMerge";
import { manualReviewRows, reviewSection } from "../src/logic/inputReadiness";
import type { MoneylithTransaction } from "../src/types";

const tx = (id: string, date: string, amount: number, description = "Salaris", counterparty = "Werkgever"): MoneylithTransaction =>
  ({ id, date, amount, description, counterparty, accountId: "checking", provider: "lunchflow", currency: "EUR" });
const fixture = () => [
  ...["07", "08", "09"].map(m => tx(`salary-${m}`, `2026-${m}-25`, 2500)),
  ...["08", "09", "10"].map(m => tx(`rent-${m}`, `2026-${m}-01`, -850, "Huur", "Verhuurder")),
  tx("shop", "2026-10-05", -42.17, "Boodschappen", "Winkel"),
];
const asOf = "2026-10-20";
test("bank import fills existing income/fixed models with evidence and leaves review required", () => {
  const input = fixture(), before = JSON.stringify(input);
  const result = prefillFinancialImport(input, [], [], [], asOf);
  assert.equal(result.income[0].bedrag, 2500);
  assert.equal(result.income[0].dagVanMaand, 25);
  assert.equal(result.fixedCosts[0].bedrag, 850);
  assert.equal(result.otherOutflows30Days, 42.17);
  assert.equal(result.otherOutflowCount, 1);
  assert.equal(result.income[0].bankEvidence?.transactionIds.length, 3);
  assert.equal(reviewSection("income", "Inkomen", manualReviewRows(result.income), {}).ready, false);
  assert.equal(JSON.stringify(input), before);
});
test("repeated sync preserves manual edits and deleted suggestions", () => {
  const first = prefillFinancialImport(fixture(), [], [], [], asOf);
  const edited = [{ ...first.income[0], bedrag: 0, amountEntered: true, naam: "Eigen salaris", opmerking: "Bewaren" }];
  const next = prefillFinancialImport(fixture(), edited, [], first.seen, asOf);
  assert.deepEqual(next.income, edited);
  assert.deepEqual(next.fixedCosts, []);
  assert.equal(next.addedIncome, 0);
});
test("existing manual input and reviewed detected costs prevent duplicate automatic filling", () => {
  const manual = [{ id: "manual", naam: "Mijn loon", bedrag: 0, amountEntered: true }];
  const next = prefillFinancialImport(fixture(), manual, [], [], asOf, true);
  assert.deepEqual(next.income, manual);
  assert.equal(next.fixedCosts.length, 0);
  assert.equal(next.blocked.length, 2);
});
test("internal transfers, refunds, irregular and stale payments are not monthly income", () => {
  const transfers = ["07", "08", "09"].flatMap(m => [
    tx(`in-${m}`, `2026-${m}-25`, 100, "Salaris", "Eigen rekening"),
    { ...tx(`out-${m}`, `2026-${m}-26`, -100), accountId: "savings" },
  ]);
  assert.equal(analyzeFinancialImport(transfers, asOf).candidates.length, 0);
  assert.equal(analyzeFinancialImport(transfers, asOf).excludedTransfers, 6);
  assert.equal(analyzeFinancialImport(fixture().map(t => ({ ...t, description: "Refund salaris" })), asOf).candidates.length, 0);
  assert.equal(analyzeFinancialImport(fixture().map(t => ({ ...t, date: t.date.replace("2026", "2025") })), asOf).candidates.length, 0);
  assert.equal(analyzeFinancialImport([tx("a", "2026-09-01", 100), tx("b", "2026-09-02", 100), tx("c", "2026-10-03", 100)], asOf).candidates.length, 0);
});
test("unknowns, CSV, future data, generic parties and variable amounts are not inferred", () => {
  for (const modify of [
    (t: MoneylithTransaction) => ({ ...t, currency: undefined }),
    (t: MoneylithTransaction) => ({ ...t, provider: undefined }),
    (t: MoneylithTransaction) => ({ ...t, amount: NaN }),
    (t: MoneylithTransaction) => ({ ...t, date: "2027-01-01" }),
    (t: MoneylithTransaction) => ({ ...t, counterparty: "SEPA" }),
  ]) assert.equal(analyzeFinancialImport(fixture().map(modify), asOf).candidates.length, 0);
  const varying = fixture().filter(t => t.description === "Huur").map((t, i) => ({ ...t, amount: i === 0 ? -100 : -850 }));
  assert.equal(analyzeFinancialImport(varying, asOf).candidates.length, 0);
});
test("varying monthly salary is an observation using the latest amount, never an automatically confirmed forecast", () => {
  const varying = fixture().filter(t => t.amount > 0).map((t, i) => ({ ...t, amount: i === 0 ? 1000 : 2500 }));
  const result = prefillFinancialImport(varying, [], [], [], asOf);
  assert.equal(result.income.length, 1);
  assert.equal(result.income[0].bedrag, 2500);
  assert.equal(reviewSection("income", "Inkomen", manualReviewRows(result.income), {}).ready, false);
});
test("financial import persists only personal stores and rolls all writes back on failure", () => {
  const state = new Map([["moneylith.business.income", "untouched"], ["moneylith.personal.income", "old"]]);
  const storage = {
    getItem: (k: string) => state.get(k) ?? null,
    setItem: (k: string, v: string) => { state.set(k, v); },
    removeItem: (k: string) => { state.delete(k); },
  };
  const financial = prefillFinancialImport(fixture(), [], [], [], asOf);
  persistLunchflow(storage, { accounts: [], transactions: fixture(), reports: [] }, financial);
  assert.equal(state.get("moneylith.business.income"), "untouched");
  const before = new Map(state);
  let count = 0;
  assert.throws(() => persistLunchflow({
    ...storage,
    setItem: (k, v) => { if (++count === 4) throw Error("quota"); storage.setItem(k, v); },
  }, { accounts: [], transactions: [], reports: [] }, { ...financial, income: [] }));
  assert.deepEqual(state, before);
});
