import {
  validateBusinessIntent,
  type BusinessIntent,
} from "../logic/businessIntent.js";
export type Workspace = "demo" | "real";
export type Section =
  "income" | "costs" | "cash" | "debts" | "assets" | "plan" | "reserves";
export type Document = {
  id: string;
  number: string;
  label: string;
  kind: "sale" | "cost" | "asset";
  date: string;
  due: string;
  net: number;
  vatRate: number;
  deductible: boolean;
};
export type Account = {
  id: string;
  label: string;
  type: "payment" | "savings";
  opening: number;
  date: string;
};
export type Debt = {
  id: string;
  label: string;
  type: "loan" | "arrangement";
  opening: number;
  date: string;
  monthly: number | null;
};
export type Asset = { id: string; label: string; value: number; note: string };
export type Movement = {
  id: string;
  label: string;
  date: string;
  accountId: string;
  kind:
    | "document"
    | "loan_in"
    | "loan_out"
    | "owner_draw"
    | "owner_deposit"
    | "vat_payment"
    | "tax_payment"
    | "transfer";
  amount: number;
  documentId: string;
  debtId: string;
  toAccountId: string;
};
export type Goal = {
  id: string;
  label: string;
  kind: "revenue" | "buffer" | "investment" | "repay";
  target: number | null;
  current: number | null;
  monthly: number | null;
  date: string | null;
  isActive?: boolean;
  priority?: number;
};
export type Plan = {
  taxPaymentCadence?: "monthly" | "quarterly" | "hold" | null;
  revenue: number | null;
  costs: number | null;
  salesVat: number | null;
  costsVat: number | null;
  deductible: boolean;
  draw: number | null;
  taxPercent: number | null;
  buffer: number | null;
};
export type BusinessData = {
  version: 1;
  workspace: Workspace;
  month: string;
  intent?: BusinessIntent;
  profile: { name: string; goal: string; pressure: string; direction: string };
  documents: Document[];
  movements: Movement[];
  accounts: Account[];
  debts: Debt[];
  assets: Asset[];
  goals: Goal[];
  scenario: { revenueDelta: number; extraCost: number; oneOff: number };
  plan: Plan;
  reviews: Partial<Record<Section, string | null>>;
};
export const sections: Section[] = [
  "income",
  "costs",
  "cash",
  "debts",
  "assets",
  "plan",
  "reserves",
];
export const sectionLabels: Record<Section, string> = {
  income: "Omzetfacturen",
  costs: "Kosten en investeringsfacturen",
  cash: "Rekeningen en betalingen",
  debts: "Leningen en regelingen",
  assets: "Bedrijfsmiddelen",
  plan: "Maandplan en aflossingen",
  reserves: "Reserveringen",
};
export const workspaceKeys: Record<Workspace, string> = {
  demo: "moneylith.business.demo.v1",
  real: "moneylith.business.real.v1",
};
export function emptyBusiness(
  workspace: Workspace,
  month = new Date().toISOString().slice(0, 7),
): BusinessData {
  return {
    version: 1,
    workspace,
    month,
    profile: { name: "", goal: "", pressure: "", direction: "" },
    documents: [],
    movements: [],
    accounts: [],
    debts: [],
    assets: [],
    goals: [],
    scenario: { revenueDelta: 0, extraCost: 0, oneOff: 0 },
    plan: {
      revenue: null,
      costs: null,
      salesVat: null,
      costsVat: null,
      deductible: true,
      draw: null,
      taxPercent: null,
      buffer: null,
    },
    reviews: {},
  };
}
export function euros(value: string): number {
  if (!/^-?\d{1,9}([.,]\d{1,2})?$/.test(value.trim()))
    throw new Error(
      "Vul een bedrag in, bijvoorbeeld 1250,50. Gebruik geen duizendtalscheiding.",
    );
  const negative = value.trim().startsWith("-");
  const [whole, fraction = ""] = value
    .trim()
    .replace("-", "")
    .replace(",", ".")
    .split(".");
  return (
    (Number(whole) * 100 + Number(fraction.padEnd(2, "0"))) *
    (negative ? -1 : 1)
  );
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value + "T12:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function monthEnd(month: string) {
  return new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0, 12),
  )
    .toISOString()
    .slice(0, 10);
}
export function addMonth(month: string, offset: number) {
  const date = new Date(
    Date.UTC(
      Number(month.slice(0, 4)),
      Number(month.slice(5)) - 1 + offset,
      15,
    ),
  );
  return date.toISOString().slice(0, 7);
}
export const vat = (net: number, rate: number) =>
  Math.round((net * rate) / 100);
