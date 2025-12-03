import { useId } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { FixedCostItem } from "../types";

const newId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return String(Date.now());
};

export function FixedCostsList() {
  const tableId = useId();
  const [items, setItems] = useLocalStorage<FixedCostItem[]>("fixed-costs-list", []);

  const totalFixed = items.reduce(
    (sum, item) => sum + (isNaN(item.bedrag) ? 0 : item.bedrag),
    0
  );

  const updateItem = (id: string, partial: Partial<FixedCostItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...partial } : it)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const addItem = () => {
    const id = newId();
    setItems((prev) => [
      ...prev,
      { id, naam: "", bedrag: 0, dagVanMaand: 1, opmerking: "" },
    ]);
  };

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Vaste lasten – specificatie</h2>
      <p className="text-xs text-slate-500">
        Overzicht van welke lasten wanneer afgeschreven worden. Gebruik de som eventueel voor je vaste-lasten veld.
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Totaal vaste lasten volgens overzicht: <span className="font-semibold">€{totalFixed.toFixed(0)}</span>
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full table-auto text-xs" aria-labelledby={tableId}>
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Naam</th>
              <th className="px-3 py-2 text-right font-semibold">Bedrag (€)</th>
              <th className="px-3 py-2 text-center font-semibold">Dag</th>
              <th className="px-3 py-2 text-left font-semibold">Opmerking</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b last:border-b-0">
                <td className="px-3 py-2 align-top">
                  <input
                    type="text"
                    className="w-full rounded-md border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={item.naam}
                    onChange={(e) => updateItem(item.id, { naam: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 align-top text-right">
                  <input
                    type="number"
                    className="w-24 rounded-md border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-right"
                    value={isNaN(item.bedrag) ? "" : item.bedrag}
                    onChange={(e) =>
                      updateItem(item.id, { bedrag: parseFloat(e.target.value) || 0 })
                    }
                  />
                </td>
                <td className="px-3 py-2 align-top text-center">
                  <input
                    type="number"
                    min={1}
                    max={31}
                    className="w-16 rounded-md border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-center"
                    value={item.dagVanMaand || ""}
                    onChange={(e) =>
                      updateItem(item.id, { dagVanMaand: parseInt(e.target.value) || 1 })
                    }
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <input
                    type="text"
                    className="w-full rounded-md border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={item.opmerking ?? ""}
                    onChange={(e) => updateItem(item.id, { opmerking: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-[11px] text-red-600 hover:underline"
                  >
                    Verwijderen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addItem}
        className="mt-3 inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
      >
        + Nieuwe vaste last
      </button>
    </div>
  );
}
