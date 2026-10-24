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
const merchantRules: BankRule[] = [
  { id: "groceries", label: "Boodschappen", kind: "variable", terms: groceryTerms, direction: "out" },
  { id: "variety-store", label: "Overige aankopen", kind: "variable", terms: ["Action"], direction: "out" },
  { id: "sauna", label: "Sauna en wellness", kind: "variable", terms: ["sauna", "thermen"], direction: "out" },
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
  if (tx.provider !== "lunchflow" || tx.currency !== "EUR" || !Number.isFinite(tx.amount) || tx.amount === 0) return;
  const text = `${tx.providerData?.counterparty ?? tx.counterparty ?? ""} ${tx.providerData?.description ?? tx.description}`;
  const amount = Math.abs(Math.round(tx.amount * 100));
  // A confirmed full destination IBAN is required; suffixes or equal amounts alone are not proof.
  const hasIban = (iban: string) => new RegExp("\\b" + iban.split("").join("\\s*") + "\\b", "i").test(text);
  return [...settings.rules, ...merchantRules].find(r => r.enabled !== false &&
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
