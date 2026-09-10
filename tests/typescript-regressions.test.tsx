import test from "node:test";
import assert from "node:assert/strict";
import { numberInputValue } from "../src/utils/numberInput";
import { toDebtCardItems, fromDebtCardItems } from "../src/logic/debtRecords";
import { extractActionsFromContent } from "../src/logic/extractActions";

test("number inputs never receive null, undefined or non-finite values", () => {
  for (const value of [null, undefined, NaN, Infinity, -Infinity, 0]) {
    assert.equal(numberInputValue(value), "");
  }
  assert.equal(numberInputValue(12.5), 12.5);
  assert.equal(numberInputValue(-5), -5);
});

test("legacy debts remain editable without dropping notes and creditor information", () => {
  const old = { id: "legacy", naam: "Lening", openBedrag: 123, minBetaling: 12, crediteur: "Test", gebruikerOpmerking: "Bewaar dit" };
  const cards = toDebtCardItems([old]);
  assert.equal(cards[0].saldo, 123);
  assert.equal(cards[0].minimaleMaandlast, 12);
  cards[0].saldo = 100;
  cards[0].minimaleMaandlast = 10;
  const [saved] = fromDebtCardItems(cards);
  assert.equal(saved.openBedrag, 100);
  assert.equal(saved.saldo, 100);
  assert.equal(saved.minBetaling, 10);
  assert.equal(saved.crediteur, "Test");
  assert.equal(saved.gebruikerOpmerking, "Bewaar dit");
  assert.equal(old.openBedrag, 123);
});

test("an explicitly zero current debt balance wins over a stale legacy amount", () => {
  const [card] = toDebtCardItems([{ id: "paid", naam: "Afgelost", saldo: 0, openBedrag: 100 }]);
  assert.equal(card.saldo, 0);
  assert.equal(fromDebtCardItems([card])[0].openBedrag, 0);
});

test("typed AI bucket actions preserve the existing structured action contract", () => {
  const result = extractActionsFromContent('Uitleg <ACTIONS_JSON>{"buckets":[{"name":"Boodschappen","share":0.2,"type":"variable","confidence":0.8}]}</ACTIONS_JSON>');
  assert.equal(result.cleanedContent, "Uitleg");
  assert.equal(result.actions?.buckets?.[0].name, "Boodschappen");
  assert.equal(result.actions?.buckets?.[0].share, 0.2);
});
