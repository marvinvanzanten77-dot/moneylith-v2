import { useLocalStorage } from "../hooks/useLocalStorage";

interface IncomeFixedCardProps {}

export function IncomeFixedCard({}: IncomeFixedCardProps) {
  const [netIncome, setNetIncome] = useLocalStorage<number>("income-netto", 0);
  const [fixedCosts, setFixedCosts] = useLocalStorage<number>("fixed-costs", 0);

  const safeIncome = isNaN(netIncome) ? 0 : netIncome;
  const safeFixed = isNaN(fixedCosts) ? 0 : fixedCosts;
  const freeBudget = safeIncome - safeFixed;

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Inkomen & vaste lasten</h2>
      <p className="text-xs text-slate-500">Gebruik dit als basis voor je maandelijkse ruimte.</p>

      <div className="mt-3 space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Netto inkomen per maand</label>
          <input
            type="number"
            className="mt-1 block w-full rounded-md border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            value={safeIncome || ""}
            onChange={(e) => setNetIncome(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Vaste lasten per maand</label>
          <input
            type="number"
            className="mt-1 block w-full rounded-md border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            value={safeFixed || ""}
            onChange={(e) => setFixedCosts(parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-600">
        <span className="font-semibold text-slate-800">Vrije ruimte na vaste lasten:</span> €{freeBudget.toFixed(0)}
      </p>
    </div>
  );
}
