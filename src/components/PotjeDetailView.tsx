import { useMemo, useState } from "react";
import { formatCurrency } from "../utils/format";
import type { MoneylithTransaction } from "../types";

type DetailTx = MoneylithTransaction & {
  merchantKey?: string;
  derivedCategory?: string;
  isTankCandidate?: boolean;
};

interface PotjeDetailViewProps {
  label: string;
  transactions: DetailTx[];
  onClose: () => void;
  onOverride?: (merchantKey: string, kind: "fuel" | "shop") => void;
}

export function PotjeDetailView({ label, transactions, onClose, onOverride }: PotjeDetailViewProps) {
  const [search, setSearch] = useState("");
  const [merchantFilter, setMerchantFilter] = useState<string>("all");
  const [sortDesc, setSortDesc] = useState(true);

  const merchants = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      const key = (t.merchantKey || t.counterparty || t.description || "").toLowerCase().trim();
      if (key) set.add(key);
    });
    return Array.from(set).sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return transactions
      .filter((t) => {
        if (!term) return true;
        const hay = `${t.description || ""} ${t.counterparty || ""}`.toLowerCase();
        return hay.includes(term);
      })
      .filter((t) => {
        if (merchantFilter === "all") return true;
        const key = (t.merchantKey || t.counterparty || t.description || "").toLowerCase().trim();
        return key === merchantFilter;
      })
      .sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        return sortDesc ? db - da : da - db;
      });
  }, [merchantFilter, search, sortDesc, transactions]);

  const total = useMemo(() => filtered.reduce((s, t) => s + Math.abs(t.amount || 0), 0), [filtered]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{label}</h3>
            <p className="text-xs text-slate-500">{transactions.length} transacties · Totaal {formatCurrency(total)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Sluiten
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek in omschrijving/merchant"
            className="w-48 rounded-md border border-slate-200 px-2 py-1"
          />
          <select
            value={merchantFilter}
            onChange={(e) => setMerchantFilter(e.target.value)}
            className="rounded-md border border-slate-200 px-2 py-1"
          >
            <option value="all">Alle merchants</option>
            {merchants.map((m) => (
              <option key={m} value={m}>
                {m || "onbekend"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSortDesc((v) => !v)}
            className="rounded-md border border-slate-200 px-2 py-1"
          >
            Sortering: {sortDesc ? "Nieuwste eerst" : "Oudste eerst"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setMerchantFilter("all");
              setSortDesc(true);
            }}
            className="rounded-md border border-slate-200 px-2 py-1"
          >
            Reset filters
          </button>
        </div>

        <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-xs text-slate-800">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Datum</th>
                <th className="px-3 py-2 text-left">Merchant</th>
                <th className="px-3 py-2 text-left">Omschrijving</th>
                <th className="px-3 py-2 text-right">Bedrag</th>
                <th className="px-3 py-2 text-left">Rekening</th>
                <th className="px-3 py-2 text-left">Actie</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const mk = (t.merchantKey || t.counterparty || t.description || "").toLowerCase().trim();
                const isFuel = t.derivedCategory === "Brandstof";
                const isShop = t.derivedCategory === "Tankstation Shop/Overig";
                return (
                  <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">{t.date}</td>
                    <td className="px-3 py-2">{mk || "onbekend"}</td>
                    <td className="px-3 py-2">{t.description}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(Math.abs(t.amount))}</td>
                    <td className="px-3 py-2">{t.accountId}</td>
                    <td className="px-3 py-2">
                      {t.isTankCandidate ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isFuel ? "bg-amber-100 text-amber-800" : isShop ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {isFuel ? "Brandstof" : isShop ? "Shop" : "Onbekend"}
                          </span>
                          {onOverride && (
                            <>
                              <button
                                type="button"
                                className="rounded border border-amber-300 px-2 py-0.5 text-[11px] text-amber-800"
                                onClick={() => onOverride(mk, "fuel")}
                              >
                                Markeer Brandstof
                              </button>
                              <button
                                type="button"
                                className="rounded border border-indigo-300 px-2 py-0.5 text-[11px] text-indigo-800"
                                onClick={() => onOverride(mk, "shop")}
                              >
                                Markeer Shop
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