export const gross = (doc: Document) => doc.net + vat(doc.net, doc.vatRate);
export const cashSign = (movement: Movement, data: BusinessData) =>
  movement.kind === "document"
    ? data.documents.find((doc) => doc.id === movement.documentId)?.kind ===
      "sale"
      ? 1
      : -1
    : ["loan_in", "owner_deposit"].includes(movement.kind)
      ? 1
      : -1;

/** Validate the complete candidate before changing storage: linked records cannot drift apart. */
export function validateBusiness(
  value: unknown,
): asserts value is BusinessData {
  const data = value as BusinessData;
  function fail(message: string): never {
    throw new Error(message);
  }
  if (!data || data.version !== 1 || !["demo", "real"].includes(data.workspace))
    fail("Onbekend formaat voor zakelijke gegevens.");
  if (
    typeof data.month !== "string" ||
    !/^20\d{2}-(0[1-9]|1[0-2])$/.test(data.month)
  )
    fail("Kies een geldige maand (2000–2099).");
  if (
    !data.profile ||
    Object.values(data.profile).some((v) => typeof v !== "string") ||
    !["name", "goal", "pressure", "direction"].every(
      (key) =>
        typeof (data.profile as unknown as Record<string, unknown>)[key] ===
        "string",
    )
  )
    fail("Bedrijfsprofiel ontbreekt.");
  if (
    !data.reviews ||
    typeof data.reviews !== "object" ||
    Array.isArray(data.reviews) ||
    Object.entries(data.reviews).some(
      ([key, val]) =>
        !sections.includes(key as Section) ||
        (val !== null && typeof val !== "string"),
    )
  )
    fail("Ongeldige controlebevestigingen.");
  if (data.intent !== undefined) validateBusinessIntent(data.intent);
  const money = (n: unknown, name: string, signed = false) => {
    if (
      typeof n !== "number" ||
      !Number.isSafeInteger(n) ||
      Math.abs(n) > 100_000_000_000 ||
      (!signed && n < 0)
    )
      fail(
        `Ongeldig bedrag bij ${name}. Vul expliciet 0 in als het bedrag nul is.`,
      );
  };
  const date = (d: unknown) => {
    if (!validDate(d)) fail("Vul een geldige datum in.");
  };
  for (const key of [
    "documents",
    "movements",
    "accounts",
    "debts",
    "assets",
    "goals",
  ] as const) {
    const rows = data[key];
    if (!Array.isArray(rows) || rows.length > 5000)
      fail("Ongeldige of te grote gegevenslijst.");
    const ids = new Set<string>();
    for (const item of rows) {
      if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id))
        fail("Dubbel of ontbrekend recordnummer.");
      ids.add(item.id);
      if (typeof item.label !== "string" || !item.label.trim())
        fail("Geef elke regel een naam of omschrijving.");
    }
  }
  const references = new Set<string>();
  for (const doc of data.documents) {
    if (
      !["sale", "cost", "asset"].includes(doc.kind) ||
      typeof doc.number !== "string" ||
      !doc.number.trim()
    )
      fail("Factuursoort en uniek factuurkenmerk zijn verplicht.");
    const ref = `${doc.kind === "sale" ? "sale" : "purchase"}:${doc.number.trim().toLowerCase()}`;
    if (references.has(ref))
      fail(
        "Dit factuurkenmerk bestaat al bij omzet of inkoop. Voeg de betaling toe aan de bestaande factuur.",
      );
    references.add(ref);
    money(doc.net, doc.label);
    date(doc.date);
    date(doc.due);
    if (doc.due < doc.date)
      fail("De vervaldatum mag niet vóór de factuurdatum liggen.");
    if (
      ![0, 9, 21].includes(doc.vatRate) ||
      typeof doc.deductible !== "boolean"
    )
      fail("Kies 0%, 9% of 21% btw en geef aan of inkoop-btw aftrekbaar is.");
  }
  for (const account of data.accounts) {
    money(account.opening, account.label, true);
    date(account.date);
    if (!["payment", "savings"].includes(account.type))
      fail("Kies een betaal- of spaarrekening.");
  }
  for (const debt of data.debts) {
    money(debt.opening, debt.label);
    date(debt.date);
    if (debt.monthly !== null) money(debt.monthly, debt.label);
    if (!["loan", "arrangement"].includes(debt.type))
      fail("Kies lening of betalingsregeling.");
  }
  for (const asset of data.assets) {
    money(asset.value, asset.label);
    if (typeof asset.note !== "string")
      fail("Ongeldige notitie bij bedrijfsmiddel.");
  }
  for (const goal of data.goals) {
    if (goal.target !== null) money(goal.target, goal.label);
    if (goal.current !== null) money(goal.current, goal.label);
    if (goal.monthly !== null) money(goal.monthly, goal.label);
    if (goal.date !== null) date(goal.date);
    if (goal.isActive !== undefined && typeof goal.isActive !== "boolean")
      fail("Ongeldige doelstatus.");
    if (goal.priority !== undefined && !Number.isSafeInteger(goal.priority))
      fail("Ongeldige doelprioriteit.");
    if (!["revenue", "buffer", "investment", "repay"].includes(goal.kind))
      fail("Kies een geldig doeltype.");
  }
  const paid = new Map<string, number>();
  const debtBalances = new Map(
    data.debts.map((debt) => [debt.id, debt.opening]),
  );
  for (const movement of [...data.movements].sort(
    (a, b) =>
      String(a.date).localeCompare(String(b.date)) ||
      Number(b.kind === "loan_in") - Number(a.kind === "loan_in") ||
      a.id.localeCompare(b.id),
  )) {
    money(movement.amount, movement.label);
    date(movement.date);
    if (
      ![
        "document",
        "loan_in",
        "loan_out",
        "owner_draw",
        "owner_deposit",
        "vat_payment",
        "tax_payment",
        "transfer",
      ].includes(movement.kind)
    )
      fail("Kies een geldige betaalsoort.");
    const account = data.accounts.find((a) => a.id === movement.accountId);
    if (!account || movement.date < account.date)
      fail("Kies een rekening met een beginsaldo op of vóór de betaaldatum.");
    if (movement.kind === "document") {
      const doc = data.documents.find((d) => d.id === movement.documentId);
      if (!doc || movement.date < doc.date)
        fail(
          "Koppel de betaling aan een bestaande factuur; de betaaldatum mag niet vóór de factuurdatum liggen.",
        );
      const amount = (paid.get(doc.id) ?? 0) + movement.amount;
      if (amount > gross(doc))
        fail(
          "Betalingen overschrijden het factuurbedrag inclusief btw. Controleer op dubbele invoer.",
        );
      paid.set(doc.id, amount);
    }
    if (["loan_in", "loan_out"].includes(movement.kind)) {
      const debt = data.debts.find((d) => d.id === movement.debtId);
      if (!debt || movement.date < debt.date)
        fail(
          "Koppel de betaling aan een bestaande lening of regeling met een geldige begindatum.",
        );
      const next =
        (debtBalances.get(debt.id) ?? 0) +
        (movement.kind === "loan_in" ? movement.amount : -movement.amount);
      if (next < 0) fail("De aflossing is hoger dan de resterende hoofdsom.");
      debtBalances.set(debt.id, next);
    }
    if (movement.kind === "transfer") {
      const other = data.accounts.find((a) => a.id === movement.toAccountId);
      if (
        !other ||
        other.id === movement.accountId ||
        movement.date < other.date
      )
        fail("Kies een andere eigen rekening met een geldige begindatum.");
    }
  }
  if (!data.scenario) fail("Scenario ontbreekt.");
  money(data.scenario.revenueDelta, "extra/minder omzet", true);
  money(data.scenario.extraCost, "extra kosten");
  money(data.scenario.oneOff, "eenmalige tegenvaller");
  if (!data.plan) fail("Maandplan ontbreekt.");
  if (
    data.plan.taxPaymentCadence != null &&
    !["monthly", "quarterly", "hold"].includes(data.plan.taxPaymentCadence)
  )
    fail("Kies een geldige belastingbetaalfrequentie.");
  for (const key of ["revenue", "costs", "draw", "buffer"] as const)
    if (data.plan[key] !== null) money(data.plan[key], key);
  for (const key of ["salesVat", "costsVat"] as const)
    if (data.plan[key] !== null && ![0, 9, 21].includes(data.plan[key]!))
      fail("Kies een geldig btw-percentage voor het maandplan.");
  if (typeof data.plan.deductible !== "boolean")
    fail("Controleer de btw-aanname in het maandplan.");
  if (
    data.plan.taxPercent !== null &&
    (typeof data.plan.taxPercent !== "number" ||
      !Number.isFinite(data.plan.taxPercent) ||
      data.plan.taxPercent < 0 ||
      data.plan.taxPercent > 100)
  )
    fail("De geschatte belastingreserve moet tussen 0 en 100% liggen.");
}
