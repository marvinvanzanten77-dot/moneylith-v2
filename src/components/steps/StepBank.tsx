import { useEffect, useState } from "react";
import type { MoneylithTransaction } from "../../types";

type BankAccountLink = {
  requisition_id: string;
  agreement_id: string;
  institution_id: string;
  accounts: string[];
  status?: string;
  last_sync?: string | null;
  last_error?: string | null;
};

type Institution = { id: string; name: string };

export function StepBank({
  onTransactions,
  mode = "personal",
}: {
  onTransactions: (txs: MoneylithTransaction[]) => void;
  mode?: "personal" | "business";
}) {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [links, setLinks] = useState<BankAccountLink[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bank/institutions", { method: "POST" })
      .then((r) => r.json())
      .then((data) => setInstitutions(data || []))
      .catch(() => {});
    refreshLinks();
  }, []);

  const refreshLinks = () => {
    fetch("/api/bank/accounts")
      .then((r) => r.json())
      .then((data) => setLinks(data || []))
      .catch(() => {});
  };

  const handleConnect = async () => {
    if (!selectedInstitution) return;
    setLoading(true);
    setStatus(null);
    try {
      const resp = await fetch("/api/bank/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionId: selectedInstitution }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "connect failed");
      if (data?.link) {
        window.location.href = data.link;
      } else {
        setStatus("Geen redirect-link ontvangen.");
      }
    } catch (err: any) {
      setStatus(err.message || "Koppelen mislukt");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (accountId?: string, requisitionId?: string) => {
    setLoading(true);
    setStatus("Sync bezig...");
    try {
      const resp = await fetch("/api/bank/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, requisitionId }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "sync failed");
      const txs: MoneylithTransaction[] = [];
      (data || []).forEach((acc: any) => {
        (acc.transactions || []).forEach((t: any) => {
          txs.push({
            id: t.id,
            accountId: t.accountId,
            date: t.date,
            amount: t.amount,
            description: t.description,
            counterparty: t.counterparty,
            category: t.category ?? null,
            external_id: t.external_id,
            status: t.status,
          });
        });
      });
      if (txs.length) onTransactions(txs);
      setStatus(`Sync klaar. ${txs.length} transacties opgehaald.`);
      refreshLinks();
    } catch (err: any) {
      setStatus(err.message || "Sync mislukt");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (requisitionId: string) => {
    setLoading(true);
    try {
      await fetch("/api/bank/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requisitionId }),
      });
      refreshLinks();
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-slate-50">
        <h1 className="text-xl font-semibold">Bankkoppeling ({mode === "business" ? "zakelijk" : "persoonlijk"})</h1>
        <p className="text-sm text-slate-300">Handmatige PSD2-sync via GoCardless/Nordigen. Data blijft lokaal.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-slate-50 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={selectedInstitution}
            onChange={(e) => setSelectedInstitution(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="">Kies bank (NL)</option>
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleConnect}
            disabled={!selectedInstitution || loading}
            className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
          >
            {loading ? "Bezig..." : "Koppel bank"}
          </button>
        </div>
        <p className="text-xs text-slate-400">Na koppelen word je teruggestuurd en kun je handmatig syncen.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-slate-50 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Gekoppelde rekeningen</h2>
          <button
            type="button"
            onClick={() => handleSync()}
            disabled={loading || !links.length}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 disabled:opacity-50"
          >
            Sync alle
          </button>
        </div>
        {!links.length && <p className="text-sm text-slate-400">Nog geen koppelingen.</p>}
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link.requisition_id} className="rounded-lg border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-100">Requisition: {link.requisition_id}</p>
                  <p className="text-slate-400">Status: {link.status ?? "onbekend"}</p>
                  <p className="text-slate-400">
                    Accounts: {link.accounts?.length ? link.accounts.join(", ") : "onbekend"}
                  </p>
                  {link.last_sync && <p className="text-slate-400">Laatste sync: {new Date(link.last_sync).toLocaleString()}</p>}
                  {link.last_error && <p className="text-red-300">Fout: {link.last_error}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleSync(undefined, link.requisition_id)}
                    disabled={loading}
                    className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-900 disabled:opacity-50"
                  >
                    Sync nu
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDisconnect(link.requisition_id)}
                    disabled={loading}
                    className="rounded-lg border border-red-400 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/10"
                  >
                    Ontkoppel
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {status && <p className="text-xs text-amber-200">{status}</p>}
      </div>
    </div>
  );
}
