import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { applyPatternDecision, classifyBankTransactions, detectCadence, indexBankPatterns, patternKey, type PatternDecisions } from "../src/bank/patterns";
import { prefillFinancialImport } from "../src/bank/financialImport";
import { BankPatterns } from "../src/components/BankPatterns";
import { persistLunchflow } from "../src/bank/lunchflowMerge";
import type { MoneylithTransaction } from "../src/types";
const tx = (id: string, date: string, amount: number, party = "Energy provider", accountId = "checking"): MoneylithTransaction => ({ id, date, amount, counterparty: party, description: "Bank payment", accountId, provider: "lunchflow", currency: "EUR" });
const input = () => [tx("a", "2026-08-03", -101), tx("b", "2026-09-02", -160), tx("c", "2026-10-02", -120)];
const asOf = "2026-10-21";
test("indexes variable monthly bills without relying on debit keywords, including irregular repetitions and credits", () => {
  const rows = [...input(), tx("d", "2026-09-01", 100, "Employer"), tx("e", "2026-10-01", 150, "Employer"), tx("f", "2026-09-04", -15, "Shop"), tx("g", "2026-10-20", -33, "Shop")];
  const before = JSON.stringify(rows), groups = indexBankPatterns(rows, asOf);
  const energy = groups.find(g => g.label === "Energy provider")!;
  assert.equal(energy.frequency, "monthly"); assert.equal(energy.varying, true); assert.equal(energy.total, 381); assert.equal(energy.monthlyEstimate, 127);
  assert.equal(groups.find(g => g.label === "Shop")?.frequency, "irregular");
  assert.equal(groups.find(g => g.incoming)?.transactions.length, 2);
  assert.equal(JSON.stringify(rows), before);
});
test("recognizes weekly, fortnightly, fourweekly, quarterly and annual rhythms; never invents a rhythm from one payment", () => {
  assert.equal(detectCadence(["2026-10-01", "2026-10-08", "2026-10-15"])?.frequency, "weekly");
  assert.equal(detectCadence(["2026-09-01", "2026-09-15", "2026-09-29"])?.frequency, "fortnightly");
  assert.equal(detectCadence(["2026-07-01", "2026-07-29", "2026-08-26", "2026-09-23"])?.frequency, "fourweekly");
  assert.equal(detectCadence(["2026-01-01", "2026-04-01", "2026-07-01"])?.frequency, "quarterly");
  assert.equal(detectCadence(["2025-01-01", "2026-01-01"])?.frequency, "yearly");
  assert.equal(detectCadence(["2026-10-01"]), null);
  assert.equal(indexBankPatterns([tx("a", "2026-10-01", -7), tx("b", "2026-10-08", -7), tx("c", "2026-10-15", -7)], asOf)[0].monthlyEstimate, 30.33);
});
test("does not collapse unrelated SEPA descriptions or payment processor merchants; keeps accounts and directions separate", () => {
  const base = tx("a", "2026-10-01", -10, "SEPA");
  assert.notEqual(patternKey({ ...base, description: "Alpha" }), patternKey({ ...base, description: "Beta" }));
  assert.notEqual(patternKey({ ...base, counterparty: "PayPal Europe", description: "Merchant A" }), patternKey({ ...base, counterparty: "PayPal Europe", description: "Merchant B" }));
  assert.notEqual(patternKey(base), patternKey({ ...base, accountId: "savings" }));
  assert.notEqual(patternKey(base), patternKey({ ...base, amount: 10 }));
  assert.equal(indexBankPatterns([...input(), ...input()], asOf)[0].transactions.length, 3);
});
test("marks possible own transfers without deleting evidence or treating ambiguous matches as proven transfers", () => {
  const groups = indexBankPatterns([tx("in", "2026-10-01", 100, "Transfer", "savings"), tx("out", "2026-10-02", -100, "Transfer")], asOf);
  assert.equal(groups.length, 2); assert.ok(groups.every(g => g.possibleTransfer));
  assert.ok(groups.every(g => g.transactions.length === 1));
});
test("unknown currency, invalid amounts/dates, future data and non-bank imports do not become monetary evidence", () => {
  const base = input()[0];
  const rows = [{ ...base, currency: undefined }, { ...base, id: "b", amount: NaN }, { ...base, id: "c", date: "2026-02-31" }, { ...base, id: "d", provider: undefined }, { ...base, id: "e", date: "2027-01-01" }];
  assert.deepEqual(indexBankPatterns(rows, asOf), []);
  assert.equal(indexBankPatterns([tx("old", "2025-01-01", -10)], asOf, 365).length, 0);
  assert.equal(indexBankPatterns([tx("old", "2025-01-01", -10)], asOf, 730)[0].active, false);
});
test("confirmation adds a canonical fixed cost only explicitly and preserves manual records when linked", () => {
  const pattern = indexBankPatterns(input(), asOf)[0];
  const manual = [{ id: "manual", naam: "My bill", bedrag: 0, amountEntered: true, dagVanMaand: 17, opmerking: "Keep" }];
  const linked = applyPatternDecision(pattern, { kind: "fixed", label: "Energy", targetId: "manual" }, 999, 1, [], manual, {});
  assert.equal(linked.fixedCosts.length, 1); assert.equal(linked.fixedCosts[0].bedrag, 0); assert.equal(linked.fixedCosts[0].opmerking, "Keep"); assert.equal(linked.fixedCosts[0].dagVanMaand, 17);
  const added = applyPatternDecision(pattern, { kind: "fixed", label: "Energy", targetId: "new" }, 127, 0, [], manual, {});
  assert.equal(added.fixedCosts.length, 2); assert.equal(added.fixedCosts[1].bedrag, 127); assert.equal(added.fixedCosts[1].dagVanMaand, 0);
  assert.throws(() => applyPatternDecision(pattern, { kind: "fixed", label: "Energy", targetId: "new" }, 127, 1, [], added.fixedCosts, added.decisions));
  assert.throws(() => applyPatternDecision(pattern, { kind: "fixed", label: "Energy", targetId: "new" }, null, 1, [], [], {}));
  assert.throws(() => applyPatternDecision(pattern, { kind: "income", label: "Wrong" }, 100, 1, [], [], {}));
  assert.equal(manual[0].bedrag, 0);
});
test("saved classifications apply to new syncs while preserving user categories, descriptions and notes", () => {
  const pattern = indexBankPatterns(input(), asOf)[0];
  const decisions: PatternDecisions = { [pattern.key]: { kind: "variable", label: "Energy expenses" } };
  const future = tx("future", "2026-11-02", -120);
  const first = classifyBankTransactions([...input(), future], decisions);
  assert.ok(first.every(t => t.category === "Energy expenses"));
  const edited = first.map(t => ({ ...t, category: "My category", notes: "Keep", description: "Edited", providerData: { description: "Bank payment", counterparty: "Energy provider", amount: t.amount, date: t.date } }));
  assert.ok(classifyBankTransactions(edited, decisions).every(t => t.category === "My category" && t.notes === "Keep" && t.description === "Edited"));
  const collision = classifyBankTransactions(edited, { [pattern.key]: { kind: "variable", label: "My category" } });
  assert.ok(classifyBankTransactions(collision, { [pattern.key]: { kind: "variable", label: "Changed again" } }).every(t => t.category === "My category"));
  assert.deepEqual(classifyBankTransactions(first, decisions), first);
  assert.equal(prefillFinancialImport(first, [], [], [], "2026-11-15").addedFixed, 0);
});
test("decision and financial updates roll back together on storage failure and never write business data", () => {
  const state = new Map<string, string>([["moneylith.business.real.v1", "keep"]]); let count = 0;
  assert.throws(() => persistLunchflow({ getItem: k => state.get(k) ?? null, setItem: (k,v) => { if (++count === 6) throw Error("quota"); state.set(k,v); }, removeItem: k => { state.delete(k); } }, { accounts: [], transactions: input(), reports: [] }, { income: [], fixedCosts: [], seen: [], decisions: {} }));
  assert.deepEqual([...state], [["moneylith.business.real.v1", "keep"]]);
});
test("connected patterns render direct bank insights and questions without an upload requirement", () => {
  const html = renderToStaticMarkup(<BankPatterns asOf={asOf} accounts={[]} transactions={input()} income={[]} fixedCosts={[]} decisions={{}} onDecide={() => {}} onBank={() => {}} />);
  assert.match(html, /Transacties en herkenning/);
  assert.match(html, /Wat is dit/);
  assert.ok(!html.includes('type="file"'));
  assert.ok(!html.includes("Analyseer met AI"));
});
