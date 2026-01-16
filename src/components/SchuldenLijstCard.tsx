import { useLocalStorage } from "../hooks/useLocalStorage";
import { numberInputValue, parseNumberInput } from "../utils/numberInput";
import type { SchuldItem } from "../types";

const newId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now());
};

export function SchuldenLijstCard() {
  const [schulden, setSchulden] = useLocalStorage<SchuldItem[]>("schulden-lijst", []);

  const addSchuld = () => {
    const id = newId();
    setSchulden((prev) => [
      ...prev,
      {
        id,
        naam: "",
        crediteur: "",
        openBedrag: 0,
        minBetaling: 0,
        prioriteit: 0,
        notitie: "",
      },
    ]);
  };

  const updateSchuld = (id: string, partial: Partial<SchuldItem>) => {
    setSchulden((prev) => prev.map((s) => (s.id === id ? { ...s, ...partial } : s)));
  };

  const removeSchuld = (id: string) => {
    setSchulden((prev) => prev.filter((s) => s.id !== id));
  };

  const totaalOpen = schulden.reduce((sum, s) => sum + (isNaN(s.openBedrag) ? 0 : s.openBedrag), 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Schuldenkaart</h2>
      <p className="text-xs text-slate-500">Wat staat er open en wat verdient als eerste aandacht.</p>

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full table-auto text-xs">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Naam</th>
              <th className="px-3 py-2 text-left font-semibold">Crediteur</th>
              <th className="px-3 py-2 text-right font-semibold">Open bedrag (€)</th>
              <th className="px-3 py-2 text-right font-semibold">Min. betaling (€)</th>
              <th className="px-3 py-2 text-center font-semibold">Prioriteit</th>
              <th className="px-3 py-2 text-left font-semibold">Notitie</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {schulden.map((schuld) => (
              <tr key={schuld.id} className="border-b last:border-b-0">
                <td className="px-3 py-2 align-top">
                  <input
                    type="text"
                    className="w-full rounded-md border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={schuld.naam}
                    onChange={(e) => updateSchuld(schuld.id, { naam: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <input
                    type="text"
                    className="w-full rounded-md border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={schuld.crediteur ?? ""}
                    onChange={(e) => updateSchuld(schuld.id, { crediteur: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 align-top text-right">
                  <input
                    type="number"
                    className="w-24 rounded-md border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-right"
                    value={numberInputValue(schuld.openBedrag)}
                    onChange={(e) => updateSchuld(schuld.id, { openBedrag: parseNumberInput(e.target.value) })}
                  />
                </td>
                <td className="px-3 py-2 align-top text-right">
                  <input
                    type="number"
                    className="w-24 rounded-md border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-right"
                    value={numberInputValue(schuld.minBetaling ?? 0)}
                    onChange={(e) => updateSchuld(schuld.id, { minBetaling: parseNumberInput(e.target.value) })}
                  />
                </td>
                <td className="px-3 py-2 align-top text-center">
                  <input
                    type="number"
                    className="w-16 rounded-md border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-center"
                    value={schuld.prioriteit ?? ""}
                    onChange={(e) => updateSchuld(schuld.id, { prioriteit: parseInt(e.target.value) || 0 })}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <textarea
                    className="w-full rounded-md border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    rows={2}
                    value={schuld.notitie ?? ""}
                    onChange={(e) => updateSchuld(schuld.id, { notitie: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <button
                    type="button"
                    onClick={() => removeSchuld(schuld.id)}
                    className="text-[11px] text-red-600 hover:underline"
                  >
                    Verwijderen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold text-slate-800">
              <td className="px-3 py-2" colSpan={2}>
                Subtotaal
              </td>
              <td className="px-3 py-2 text-right">€{totaalOpen.toFixed(0)}</td>
              <td className="px-3 py-2" colSpan={4}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <button
        type="button"
        onClick={addSchuld}
        className="mt-3 inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
      >
        + Nieuwe schuld
      </button>
    </div>
  );
}
