import { useEffect, useMemo, useState } from "react";
import type { SchuldItem, IncomeItem, FixedCostManualItem, MoneylithBucket } from "../../types";
import { analyzeBankTransactions, fetchBankTransactions } from "../../logic/bankAnalysis";

type TLAccount = {
  account_id: string;
  display_name?: string;
  account_type?: string;
  currency?: string;
  iban?: string;
};

type TLAccountsResponse = {
  results?: TLAccount[];
};

const ACCOUNTS_KEY = "moneylith.personal.truelayer.accounts";

interface StepBankProps {
  onAutoFillDebts?: (debts: SchuldItem[]) => void;
  onAutoFillIncomes?: (incomes: IncomeItem[]) => void;
  onAutoFillFixedCosts?: (costs: FixedCostManualItem[]) => void;
  onAutoFillBuckets?: (buckets: MoneylithBucket[]) => void;
  onboardingMode?: "bank" | "manual" | null;
}

const safeJson = async (res: Response) => {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
};

export const StepBank = ({
  onAutoFillDebts,
  onAutoFillIncomes,
  onAutoFillFixedCosts,
  onAutoFillBuckets,
  onboardingMode,
}: StepBankProps = {}) => {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [accounts, setAccounts] = useState<TLAccount[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACCOUNTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setAccounts(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const hasAccounts = accounts.length > 0;

  const hint = useMemo(() => {
    if (hasAccounts) return "Gekoppeld. Je kunt opnieuw koppelen om te verversen.";
    return "Koppel je bank via TrueLayer (sandbox) en haal rekeningen op.";
  }, [hasAccounts]);

  const handleAuthStart = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/truelayer/auth-start", { method: "POST" });
      const data = await safeJson(res);
      if (!res.ok || !data?.url) {
        setStatus(`Koppelen mislukt: ${data?.error || res.status}`);
        return;
      }
      setAuthUrl(String(data.url));
      window.open(String(data.url), "_blank");
    } catch (error) {
      setStatus("Koppelen mislukt: netwerkfout");
    } finally {
      setLoading(false);
    }
  };

  const handleExchange = async () => {
    if (!codeInput.trim()) {
      setStatus("Plak eerst de code uit de callback.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const tokenRes = await fetch("/api/truelayer/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeInput.trim() }),
      });
      const tokenData = await safeJson(tokenRes);
      if (!tokenRes.ok || !tokenData?.access_token) {
        setStatus(`Token exchange mislukt: ${tokenData?.error || tokenRes.status}`);
        return;
      }
      
      // Store access token for later use
      setAccessToken(tokenData.access_token);

      const accountsRes = await fetch("/api/truelayer/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: tokenData.access_token }),
      });
      const accountsData = (await safeJson(accountsRes)) as TLAccountsResponse;
      if (!accountsRes.ok) {
        setStatus(`Accounts ophalen mislukt: ${accountsData?.error || accountsRes.status}`);
        return;
      }
      const results = Array.isArray(accountsData?.results) ? accountsData.results : [];
      setAccounts(results);
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(results));
      setStatus(`Accounts opgehaald: ${results.length}`);

      // If in bank mode, trigger auto-analysis
      if (onboardingMode === "bank" && results.length > 0) {
        await triggerBankAnalysis(results, tokenData.access_token);
      }
    } catch (error) {
      setStatus("Accounts ophalen mislukt: netwerkfout");
    } finally {
      setLoading(false);
    }
  };

  const triggerBankAnalysis = async (accts: TLAccount[], token: string) => {
    if (!onAutoFillDebts && !onAutoFillIncomes && !onAutoFillFixedCosts) {
      return; // No callbacks provided
    }

    setAnalyzing(true);
    setStatus("AI analyseert je transacties...");

    try {
      const accountIds = accts.map((a) => a.account_id);
      const transactions = await fetchBankTransactions(accountIds, token);

      if (transactions.length === 0) {
        setStatus("Geen transacties gevonden.");
        return;
      }

      const analysis = await analyzeBankTransactions(transactions, token);

      // Auto-fill data via callbacks
      if (onAutoFillDebts && analysis.suggestedDebts.length > 0) {
        onAutoFillDebts(analysis.suggestedDebts);
      }
      if (onAutoFillIncomes && analysis.suggestedIncomes.length > 0) {
        onAutoFillIncomes(analysis.suggestedIncomes);
      }
      if (onAutoFillFixedCosts && analysis.suggestedFixedCosts.length > 0) {
        onAutoFillFixedCosts(analysis.suggestedFixedCosts);
      }
      if (onAutoFillBuckets && analysis.suggestedBuckets.length > 0) {
        onAutoFillBuckets(analysis.suggestedBuckets);
      }

      setStatus(
        `✅ Analyse voltooid! ${analysis.suggestedDebts.length} schulden, ` +
        `${analysis.suggestedIncomes.length} inkomsten, ` +
        `${analysis.suggestedFixedCosts.length} vaste lasten, ` +
        `${analysis.suggestedBuckets.length} potjes geïdentificeerd.`
      );
    } catch (error) {
      console.error("Bank analysis error:", error);
      setStatus("Analyse mislukt. Probeer handmatig in te vullen.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card-shell p-4 text-slate-900">
        <h3 className="text-lg font-semibold text-slate-900">Bankkoppeling (TrueLayer)</h3>
        <p className="mt-1 text-sm text-slate-600">{hint}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAuthStart}
            className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:bg-amber-400 disabled:opacity-60"
            disabled={loading}
          >
            Koppel bank
          </button>
          {authUrl ? (
            <a
              href={authUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-amber-700 underline"
            >
              Open autorisatie link
            </a>
          ) : null}
        </div>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Na toestaan kom je op de callback‑pagina. Kopieer de <span className="font-semibold">code</span> en plak die
          hieronder.
        </div>
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
          <input
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Plak callback code hier"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 md:flex-1"
          />
          <button
            type="button"
            onClick={handleExchange}
            className="rounded-full border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60"
            disabled={loading}
          >
            Accounts ophalen
          </button>
        </div>
        {status ? <p className="mt-2 text-xs text-slate-600">{status}</p> : null}
      </div>

      <div className="card-shell p-4 text-slate-900">
        <h4 className="text-base font-semibold text-slate-900">Gekoppelde rekeningen</h4>
        {accounts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Nog geen accounts gekoppeld.</p>
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
