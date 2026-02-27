import { useCallback, useEffect, useMemo, useState } from "react";
import type { FixedCostManualItem, IncomeItem, MoneylithAccount, MoneylithBucket, MoneylithTransaction, SchuldItem } from "../../types";
import { analyzeBankTransactions } from "../../logic/bankAnalysis";
import { persistGateway } from "../../storage/persistGateway";

type SyncAccount = {
  account_id: string;
  display_name?: string;
  account_type?: string;
  currency?: string;
  iban?: string;
};

type SyncTransaction = {
  external_id: string;
  account_id: string;
  date: string;
  amount: number;
  description: string;
  counterparty?: string;
  category?: string | null;
};

type SyncResponse = {
  ok?: boolean;
  connected?: boolean;
  expires_at?: string;
  accounts?: SyncAccount[];
  transactions?: SyncTransaction[];
};

type BankUiState = "disconnected" | "connecting" | "syncing" | "connected" | "failed";

interface StepBankProps {
  onAutoFillDebts?: (debts: SchuldItem[]) => void;
  onAutoFillIncomes?: (incomes: IncomeItem[]) => void;
  onAutoFillFixedCosts?: (costs: FixedCostManualItem[]) => void;
  onAutoFillBuckets?: (buckets: MoneylithBucket[]) => void;
  onSyncAccounts?: (accounts: MoneylithAccount[]) => void;
  onSyncTransactions?: (transactions: MoneylithTransaction[]) => void;
  onConnectionChange?: (connected: boolean) => void;
  onPurgeBankData?: () => void;
  onboardingMode?: "bank" | "manual" | null;
}

const mapAccountType = (input?: string): MoneylithAccount["type"] => {
  const v = (input || "").toLowerCase();
  if (v.includes("savings")) return "spaarrekening";
  if (v.includes("cash")) return "contant";
  return "betaalrekening";
};

const mapAccounts = (accounts: SyncAccount[]): MoneylithAccount[] => {
  return accounts.map((a, idx) => ({
    id: a.account_id,
    name: a.display_name || `Rekening ${idx + 1}`,
    type: mapAccountType(a.account_type),
    iban: a.iban || undefined,
    active: true,
    isPrimary: idx === 0,
    description: [a.account_type, a.currency].filter(Boolean).join(" | ") || undefined,
    source: "bank",
  }));
};

const mapTransactions = (rows: SyncTransaction[]): MoneylithTransaction[] => {
  return rows.map((tx) => ({
    id: tx.external_id,
    accountId: tx.account_id,
    date: tx.date,
    amount: tx.amount,
    description: tx.description,
    counterparty: tx.counterparty,
    category: tx.category,
    external_id: tx.external_id,
    source: "bank",
  })) as MoneylithTransaction[];
};

