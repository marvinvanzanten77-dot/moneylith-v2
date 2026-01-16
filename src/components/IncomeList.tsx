import { useEffect, useId, useRef, useState } from "react";

import { useLocalStorage } from "../hooks/useLocalStorage";
import { formatCurrency } from "../utils/format";
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
  useId(); // reserved for potential aria relationships; avoid breaking existing structure
  const [localItems, setLocalItems] = useLocalStorage<IncomeItem[]>(storageKey ?? "moneylith.personal.incomeItems", []);
  const items = controlledItems ?? localItems;
  const setItems = onItemsChange ?? setLocalItems;
  const isReadOnly = readOnly === true;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
    setExpandedId(id);
  };

  const removeItem = (id: string) => {
    if (isReadOnly) return;
    const next = items.filter((item) => item.id !== id);
    updateItems(next);
    if (expandedId === id) {
      setExpandedId(null);
    }
  };

  const toggleExpanded = (id: string) => {
    if (isReadOnly) return;
    setExpandedId((current) => (current === id ? null : id));
  };

  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (expandedId && listRef.current && !listRef.current.contains(target)) {
        setExpandedId(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpandedId(null);
      }
    };

    document.addEventListener("mousedown", handleClickAway);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickAway);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [expandedId]);

  return (
    <div ref={listRef} className="card-shell space-y-3 p-4 text-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600">{heading ?? "Inkomen"}</p>
          <h3 className="text-lg font-semibold text-slate-900">{subheading ?? "Overzicht van je inkomsten"}</h3>
          <p className="text-xs text-slate-500">
            Vrije ruimte = inkomen - vaste lasten. Dit bedrag wordt in andere tabs gebruikt als startpunt.
          </p>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-amber-400 hover:shadow"
          disabled={isReadOnly}
        >
          {addLabel ?? "+ Nieuwe inkomstenstroom"}
        </button>
      </div>

      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-slate-600">{emptyLabel ?? "Nog geen inkomsten toegevoegd."}</p>}
        {items.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <div
              key={item.id}
              className={`rounded-xl border bg-white shadow-sm transition-all duration-200 ${
                isExpanded ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200 hover:border-amber-200"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleExpanded(item.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition ${
                  isExpanded ? "bg-amber-50" : "hover:bg-slate-50"
                }`}
                disabled={isReadOnly}
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{item.naam?.trim() || "Naam"}</p>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span>{formatCurrency(item.bedrag || 0)}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-amber-100 px-3 py-3 text-sm text-slate-800">
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-600">Naam</span>
                      <input
                        type="text"
                        className="rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        value={item.naam}
                        onChange={(e) => updateItem(item.id, { naam: e.target.value })}
                        placeholder="Bijv. salaris"
                        readOnly={isReadOnly}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-600">Bedrag</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
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
                        className="rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        value={item.opmerking ?? ""}
                        onChange={(e) => updateItem(item.id, { opmerking: e.target.value })}
                        placeholder="optioneel"
                        readOnly={isReadOnly}
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end">
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
              )}
            </div>
          );
        })}
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
