import { useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency } from "../utils/format";

interface AssetSummary {
  totalAssets: number;
  assetsCount: number;
}

interface AssetItem {
  id: string;
  naam: string;
  bedrag: number;
}

interface VermogenCardProps {
  items?: AssetItem[];
  onItemsChange?: (items: AssetItem[]) => void;
  onSummaryChange?: (summary: AssetSummary) => void;
  readOnly?: boolean;
}

const createId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

export const VermogenCard = ({ items: externalItems, onItemsChange, onSummaryChange, readOnly = false }: VermogenCardProps) => {
  const [internalItems, setInternalItems] = useState<AssetItem[]>([]);
  const isReadOnly = readOnly === true;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInternalItems(externalItems ?? []);
  }, [externalItems]);

  const summary = useMemo(() => {
    const totalAssets = internalItems.reduce(
      (sum, item) => sum + (Number.isFinite(item.bedrag) ? Math.max(0, item.bedrag) : 0),
      0,
    );
    return { totalAssets, assetsCount: internalItems.length };
  }, [internalItems]);

  useEffect(() => {
    onSummaryChange?.(summary);
  }, [summary, onSummaryChange]);

  const sync = (next: AssetItem[]) => {
    setInternalItems(next);
    if (onItemsChange && !isReadOnly) {
      onItemsChange(next);
    }
  };

  const addItem = () => {
    if (isReadOnly) return;
    const id = createId();
    sync([...internalItems, { id, naam: "", bedrag: 0 }]);
    setExpandedId(id);
  };

  const updateItem = (id: string, patch: Partial<AssetItem>) => {
    if (isReadOnly) return;
    sync(internalItems.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    if (isReadOnly) return;
    if (!window.confirm("Weet je zeker dat je deze vermogenspost wilt verwijderen?")) return;
    sync(internalItems.filter((item) => item.id !== id));
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
    <div ref={listRef} className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">Vermogenskaart</div>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-amber-400 hover:shadow"
          onClick={addItem}
          disabled={isReadOnly}
        >
          + Nieuwe post
        </button>
      </div>

      {internalItems.length === 0 && (
        <p className="rounded-lg border border-slate-300 bg-white/80 p-3 text-sm text-slate-600">
          Nog geen vermogen of buffers toegevoegd.
        </p>
      )}

      {internalItems.map((item) => {
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
                <span>{formatCurrency(Number.isFinite(item.bedrag) ? Math.max(0, item.bedrag) : 0)}</span>
                <span className="text-xs text-slate-500" aria-hidden>
                  {isExpanded ? "▲" : "▼"}
                </span>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-amber-100 px-3 py-3 text-sm text-slate-800">
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-600">Naam</span>
                    <input
                      type="text"
                      className="rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      value={item.naam}
                      onChange={(e) => updateItem(item.id, { naam: e.target.value })}
                      placeholder="Bijv. noodbuffer"
                      readOnly={isReadOnly}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-600">Bedrag</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      value={Number.isFinite(item.bedrag) ? item.bedrag : ""}
                      onChange={(e) => updateItem(item.id, { bedrag: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
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

      <div className="rounded-lg bg-white/80 p-3 text-sm text-slate-800 shadow-inner">
        <p>
          Totaal openstaand:{" "}
          <span className="font-semibold">
            {formatCurrency(summary.totalAssets)}
          </span>
        </p>
        <p>Aantal posten: {summary.assetsCount}</p>
      </div>
    </div>
  );
};
