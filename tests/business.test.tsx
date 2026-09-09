import test from "node:test";
import assert from "node:assert/strict";
import { createBusinessDemo } from "../src/business/demo";
import {
  businessAiContext,
  calculateBusiness,
  changeBusiness,
  confirmSection,
  forecastBusiness,
  missingFor,
  reviewSections,
} from "../src/business/finance";
import {
  addMonth,
  emptyBusiness,
  euros,
  gross,
  monthEnd,
  sections,
  validateBusiness,
  vat,
  workspaceKeys,
  type BusinessData,
} from "../src/business/model";
import {
  loadBusiness,
  resetBusinessDemo,
  restoreBusiness,
  saveBusiness,
} from "../src/business/storage";

const demo = () => createBusinessDemo("2026-09");
function confirmAll(data: BusinessData) {
  for (const section of sections) data = confirmSection(data, section, true);
  return data;
}
function zero() {
  const data = emptyBusiness("real", "2026-09");
  data.plan = {
    revenue: 0,
    costs: 0,
    salesVat: 0,
    costsVat: 0,
    deductible: false,
    draw: 0,
    taxPercent: 0,
    buffer: 0,
  };
  return confirmAll(data);
}
class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test("empty business and AI inputs remain unknown, never an automatic zero conclusion", () => {
  const data = emptyBusiness("real", "2026-09");
  assert.equal(reviewSections(data).income.ready, false);
  assert.equal(forecastBusiness(data), null);
  assert.ok(missingFor(data, "profit").length > 0);
  const context = businessAiContext(data);
  for (const key of [
    "income",
    "costs",
    "profit",
    "cash",
    "available",
    "forecast",
  ] as const)
    assert.equal(context[key], null);
  assert.equal(context.fictitious, false);
  assert.throws(() => confirmSection(data, "plan", true), /ontbrekende/);
});
test("partial input supports only calculations with their own confirmed dependencies", () => {
  let data = emptyBusiness("real", "2026-09");
  data.documents = [demo().documents[1]];
  data = confirmSection(data, "income", true);
  assert.equal(businessAiContext(data).income, 240000);
  assert.equal(businessAiContext(data).profit, null);
  data = confirmSection(data, "costs", true); // explicitly no costs
  assert.equal(businessAiContext(data).profit, 240000);
  assert.equal(businessAiContext(data).cash, null);
  assert.equal(forecastBusiness(data), null);
});
test("explicitly confirmed empty lists and entered zeros form a valid zero forecast", () => {
  const data = zero();
  assert.deepEqual(missingFor(data, "forecast"), []);
  const forecast = forecastBusiness(data)!;
  assert.equal(forecast.length, 13);
  assert.ok(
    forecast.every(
      (row) => row.bank === 0 && row.available === 0 && row.loanBalance === 0,
    ),
  );
  assert.equal(businessAiContext(data).income, 0);
});
test("demo ledger separates revenue, profit, VAT, assets and available cash to the cent", () => {
  const data = demo();
  validateBusiness(data);
  const result = calculateBusiness(data);
  assert.equal(result.income, 840000);
  assert.equal(result.costs, 113900);
  assert.equal(result.profit, 726100);
  assert.equal(result.outputVat, 176400);
  assert.equal(result.inputVat, 47229);
  assert.equal(result.vatReserve, 129171);
  assert.equal(result.taxReserve, 217830);
  assert.equal(result.cash, 1682221);
  assert.equal(result.receivables, 290400);
  assert.equal(result.payables, 42350);
  assert.equal(result.available, 992870);
  assert.equal(result.debts[0].balance, 925000);
  assert.equal(result.assetValue, 120000);
  assert.equal(businessAiContext(data).fictitious, true);
});
test("loan receipts, principal repayments and owner draws do not change invoice profit", () => {
  const data = demo();
  const before = calculateBusiness(data);
  const without = changeBusiness(data, (next) => {
    next.movements = next.movements.filter(
      (m) => !["loan_in", "loan_out", "owner_draw"].includes(m.kind),
    );
  });
  const after = calculateBusiness(without);
  assert.equal(after.profit, before.profit);
  assert.equal(after.income, before.income);
  assert.equal(after.cash, before.cash + 5000);
  assert.equal(after.debts[0].balance, 750000);
});
test("payment of an invoice changes cash and its open amount, never revenue twice", () => {
  const data = demo();
  const changed = changeBusiness(data, (next) => {
    next.movements.push({
      ...next.movements[0],
      id: "part-brand",
      documentId: "sale-brand",
      amount: 100000,
    });
  });
  const result = calculateBusiness(changed);
  assert.equal(result.income, 840000);
  assert.equal(result.receivables, 190400);
  assert.equal(result.cash, 1782221);
  assert.equal(result.checks.income.ready, true);
  assert.equal(result.checks.cash.ready, false);
  assert.throws(
    () =>
      changeBusiness(changed, (next) => {
        next.movements.push({ ...next.movements[0], id: "duplicate-web" });
      }),
    /overschrijden/,
  );
  assert.equal(changed.movements.length, 10);
});
test("duplicate invoice references and orphan/invalid ledger links are rejected atomically", () => {
  const data = demo();
  const before = JSON.stringify(data);
  assert.throws(
    () =>
      changeBusiness(data, (next) => {
        next.documents.push({ ...next.documents[0], id: "duplicate" });
      }),
    /factuurkenmerk/,
  );
  assert.throws(
    () =>
      changeBusiness(data, (next) => {
        next.documents = next.documents.filter((d) => d.id !== "sale-web");
      }),
    /bestaande factuur/,
  );
  assert.throws(
    () =>
      changeBusiness(data, (next) => {
        next.accounts = [];
      }),
    /rekening/,
  );
  assert.throws(
    () =>
      changeBusiness(data, (next) => {
        next.movements[0].date = "2026-08-01";
      }),
    /rekening/,
  );
  assert.equal(JSON.stringify(data), before);
});
test("a purchase invoice cannot be entered again as an investment", () => {
  assert.throws(
    () =>
      changeBusiness(demo(), (next) => {
        next.documents.push({
          ...next.documents.find((d) => d.id === "cost-office")!,
          id: "double-purchase",
          kind: "asset",
        });
      }),
    /factuurkenmerk/,
  );
});
test("same-day loan receipts are available for repayment and excess repayment is rejected", () => {
  const data = zero();
  data.accounts = [
    {
      id: "bank",
      label: "Bank",
      type: "payment",
      opening: 0,
      date: "2026-09-01",
    },
  ];
  data.debts = [
    {
      id: "loan",
      label: "Lening",
      type: "loan",
      opening: 0,
      monthly: 0,
      date: "2026-09-01",
    },
  ];
  const common = {
    label: "Financiering",
    date: "2026-09-01",
    accountId: "bank",
    documentId: "",
    debtId: "loan",
    toAccountId: "",
  };
  data.movements = [
    { ...common, id: "a-out", kind: "loan_out", amount: 5000 },
    { ...common, id: "z-in", kind: "loan_in", amount: 10000 },
  ];
  assert.equal(calculateBusiness(data).debts[0].balance, 5000);
  assert.throws(
    () =>
      changeBusiness(data, (next) => {
        next.movements[0].amount = 10001;
      }),
    /aflossing/,
  );
});
test("internal transfer moves both balances once with zero net cashflow", () => {
  const data = demo();
  const before = calculateBusiness(data);
  const without = calculateBusiness(
    changeBusiness(data, (next) => {
      next.movements = next.movements.filter((m) => m.kind !== "transfer");
    }),
  );
  assert.equal(before.cash, without.cash);
  assert.equal(before.cashflow, without.cashflow);
  assert.equal(
    before.accounts[0].balance!,
    without.accounts[0].balance! - 100000,
  );
  assert.equal(
    before.accounts[1].balance!,
    without.accounts[1].balance! + 100000,
  );
});
test("editing reviewed sources invalidates exact receipts; unrelated profile/assets do not block liquidity", () => {
  const data = demo();
  const changed = changeBusiness(data, (next) => {
    next.documents[1].net += 1;
  });
  assert.equal(changed.reviews.income, null);
  assert.equal(changed.reviews.cash, null);
  assert.equal(reviewSections(changed).costs.ready, true);
  assert.equal(forecastBusiness(changed), null);
  const assetChange = changeBusiness(data, (next) => {
    next.assets[0].value += 100;
    next.profile.goal = "Een ander doel";
  });
  assert.equal(assetChange.reviews.assets, null);
  assert.ok(forecastBusiness(assetChange));
  const restoredValue = changeBusiness(changed, (next) => {
    next.documents[1].net -= 1;
  });
  assert.equal(reviewSections(restoredValue).income.ready, false);
});
test("old unpaid invoice changes invalidate cash readiness even outside selected income month", () => {
  let data = demo();
  data = changeBusiness(data, (next) => {
    next.documents[1].date = "2026-08-08";
  });
  data = confirmAll(data);
  data = changeBusiness(data, (next) => {
    next.documents[1].due = "2026-11-05";
  });
  assert.equal(reviewSections(data).cash.ready, false);
  assert.equal(reviewSections(data).income.ready, true);
});
test("missing planned amount invalidates forecasting while actual profit stays usable", () => {
  const data = changeBusiness(demo(), (next) => {
    next.plan.revenue = null;
  });
  assert.equal(reviewSections(data).plan.valid, false);
  assert.equal(forecastBusiness(data), null);
  assert.equal(businessAiContext(data).profit, 726100);
  const missingDebtPlan = changeBusiness(demo(), (next) => {
    next.debts[0].monthly = null;
  });
  assert.equal(forecastBusiness(missingDebtPlan), null);
  assert.throws(
    () => confirmSection(missingDebtPlan, "plan", true),
    /ontbrekende/,
  );
});
test("non-deductible purchase VAT increases costs; asset purchase is not immediately expensed", () => {
  const result = calculateBusiness(
    changeBusiness(demo(), (next) => {
      next.documents.find((d) => d.id === "cost-print")!.deductible = false;
    }),
  );
  assert.equal(result.costs, 113900 + 7350);
  assert.equal(result.inputVat, 47229 - 7350);
  const inventory = calculateBusiness(
    changeBusiness(demo(), (next) => {
      next.assets[0].value = 0;
    }),
  );
  assert.equal(inventory.profit, 726100);
  assert.equal(inventory.cash, 1682221);
});
test("negative available cash is preserved rather than clamped to zero", () => {
  const data = confirmAll(
    changeBusiness(demo(), (next) => {
      next.plan.buffer = 3000000;
    }),
  );
  assert.ok(calculateBusiness(data).available! < 0);
  assert.ok(forecastBusiness(data)![0].available < 0);
});
test("forecast starts at actual balance, has twelve transitions, settles backlog once and stops loan repayments", () => {
  const data = zero();
  data.accounts = [
    {
      id: "bank",
      label: "Bank",
      type: "payment",
      opening: 100000,
      date: "2026-09-01",
    },
  ];
  data.debts = [
    {
      id: "loan",
      label: "Lening",
      type: "loan",
      opening: 25000,
      monthly: 10000,
      date: "2026-09-01",
    },
  ];
  data.documents = [
    { ...demo().documents[1], net: 10000, vatRate: 0, due: "2026-11-01" },
  ];
  const forecast = forecastBusiness(confirmAll(data))!;
  assert.equal(forecast[0].bank, 100000);
  assert.equal(forecast[1].bank, 90000);
  assert.equal(forecast[2].bank, 90000); // another repayment, single invoice receipt
  assert.equal(forecast[3].bank, 85000); // final partial repayment
  assert.equal(forecast[4].bank, 85000);
  assert.equal(forecast[12].bank, 85000);
  assert.equal(forecast[12].loanBalance, 0);
  assert.equal(forecast[12].month, "2027-09");
});
test("scenario is persisted as explicit deltas, does not mutate actual month, and reaches AI context", () => {
  const data = changeBusiness(demo(), (next) => {
    next.scenario = { revenueDelta: -100000, extraCost: 20000, oneOff: 50000 };
  });
  const base = forecastBusiness(data)!;
  const scenario = forecastBusiness(data, data.scenario)!;
  assert.deepEqual(base[0], scenario[0]);
  assert.equal(scenario[1].bank, base[1].bank - 195200);
  assert.deepEqual(businessAiContext(data).forecast, scenario);
  const storage = new MemoryStorage();
  saveBusiness(storage, "demo", data);
  assert.deepEqual(loadBusiness(storage, "demo").scenario, data.scenario);
  assert.throws(
    () =>
      changeBusiness(data, (next) => {
        next.scenario.extraCost = -1;
      }),
    /Ongeldig bedrag/,
  );
});
test("demo edits, reload and reset never touch personal, legacy or real business data", () => {
  const storage = new MemoryStorage();
  storage.setItem("moneylith.personal.income", "personal-sentinel");
  storage.setItem("moneylith.business.income", "legacy-sentinel");
  const real = emptyBusiness("real", "2026-09");
  real.profile.name = "Echte onderneming";
  saveBusiness(storage, "real", real);
  const realRaw = storage.getItem(workspaceKeys.real);
  let data = loadBusiness(storage, "demo");
  data = changeBusiness(data, (next) => {
    next.profile.name = "Bewerkte demo";
  });
  saveBusiness(storage, "demo", data);
  assert.equal(loadBusiness(storage, "demo").profile.name, "Bewerkte demo");
  assert.equal(loadBusiness(storage, "real").profile.name, "Echte onderneming");
  assert.notEqual(resetBusinessDemo(storage).profile.name, "Bewerkte demo");
  assert.equal(
    storage.getItem("moneylith.personal.income"),
    "personal-sentinel",
  );
  assert.equal(storage.getItem("moneylith.business.income"), "legacy-sentinel");
  assert.equal(storage.getItem(workspaceKeys.real), realRaw);
});
test("real business starts empty; corrupt storage and foreign backups never get overwritten", () => {
  const storage = new MemoryStorage();
  const real = loadBusiness(storage, "real");
  assert.equal(real.documents.length, 0);
  assert.equal(real.plan.revenue, null);
  const before = storage.getItem(workspaceKeys.real);
  assert.throws(
    () => restoreBusiness(storage, "real", JSON.stringify(demo())),
    /demo-backup/,
  );
  assert.throws(
    () => saveBusiness(storage, "real", demo()),
    /andere administratie/,
  );
  assert.equal(storage.getItem(workspaceKeys.real), before);
  storage.setItem(workspaceKeys.demo, "broken-original");
  assert.throws(() => loadBusiness(storage, "demo"));
  assert.equal(storage.getItem(workspaceKeys.demo), "broken-original");
});
test("backup restore validates references and clears all reviews before calculation", () => {
  const storage = new MemoryStorage();
  const data = demo();
  const restored = restoreBusiness(storage, "demo", JSON.stringify(data));
  assert.deepEqual(restored.reviews, {});
  assert.equal(forecastBusiness(restored), null);
  const before = storage.getItem(workspaceKeys.demo);
  data.movements[0].amount = gross(data.documents[0]) + 1;
  assert.throws(
    () => restoreBusiness(storage, "demo", JSON.stringify(data)),
    /overschrijden/,
  );
  assert.equal(storage.getItem(workspaceKeys.demo), before);
});
test("money parsing, VAT rounding and calendar boundaries avoid silent normalization", () => {
  assert.equal(euros("1250,50"), 125050);
  assert.equal(euros("-0.01"), -1);
  assert.equal(euros("0"), 0);
  for (const raw of ["", "1.250,50", "12.345", "NaN", "Infinity"])
    assert.throws(() => euros(raw));
  assert.equal(vat(4900, 21), 1029);
  assert.equal(vat(1, 21), 0);
  assert.equal(monthEnd("2028-02"), "2028-02-29");
  assert.equal(addMonth("2026-12", 1), "2027-01");
  assert.throws(
    () =>
      changeBusiness(demo(), (next) => {
        next.documents[0].date = "2026-02-30";
      }),
    /geldige datum/,
  );
});
