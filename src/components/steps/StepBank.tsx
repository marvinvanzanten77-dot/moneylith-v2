import { useCallback, useEffect, useMemo, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
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
  onboardingMode?: "bank" | "manual" | "cloud" | null;
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
  const [linkToken, setLinkToken] = useState<string | null>(null);

  const loading = state === "syncing" || state === "connecting";
  const hasAccounts = accounts.length > 0;

  const hint = useMemo(() => {
    if (state === "connected" || hasAccounts) return "Bank gekoppeld via Plaid. Je kunt dat synchroniseren om te verversen.";
    if (state === "syncing") return "Synchronisatie bezig...";
    if (state === "connecting") return "Plaid Link openen...";
    if (state === "failed") return "Koppeling of synchronisatie mislukt.";
    return "Koppel je bank via Plaid in-app authentication.";
  }, [hasAccounts, state]);

  // Generate link token for Plaid Link UI
  const generateLinkToken = useCallback(async () => {
    try {
      const response = await fetch("/api/plaid?plaid=create-link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: `user-${Date.now()}` }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate link token");
      }

      const data = await response.json();
      setLinkToken(data.link_token);
      setState("connecting");
      return data.link_token;
    } catch (err) {
      setState("failed");
      setError("Link token generatie mislukt. Probeer opnieuw.");
      return null;
    }
  }, []);

  // Exchange public token for access token after successful Plaid login
  const exchangePublicToken = useCallback(
    async (publicToken: string) => {
      setState("syncing");
      setError(null);
      setStatus("Token uitwisseling en synchronisatie...");

      try {
        const exchangeResponse = await fetch("/api/plaid?plaid=exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken }),
        });

        if (!exchangeResponse.ok) {
          throw new Error("Token exchange failed");
        }

        const { access_token } = await exchangeResponse.json();

        // Fetch accounts
        const accountsResponse = await fetch("/api/plaid?plaid=accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token }),
        });

        if (!accountsResponse.ok) {
          throw new Error("Failed to fetch accounts");
        }

        const { accounts: fetchedAccounts } = await accountsResponse.json();

        // Fetch transactions
        const transactionsResponse = await fetch("/api/plaid?plaid=transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token }),
        });

        if (!transactionsResponse.ok) {
          throw new Error("Failed to fetch transactions");
        }

        const { transactions: fetchedTransactions } = await transactionsResponse.json();

        // Store access token locally for future syncs
        persistGateway.set("moneylith.plaid.access_token", access_token);
        persistGateway.set("moneylith.personal.bank.lastSync", new Date().toISOString());

        // Map and update UI
        const mappedAccounts: SyncAccount[] = fetchedAccounts.map((acc: any) => ({
          account_id: acc.id,
          display_name: acc.name,
          account_type: acc.type,
          currency: "EUR",
        }));

        const mappedTransactions: SyncTransaction[] = fetchedTransactions.map((tx: any) => ({
          external_id: tx.id,
          account_id: tx.account_id,
          date: tx.date,
          amount: tx.type === "expense" ? -tx.amount : tx.amount,
          description: tx.name,
          category: tx.category,
        }));

        setAccounts(mappedAccounts);
        onSyncAccounts?.(mapAccounts(mappedAccounts));
        onSyncTransactions?.(mapTransactions(mappedTransactions));

        // Auto-fill in onboarding mode
        if (onboardingMode === "bank" && mappedTransactions.length > 0) {
          const analysis = await analyzeBankTransactions(
            mappedTransactions.map((tx) => ({
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
        setStatus(`Sync voltooid: ${mappedAccounts.length} rekening(en), ${mappedTransactions.length} transactie(s).`);
      } catch (err) {
        setState("failed");
        setError((err as Error).message || "Synchronisatie mislukt. Probeer opnieuw.");
        setStatus(null);
      }
    },
    [onAutoFillBuckets, onAutoFillDebts, onAutoFillFixedCosts, onAutoFillIncomes, onConnectionChange, onSyncAccounts, onSyncTransactions, onboardingMode],
  );

  // Plaid Link configuration
  const { open } = usePlaidLink({
    token: linkToken || "",
    onSuccess: (publicToken) => {
      void exchangePublicToken(publicToken);
    },
    onExit: () => {
      setState("disconnected");
      setError("Plaid Link gesloten zonder verbinding.");
    },
  });

  const runDisconnect = useCallback(async () => {
    setError(null);
    persistGateway.remove("moneylith.plaid.access_token");
    setState("disconnected");
    setAccounts([]);
    onConnectionChange?.(false);
    onPurgeBankData?.();
    setStatus("Bankkoppeling verwijderd.");
  }, [onConnectionChange, onPurgeBankData]);

  // Check if already connected on mount
  useEffect(() => {
    const accessToken = persistGateway.get("moneylith.plaid.access_token");
    if (accessToken) {
      setState("connected");
      onConnectionChange?.(true);
      setStatus("Verbonden met Plaid.");
    }
  }, [onConnectionChange]);

  return (
    <div className="space-y-4">
      <div className="card-shell p-4 text-slate-900">
        <h3 className="text-lg font-semibold text-slate-900">Bankkoppeling (Plaid)</h3>
        <p className="mt-1 text-sm text-slate-600">{hint}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const token = await generateLinkToken();
              if (token) {
                open();
              }
            }}
            className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-400 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Bezig..." : "Connect Bank"}
          </button>
          <button
            type="button"
            onClick={() => void exchangePublicToken(persistGateway.get("moneylith.plaid.access_token") || "")}
            className="rounded-full border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60"
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
                {acct.currency ? <p className="text-xs text-slate-500">Valuta: {acct.currency}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