export const StepBank = ({
  onAutoFillDebts,
  onAutoFillIncomes,
  onAutoFillFixedCosts,
  onAutoFillBuckets,
  onSyncAccounts,
  onSyncTransactions,
  onConnectionChange,
  onPurgeBankData,
  onboardingMode,
}: StepBankProps = {}) => {
  const [state, setState] = useState<BankUiState>("disconnected");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<SyncAccount[]>([]);

  const loading = state === "syncing";
  const hasAccounts = accounts.length > 0;

  const hint = useMemo(() => {
    if (state === "connected" || hasAccounts) return "Bank gekoppeld. Je kunt opnieuw synchroniseren om te verversen.";
    if (state === "syncing") return "Synchronisatie bezig...";
    if (state === "failed") return "Koppeling of synchronisatie mislukt.";
    return "Koppel je bank via TrueLayer Hosted Consent Screen.";
  }, [hasAccounts, state]);

  const hydrateConnectionStatus = useCallback(async () => {
    try {
      const resp = await fetch("/api/bank/status", { method: "GET" });
      const data = (await resp.json().catch(() => ({}))) as SyncResponse;
      if (!resp.ok || !data.connected) {
        setState("disconnected");
        setAccounts([]);
        onConnectionChange?.(false);
        onPurgeBankData?.();
        setStatus("Niet gekoppeld.");
        return false;
      }
      setState("connected");
      onConnectionChange?.(true);
      setStatus(data.expires_at ? `Verbonden (token geldig tot ${new Date(data.expires_at).toLocaleString()}).` : "Verbonden.");
      return true;
    } catch {
      setState("failed");
      setError("Verbindingsstatus ophalen mislukt.");
      return false;
    }
  }, [onConnectionChange, onPurgeBankData]);

  const runSync = useCallback(async () => {
    setState("syncing");
    setError(null);
    setStatus("Synchroniseren...");
    try {
      const resp = await fetch("/api/bank/sync", { method: "POST" });
      const data = (await resp.json().catch(() => ({}))) as SyncResponse & { error?: string };
      if (!resp.ok || !data.ok) {
        if (resp.status === 401) {
          setState("disconnected");
          onConnectionChange?.(false);
          onPurgeBankData?.();
          setError("Geen actieve bankkoppeling. Verbind opnieuw.");
          setStatus(null);
          return;
        }
        setState("failed");
        setError(data.error || `Sync mislukt (${resp.status})`);
        setStatus(null);
        return;
      }

      const syncedAccounts = Array.isArray(data.accounts) ? data.accounts : [];
      const syncedTransactions = Array.isArray(data.transactions) ? data.transactions : [];
      setAccounts(syncedAccounts);

      onSyncAccounts?.(mapAccounts(syncedAccounts));
      onSyncTransactions?.(mapTransactions(syncedTransactions));

      if (onboardingMode === "bank" && syncedTransactions.length > 0) {
        const analysis = await analyzeBankTransactions(
          syncedTransactions.map((tx) => ({
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
          })),
          "",
        );
        if (analysis.suggestedDebts.length) onAutoFillDebts?.(analysis.suggestedDebts);
        if (analysis.suggestedIncomes.length) onAutoFillIncomes?.(analysis.suggestedIncomes);
        if (analysis.suggestedFixedCosts.length) onAutoFillFixedCosts?.(analysis.suggestedFixedCosts);
        if (analysis.suggestedBuckets.length) onAutoFillBuckets?.(analysis.suggestedBuckets);
      }

      setState("connected");
      onConnectionChange?.(true);
      persistGateway.set("moneylith.personal.bank.lastSync", new Date().toISOString());
      setStatus(`Sync voltooid: ${syncedAccounts.length} rekening(en), ${syncedTransactions.length} transactie(s).`);
    } catch (err) {
      setState("failed");
      setError("Synchronisatie mislukt. Probeer opnieuw.");
      setStatus(null);
    }
  }, [onAutoFillBuckets, onAutoFillDebts, onAutoFillFixedCosts, onAutoFillIncomes, onConnectionChange, onPurgeBankData, onSyncAccounts, onSyncTransactions, onboardingMode]);

  const runDisconnect = useCallback(async () => {
    setError(null);
    try {
      const resp = await fetch("/api/bank/disconnect", { method: "POST" });
      if (!resp.ok) {
        setState("failed");
        setError("Ontkoppelen mislukt.");
        return;
      }
      setState("disconnected");
      setAccounts([]);
      onConnectionChange?.(false);
      onPurgeBankData?.();
      setStatus("Bankkoppeling ontkoppeld.");
    } catch {
      setState("failed");
      setError("Ontkoppelen mislukt.");
    }
  }, [onConnectionChange, onPurgeBankData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bankStatus = params.get("bank");
    if (bankStatus === "connected") {
      setState("syncing");
      void runSync();
      params.delete("bank");
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", next);
    } else if (bankStatus === "error" || bankStatus === "state_error") {
      setState("failed");
      setError("Bankkoppeling mislukt. Probeer opnieuw.");
      params.delete("bank");
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", next);
    } else {
      void hydrateConnectionStatus();
    }
  }, [hydrateConnectionStatus, runSync]);

  return (
    <div className="space-y-4">
      <div className="card-shell p-4 text-slate-900">
        <h3 className="text-lg font-semibold text-slate-900">Bankkoppeling (TrueLayer)</h3>
        <p className="mt-1 text-sm text-slate-600">{hint}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setState("connecting");
              setStatus("Doorsturen naar bank consent...");
              window.location.href = "/api/bank/connect";
            }}
            className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:bg-amber-400"
            disabled={loading}
          >
            Connect Bank
          </button>
          <button
            type="button"
            onClick={() => void runSync()}
            className="rounded-full border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60"
            disabled={loading || state === "disconnected" || state === "connecting"}
          >
            {loading ? "Bezig..." : "Sync nu"}
          </button>
          <button
            type="button"
            onClick={() => void runDisconnect()}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            disabled={loading || state === "disconnected"}
          >
            Disconnect
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-900">{error}</p>
          </div>
        ) : null}
        {status ? (
          <div className="mt-3 rounded-lg border border-green-300 bg-green-50 p-3">
            <p className="text-sm text-green-900">{status}</p>
          </div>
        ) : null}
      </div>

      <div className="card-shell p-4 text-slate-900">
        <h4 className="text-base font-semibold text-slate-900">Gekoppelde rekeningen</h4>
        {accounts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Nog geen accounts gesynchroniseerd.</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {accounts.map((acct) => (
              <div key={acct.account_id} className="rounded-lg border border-slate-200 bg-white/80 p-3 text-sm">
                <p className="font-semibold text-slate-900">{acct.display_name || "Rekening"}</p>
                <p className="text-xs text-slate-500">{acct.account_type || "account"}</p>
                {acct.iban ? <p className="text-xs text-slate-500">IBAN: {acct.iban}</p> : null}
                {acct.currency ? <p className="text-xs text-slate-500">Valuta: {acct.currency}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
