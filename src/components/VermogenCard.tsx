import { useEffect, useMemo, useState } from "react";

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

const createId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export const VermogenCard = ({ items: externalItems, onItemsChange, onSummaryChange, readOnly = false }: VermogenCardProps) => {
  const [internalItems, setInternalItems] = useState<AssetItem[]>([]);
  const isReadOnly = readOnly === true;

  useEffect(() => {
    setInternalItems(externalItems ?? []);
  }, [externalItems]);

  const summary = useMemo(() => {
    const totalAssets = internalItems.reduce((sum, item) => sum + (Number.isFinite(item.bedrag) ? Math.max(0, item.bedrag) : 0), 0);
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
    sync([...internalItems, { id: createId(), naam: "", bedrag: 0 }]);
  };

  const updateItem = (id: string, patch: Partial<AssetItem>) => {
    if (isReadOnly) return;
    sync(internalItems.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    if (isReadOnly) return;
    if (!window.confirm("Weet je zeker dat je deze vermogenspost wilt verwijderen?")) return;
    sync(internalItems.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">Vermogenskaart</div>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm hover:shadow"
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

      {internalItems.map((item) => (
        <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-2">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 text-sm text-slate-800">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-600">Naam</span>
              <input
                type="text"
                className="rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                value={item.naam}
                onChange={(e) => updateItem(item.id, { naam: e.target.value })}
                placeholder="Bijv. noodbuffer"
                readOnly={isReadOnly}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-600">Bedrag (€)</span>
              <input
                type="number"
                min={0}
                step={0.01}
                className="rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                value={Number.isFinite(item.bedrag) ? item.bedrag : ""}
                onChange={(e) => updateItem(item.id, { bedrag: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                readOnly={isReadOnly}
              />
            </label>
          </div>
          <div className="flex justify-end">
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

      <div className="rounded-lg bg-white/80 p-3 text-sm text-slate-800 shadow-inner">
        <p>Totaal openstaand: {summary.totalAssets.toLocaleString("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2 })}</p>
        <p>Aantal posten: {summary.assetsCount}</p>
      </div>
    </div>
  );
};
