import type { MoneylithAccount, MoneylithTransaction } from "../types";
import type { PatternKind } from "./patterns";

export type BankRule = {
  id: string; label: string; kind: PatternKind; terms: string[];
  direction?: "out" | "in"; belowCents?: number; aboveCents?: number;
  accountId?: string; counterpartyIban?: string; enabled?: boolean;
};
export type BankRuleSettings = { rules: BankRule[]; accountRoles: Record<string, "personal" | "business"> };
export const emptyBankRules: BankRuleSettings = { rules: [], accountRoles: {} };
const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
const includesTerm = (text: string, term: string) => (` ${normalize(text)} `).includes(` ${normalize(term)} `);
// Match complete merchant names/tokens, never substrings of unrelated payees.
export const groceryTerms = ["Albert Heijn", "AH", "Jumbo", "Lidl", "Aldi", "Plus supermarkt", "Dirk van den Broek", "Dirk", "Hoogvliet", "DekaMarkt", "Deka Markt", "Vomar", "Nettorama", "Boni", "Poiesz", "Spar", "Coop", "Picnic", "Ekoplaza", "Odin", "Supermarkt", "Supermarket"];
/** Shared suggestions and merchant categories; budgets keep their existing exact labels. */
export const spendingCategories = [
  "Boodschappen", "Tanken", "Koffie, snacks en rookwaar", "Coffeeshop",
  "Eten en drinken buiten de deur", "Spullen en huishouden", "Kleding en schoenen",
  "Gezondheid en welzijn", "Persoonlijke verzorging", "Vervoer en parkeren",
  "Vrije tijd en uitjes", "Cadeaus en donaties", "Overige uitgaven",
];
// Consolidate former built-in names in the view without rewriting custom categories or decisions.
export function spendingCategoryLabel(label: string) {
  const aliases: Record<string,string> = {
    "Overige aankopen": "Spullen en huishouden",
    "Sauna en wellness": "Gezondheid en welzijn",
    "Kleding": "Kleding en schoenen",
    "Koffie en snacks": "Koffie, snacks en rookwaar",
    "Tankstation — rookwaar, koffie of snacks": "Koffie, snacks en rookwaar",
  };
  return Object.hasOwn(aliases,label) ? aliases[label] : label;
}
const merchantRules: BankRule[] = [
  { id: "groceries", label: "Boodschappen", kind: "variable", terms: groceryTerms, direction: "out" },
  // Keep existing rule IDs stable so saved group corrections continue to win.
  { id: "variety-store", label: "Spullen en huishouden", kind: "variable", terms: ["Action", "bol.com", "bol com", "Temu", "AliExpress", "Amazon", "IKEA", "HEMA", "Blokker", "Xenos", "Holland Recycling", "kringloop", "kringloopcentrum", "kringloopwinkel", "kringloopcentra", "kringloopbedrijf", "kringloopwarenhuis", "Het Goed", "RataPlan", "Coolblue", "MediaMarkt", "Leen Bakker", "JYSK", "Kwantum", "Praxis", "Gamma", "Karwei"], direction: "out" },
  { id: "clothing", label: "Kleding en schoenen", kind: "variable", terms: ["H&M", "H en M", "C&A", "C en A", "Zara", "Primark", "WE Fashion", "Hunkemoller", "Hunkemöller", "Zeeman", "Uniqlo", "Zalando", "About You", "Omoda", "vanHaren", "van Haren", "Scapino", "Bristol", "Nelson", "Sacha", "Shoeby", "Only", "Jack & Jones", "Bever", "Decathlon", "kledingwinkel", "schoenenwinkel"], direction: "out" },
  { id: "sauna", label: "Gezondheid en welzijn", kind: "variable", terms: ["sauna", "thermen", "wellness", "SpaWell", "Elysium", "Zwaluwhoeve", "Veluwse Bron", "apotheek", "fysiotherapie", "fysiotherapeut", "tandarts", "opticien", "Specsavers", "Pearle", "Hans Anders"], direction: "out" },
  { id: "personal-care", label: "Persoonlijke verzorging", kind: "variable", terms: ["Kruidvat", "Etos", "Trekpleister", "Douglas", "ICI Paris", "Rituals", "kapper", "kappers", "barbershop", "barber", "schoonheidssalon"], direction: "out" },
  { id: "dining", label: "Eten en drinken buiten de deur", kind: "variable", terms: ["restaurant", "pizzeria", "brasserie", "eetcafe", "eetcafé", "Thuisbezorgd", "Uber Eats", "McDonalds", "McDonald's", "Burger King", "KFC", "Subway", "Dominos", "Domino's", "New York Pizza", "FEBO", "snackbar", "Starbucks", "Coffeecompany"], direction: "out" },
  { id: "transport", label: "Vervoer en parkeren", kind: "variable", terms: ["NS Reizigers", "Nederlandse Spoorwegen", "OVpay", "OV-chipkaart", "Arriva", "Connexxion", "Qbuzz", "GVB", "HTM", "Q-Park", "Q Park", "EasyPark", "Parkmobile", "Yellowbrick", "parkeergarage", "parkeren", "taxi", "Bolt"], direction: "out" },
  { id: "leisure", label: "Vrije tijd en uitjes", kind: "variable", terms: ["Pathe", "Pathé", "Kinepolis", "Vue Cinemas", "bioscoop", "theater", "museum", "Efteling", "Walibi", "Toverland", "dierentuin", "Ticketmaster", "Eventim", "bowling", "escape room"], direction: "out" },
  { id: "donations", label: "Cadeaus en donaties", kind: "variable", terms: ["Rode Kruis", "Artsen zonder Grenzen", "KWF", "Unicef", "Amnesty International", "WNF", "Natuurmonumenten", "Greetz", "Fleurop"], direction: "out" },
];
export const fuelTerms = ["Shell", "Esso", "BP", "Texaco", "TotalEnergies", "Total", "Total Energies", "Tango", "Tinq", "Avia", "OK tankstation", "OK", "tankstation", "benzinepomp", "TinQ Express", "Fieten Olie", "Firezone", "Argos", "Q8", "Gulf", "Tamoil", "Supertank", "Sakko", "Joontjes", "haan", "Berkman", "DCO", "NXT", "Shell Recharge"];
export function validateBankRules(value: unknown): value is BankRuleSettings {
  if (!value || typeof value !== "object") return false;
  const s = value as BankRuleSettings;
  return Array.isArray(s.rules) && s.rules.length <= 100 && !!s.accountRoles && typeof s.accountRoles === "object" && !Array.isArray(s.accountRoles) &&
    Object.values(s.accountRoles).every(v => v === "personal" || v === "business") &&
    new Set(s.rules.map(r => r?.id)).size === s.rules.length && s.rules.every(r => r && typeof r.id === "string" && r.id.length > 0 && r.id.length < 100 &&
      typeof r.label === "string" && !!r.label.trim() && r.label.length <= 150 && ["fixed", "variable", "transfer", "financing", "ignore"].includes(r.kind) &&
      (r.kind !== "fixed" || (r.direction === "out" && r.aboveCents !== undefined && r.belowCents === r.aboveCents + 2)) &&
      Array.isArray(r.terms) && r.terms.length <= 30 && r.terms.every(t => typeof t === "string" && !!normalize(t) && t.length <= 150) &&
      (r.terms.length > 0 || (typeof r.accountId === "string" && typeof r.counterpartyIban === "string")) &&
      (r.direction === undefined || r.direction === "in" || r.direction === "out") &&
      (r.accountId === undefined || typeof r.accountId === "string") &&
      (r.counterpartyIban === undefined || /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(r.counterpartyIban)) &&
      (r.enabled === undefined || typeof r.enabled === "boolean") &&
      [r.belowCents, r.aboveCents].every(n => n === undefined || (Number.isSafeInteger(n) && n >= 0)) &&
      (r.belowCents === undefined || r.aboveCents === undefined || r.aboveCents < r.belowCents));
}
export function matchingBankRule(tx: MoneylithTransaction, settings: BankRuleSettings): BankRule | undefined {
  if ((tx.provider !== 'lunchflow' && tx.provider !== 'bunq') || tx.currency !== "EUR" || !Number.isFinite(tx.amount) || tx.amount === 0) return;
  const text = `${tx.providerData?.counterparty ?? tx.counterparty ?? ""} ${tx.providerData?.description ?? tx.description}`;
  const amount = Math.abs(Math.round(tx.amount * 100));
  // A confirmed full destination IBAN is required; suffixes or equal amounts alone are not proof.
  const hasIban = (iban: string) => new RegExp("\\b" + iban.split("").join("\\s*") + "\\b", "i").test(text);
  return [...settings.rules, ...merchantRules].find(r => r.enabled !== false &&
    !(tx.provider==='bunq'&&tx.providerData?.paymentSubType==='BILLING'&&r.kind==='transfer') &&
    (!r.accountId || r.accountId === tx.accountId) &&
    (!r.counterpartyIban || hasIban(r.counterpartyIban)) &&
    (!r.direction || (r.direction === "out" ? tx.amount < 0 : tx.amount > 0)) &&
    (r.belowCents === undefined || amount < r.belowCents) && (r.aboveCents === undefined || amount > r.aboveCents) &&
    (!r.terms.length || r.terms.some(term => includesTerm(text, term))));
}
export function accountRoleLabel(account: MoneylithAccount | undefined, settings: BankRuleSettings) {
  const role = account && settings.accountRoles[account.id];
  return role === "personal" ? "Persoonlijke rekening" : role === "business" ? "Zakelijke rekening" : "";
}

/** Funding movements stay visible in bank history, but are not consumption or earnings. */
export function isOperatingTransaction(tx: MoneylithTransaction, settings: BankRuleSettings = emptyBankRules) {
  return !["transfer", "financing", "ignore"].includes(tx.bankPatternKind ?? "") && settings.accountRoles[tx.accountId] !== "business";
}
