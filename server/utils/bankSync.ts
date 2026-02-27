import crypto from "node:crypto";
import { getApiBase } from "./bankAuth.js";

type TlAccount = {
  account_id: string;
  display_name?: string;
  account_type?: string;
  currency?: string;
  iban?: string;
  available_balance?: number;
  current_balance?: number;
};

type TlTransaction = {
  transaction_id?: string;
  normalised_provider_transaction_id?: string;
  timestamp?: string;
  description?: string;
  amount?: number;
  currency?: string;
  merchant_name?: string;
  transaction_category?: string;
};

export type BankSyncResult = {
  accounts: TlAccount[];
  transactions: Array<{
    external_id: string;
    account_id: string;
    date: string;
    amount: number;
    description: string;
    counterparty?: string;
    category?: string | null;
  }>;
};

const buildFallbackExternalId = (accountId: string, tx: TlTransaction) => {
  const normalize = (v?: string) =>
    (v || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  const dateOnly = (tx.timestamp || "").slice(0, 10);
  const amount = Number(tx.amount || 0).toFixed(2);
  const raw = [
    accountId,
    tx.currency || "",
    dateOnly,
    amount,
    normalize(tx.description),
    normalize(tx.merchant_name),
  ].join("|");
  const digest = crypto.createHash("sha1").update(raw).digest("hex");
  return `fallback_${digest}`;
};

const dedupeTransactions = (input: BankSyncResult["transactions"]) => {
  const seen = new Set<string>();
  return input.filter((tx) => {
    if (seen.has(tx.external_id)) return false;
    seen.add(tx.external_id);
    return true;
  });
};

export const runBankSync = async (accessToken: string): Promise<BankSyncResult> => {
  const accountsResp = await fetch(`${getApiBase()}/data/v1/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const accountsPayload = (await accountsResp.json().catch(() => ({}))) as { results?: TlAccount[]; error?: string };
  if (!accountsResp.ok) {
    throw new Error(accountsPayload.error || `Accounts fetch failed (${accountsResp.status})`);
  }
  const accounts = Array.isArray(accountsPayload.results) ? accountsPayload.results : [];

  const transactions: BankSyncResult["transactions"] = [];
  for (const account of accounts) {
    const txResp = await fetch(`${getApiBase()}/data/v1/accounts/${account.account_id}/transactions`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    const txPayload = (await txResp.json().catch(() => ({}))) as { results?: TlTransaction[]; error?: string };
    if (!txResp.ok) {
      console.error("[bank.sync] transaction fetch failed", {
        accountId: account.account_id,
        status: txResp.status,
        error: txPayload.error,
      });
      continue;
    }
    const rows = Array.isArray(txPayload.results) ? txPayload.results : [];
    rows.forEach((tx) => {
      const timestamp = tx.timestamp || new Date().toISOString();
      const externalId =
        tx.transaction_id ||
        tx.normalised_provider_transaction_id ||
        buildFallbackExternalId(account.account_id, tx);
      transactions.push({
        external_id: externalId,
        account_id: account.account_id,
        date: timestamp.slice(0, 10),
        amount: Number(tx.amount || 0),
        description: tx.description || "Transactie",
        counterparty: tx.merchant_name,
        category: tx.transaction_category || null,
      });
    });
  }

  return {
    accounts,
    transactions: dedupeTransactions(transactions),
  };
};
