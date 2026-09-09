import { confirmSection } from "./finance";
import {
  addMonth,
  emptyBusiness,
  sections,
  type BusinessData,
  type Movement,
} from "./model";

/** Fictional examples live here only. Never use these as defaults for real business data. */
export function createBusinessDemo(
  month = new Date().toISOString().slice(0, 7),
): BusinessData {
  let data = emptyBusiness("demo", month);
  const day = (n: number) => `${month}-${String(n).padStart(2, "0")}`;
  data.profile = {
    name: "Studio Rivier — fictieve ontwerpstudio",
    goal: "Een bedrijfsbuffer opbouwen en voorspelbaarder verdienen",
    pressure:
      "Klanten betalen later dan leveranciers. Er loopt een zakelijke lening.",
    direction:
      "Meer onderhoudscontracten, minder afhankelijk van losse projecten.",
  };
  data.accounts = [
    {
      id: "demo-pay",
      label: "Zakelijke betaalrekening (fictief)",
      type: "payment",
      opening: 900000,
      date: day(1),
    },
    {
      id: "demo-save",
      label: "Zakelijke spaarrekening (fictief)",
      type: "savings",
      opening: 300000,
      date: day(1),
    },
  ];
  data.debts = [
    {
      id: "demo-loan",
      label: "Startlening ontwerpstudio",
      type: "loan",
      opening: 750000,
      date: day(1),
      monthly: 25000,
    },
  ];
  data.documents = [
    {
      id: "sale-web",
      number: "DEMO-V001",
      label: "Website voor fictieve klant Bos & Blad",
      kind: "sale",
      date: day(3),
      due: day(17),
      net: 600000,
      vatRate: 21,
      deductible: true,
    },
    {
      id: "sale-brand",
      number: "DEMO-V002",
      label: "Huisstijl voor fictieve klant Maan",
      kind: "sale",
      date: day(8),
      due: `${addMonth(month, 1)}-05`,
      net: 240000,
      vatRate: 21,
      deductible: true,
    },
    {
      id: "cost-office",
      number: "DEMO-K001",
      label: "Werkplek — maandhuur",
      kind: "cost",
      date: day(1),
      due: day(5),
      net: 65000,
      vatRate: 21,
      deductible: true,
    },
    {
      id: "cost-software",
      number: "DEMO-K002",
      label: "Ontwerpsoftware — maandabonnement",
      kind: "cost",
      date: day(2),
      due: day(5),
      net: 4900,
      vatRate: 21,
      deductible: true,
    },
    {
      id: "cost-print",
      number: "DEMO-K003",
      label: "Drukwerk voor klantproject",
      kind: "cost",
      date: day(8),
      due: day(25),
      net: 35000,
      vatRate: 21,
      deductible: true,
    },
    {
      id: "cost-interest",
      number: "DEMO-K004",
      label: "Rente startlening (apart van aflossing)",
      kind: "cost",
      date: day(5),
      due: day(5),
      net: 9000,
      vatRate: 0,
      deductible: false,
    },
    {
      id: "asset-laptop",
      number: "DEMO-I001",
      label: "Laptop — investering, geen directe bedrijfskosten",
      kind: "asset",
      date: day(4),
      due: day(4),
      net: 120000,
      vatRate: 21,
      deductible: true,
    },
  ];
  const movement = (
    id: string,
    label: string,
    kind: Movement["kind"],
    amount: number,
    date: string,
    extra: Partial<Movement> = {},
  ): Movement => ({
    id,
    label,
    kind,
    amount,
    date,
    accountId: "demo-pay",
    documentId: "",
    debtId: "",
    toAccountId: "",
    ...extra,
  });
  data.movements = [
    movement(
      "pay-web",
      "Ontvangst websitefactuur",
      "document",
      726000,
      day(8),
      { documentId: "sale-web" },
    ),
    movement("pay-office", "Betaling werkplek", "document", 78650, day(5), {
      documentId: "cost-office",
    }),
    movement("pay-software", "Betaling software", "document", 5929, day(5), {
      documentId: "cost-software",
    }),
    movement("pay-interest", "Rentebetaling", "document", 9000, day(5), {
      documentId: "cost-interest",
    }),
    movement("pay-laptop", "Betaling laptop", "document", 145200, day(4), {
      documentId: "asset-laptop",
    }),
    movement(
      "loan-extra",
      "Extra zakelijke financiering — geen omzet",
      "loan_in",
      200000,
      day(4),
      { debtId: "demo-loan" },
    ),
    movement(
      "loan-payment",
      "Aflossing hoofdsom — geen kosten",
      "loan_out",
      25000,
      day(8),
      { debtId: "demo-loan" },
    ),
    movement(
      "private",
      "Privéonttrekking ondernemer — geen kosten",
      "owner_draw",
      180000,
      day(8),
    ),
    movement(
      "transfer",
      "Naar eigen spaarrekening",
      "transfer",
      100000,
      day(8),
      { toAccountId: "demo-save" },
    ),
  ];
  data.assets = [
    {
      id: "laptop",
      label: "Zakelijke laptop",
      value: 120000,
      note: "Handmatige boekwaarde, gekoppeld in de administratie aan DEMO-I001. Afschrijving nog niet verwerkt.",
    },
  ];
  data.goals = [
    {
      id: "goal-buffer",
      label: "Buffer voor drie rustige maanden",
      kind: "buffer",
      target: 600000,
      current: 300000,
      monthly: 50000,
      date: `${addMonth(month, 6)}-01`,
    },
    {
      id: "goal-revenue",
      label: "Voorspelbare maandomzet",
      kind: "revenue",
      target: 700000,
      current: 600000,
      monthly: 0,
      date: `${addMonth(month, 3)}-01`,
    },
  ];
  data.plan = {
    revenue: 650000,
    costs: 160000,
    salesVat: 21,
    costsVat: 21,
    deductible: true,
    draw: 220000,
    taxPercent: 30,
    buffer: 300000,
  };
  // These are explicitly reviewed fictional examples, not inferred real data.
  for (const section of sections) data = confirmSection(data, section, true);
  return data;
}
