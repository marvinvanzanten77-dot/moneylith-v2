import React, { useEffect, useMemo } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { FutureIncomeItem } from "../types";
import { formatCurrency } from "../utils/format";

interface FutureIncomeListProps {
  onSumChange?: (sum: number) => void;
  items?: FutureIncomeItem[];
  onItemsChange?: (items: FutureIncomeItem[]) => void;
  storageKey?: string;
  heading?: string;
  subheading?: string;
  addLabel?: string;
  emptyLabel?: string;
  helpText?: string;
  readOnly?: boolean;
}

const toIsoDate = (value?: string) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value;
};

export function FutureIncomeList({
  onSumChange,
  items: controlledItems,
  onItemsChange,
  storageKey,
  heading,
  subheading,
  addLabel,
  emptyLabel,
  helpText,
  readOnly,
}: FutureIncomeListProps) {
  const [localItems, setLocalItems] = useLocalStorage<FutureIncomeItem[]>(
    storageKey ?? "moneylith.personal.futureIncome",
    [],
  );
  const items = controlledItems ?? localItems;
  const setItems = onItemsChange ?? setLocalItems;
  const isReadOnly = readOnly === true;

  const total = useMemo(() => items.reduce((sum, item) => sum + (item.bedrag || 0), 0), [items]);

  useEffect(() => {
    onSumChange?.(total);
  }, [total, onSumChange]);

  const addItem = () => {
    if (isReadOnly) return;
    const next: FutureIncomeItem = {
      id: crypto.randomUUID(),
      naam: "",
      bedrag: 0,
      datum: new Date().toISOString().slice(0, 10),
    };
    setItems([next, ...items]);
  };

  const updateItem = (id: string, patch: Partial<FutureIncomeItem>) => {
    if (isReadOnly) return;
    setItems(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    if (isReadOnly) return;
    setItems(items.filter((item) => item.id !== id));
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-600">{heading ?? "Toekomstige inkomsten"}</p>
          <h3 className="text-lg font-semibold text-slate-900">{subheading ?? "Eenmalige bedragen met datum"}</h3>
          {helpText && <p className="mt-1 text-xs text-slate-600">{helpText}</p>}
        </div>
        <button
          type="button"
          onClick={addItem}
          disabled={isReadOnly}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:shadow disabled:opacity-60"
        >
          {addLabel ?? "+ Nieuwe toekomstige post"}
        </button>
      </div>

      {items.length === 0 && (
        <p className="mt-3 text-sm text-slate-600">{emptyLabel ?? "Nog geen toekomstige inkomsten toegevoegd."}</p>
      )}

      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 bg-white/70 p-3">
            <div className="grid gap-2 md:grid-cols-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Naam</span>
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                  value={item.naam}
                  onChange={(e) => updateItem(item.id, { naam: e.target.value })}
                  placeholder="Bijv. bonus, vakantiegeld"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Bedrag</span>
                <input
                  type="number"
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                  value={Number.isFinite(item.bedrag) ? item.bedrag : ""}
                  onChange={(e) => updateItem(item.id, { bedrag: Number(e.target.value) })}
                  placeholder="0"
                  min={0}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Datum</span>
                <input
                  type="date"
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                  value={toIsoDate(item.datum)}
                  onChange={(e) => updateItem(item.id, { datum: e.target.value })}
                />
              </label>
              <div className="flex items-end justify-between gap-2">
                <div className="text-xs text-slate-500">
                  {item.bedrag ? formatCurrency(item.bedrag) : "—"}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  Verwijderen
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
