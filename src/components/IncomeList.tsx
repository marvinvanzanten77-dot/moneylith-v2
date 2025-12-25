import { useEffect, useId } from "react";

import { formatCurrency } from "../utils/format";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { IncomeItem } from "../types";

interface IncomeListProps {
  onSumChange?: (sum: number) => void;
  items?: IncomeItem[];
  onItemsChange?: (items: IncomeItem[]) => void;
  storageKey?: string;
  heading?: string;
  subheading?: string;
  addLabel?: string;
  emptyLabel?: string;
  totalLabel?: string;
  readOnly?: boolean;
}

const newId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now());
};

export function IncomeList({
  onSumChange,
  items: controlledItems,
  onItemsChange,
  storageKey,
  heading,
  subheading,
  addLabel,
  emptyLabel,
  totalLabel,
  readOnly = false,
}: IncomeListProps) {
  const tableId = useId();
  const [localItems, setLocalItems] = useLocalStorage<IncomeItem[]>(storageKey ?? "moneylith.personal.incomeItems", []);
  const items = controlledItems ?? localItems;
  const setItems = onItemsChange ?? setLocalItems;
  const isReadOnly = readOnly === true;

  useEffect(() => {
    onSumChange?.(items.reduce((sum, item) => sum + (item.bedrag || 0), 0));
  }, [items, onSumChange]);

  const updateItems = (next: IncomeItem[]) => {
    if (isReadOnly) return;
    setItems(next);
    onSumChange?.(next.reduce((sum, item) => sum + (item.bedrag || 0), 0));
  };

  const updateItem = (id: string, patch: Partial<IncomeItem>) => {
    if (isReadOnly) return;
    updateItems(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    if (isReadOnly) return;
    const id = newId();
    const next = [...items, { id, naam: "", bedrag: 0, opmerking: "" }];
    updateItems(next);
  };

  const removeItem = (id: string) => {
    if (isReadOnly) return;
    const next = items.filter((item) => item.id !== id);
    updateItems(next);
  };

  return (
    <div className="card-shell space-y-3 p-4 text-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600">{heading ?? "Inkomen"}</p>
          <h3 className="text-lg font-semibold text-slate-900">{subheading ?? "Overzicht van je inkomsten"}</h3>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm hover:shadow"
          disabled={isReadOnly}
        >
          {addLabel ?? "+ Nieuwe inkomstenstroom"}
        </button>
      </div>

      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-slate-600">{emptyLabel ?? "Nog geen inkomsten toegevoegd."}</p>}
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm text-sm text-slate-800">
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Naam</span>
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  value={item.naam}
                  onChange={(e) => updateItem(item.id, { naam: e.target.value })}
                  placeholder="Bijv. salaris"
                  readOnly={isReadOnly}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Bedrag (€)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  value={Number.isFinite(item.bedrag) ? item.bedrag : ""}
                  onChange={(e) => updateItem(item.id, { bedrag: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  readOnly={isReadOnly}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Opmerking</span>
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  value={item.opmerking ?? ""}
                  onChange={(e) => updateItem(item.id, { opmerking: e.target.value })}
                  placeholder="optioneel"
                  readOnly={isReadOnly}
                />
              </label>
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="text-xs font-semibold text-red-600 hover:underline"
                disabled={isReadOnly}
              >
                Verwijderen
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-white/80 p-3 text-sm text-slate-800 shadow-inner">
        <div className="flex items-center justify-between">
          <span>{totalLabel ?? "Totaal inkomen"}</span>
          <span className="font-semibold">{formatCurrency(items.reduce((sum, item) => sum + (item.bedrag || 0), 0))}</span>
        </div>
      </div>
    </div>
  );
}
