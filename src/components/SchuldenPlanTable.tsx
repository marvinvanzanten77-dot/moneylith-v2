import { SCHULDENPLAN } from "../data/schuldenplan";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { MonthId, SchuldenPlanItem, SchuldItem } from "../types";
import { DebtOverTimeChart } from "./charts/DebtOverTimeChart";

type Props = {
  selectedMonth: MonthId;
};

const currency = (value: number) => `€${value}`;

const readSchuldenLijst = (): SchuldItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("schulden-lijst");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as SchuldItem[];
    return [];
  } catch {
    return [];
  }
};

const SchuldenPlanTable = ({ selectedMonth }: Props) => {
  const schuldenLijst = readSchuldenLijst();

  const itemsWithState = SCHULDENPLAN.map((item) => {
    const [done, setDone] = useLocalStorage<boolean>(`schuldenplan-${item.month}`, false);
    const [paidAmount, setPaidAmount] = useLocalStorage<number>(
      `schuldenplan-paid-${item.month}`,
      0
    );
    const [linkedDebt, setLinkedDebt] = useLocalStorage<string | "">(
      `schuldenplan-debt-${item.month}`,
      ""
    );
    const safePaid = isNaN(paidAmount) ? 0 : paidAmount;
    return { item, done, setDone, paidAmount: safePaid, setPaidAmount, linkedDebt, setLinkedDebt };
  });

  const totals = itemsWithState.reduce(
    (acc, entry) => {
      acc.total += entry.item.doelBedrag;
      acc.sumPaid += entry.paidAmount;
      if (entry.done) {
        acc.doneAmount += entry.item.doelBedrag;
        acc.doneCount += 1;
      }
      return acc;
    },
    { total: 0, doneAmount: 0, doneCount: 0, sumPaid: 0 }
  );

  const sumPlanned = itemsWithState.reduce((acc, entry) => acc + entry.item.doelBedrag, 0);
  const sumPaid = itemsWithState.reduce((acc, entry) => acc + entry.paidAmount, 0);

  const chartData = itemsWithState.map(({ item, paidAmount }) => ({
    maand: item.labelMaand,
    doel: item.doelBedrag,
    betaald: paidAmount,
  }));

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-white">Aflospad per maand</h2>
        <p className="text-xs text-slate-200/80">
          Kies per maand welke schuld aandacht krijgt en welk bedrag je wilt halen.
        </p>
      </div>

      <div className="card-shell p-5 text-slate-900">
        <p className="mb-3 text-xs text-slate-700">
          {totals.doneCount} van {SCHULDENPLAN.length} maanden ingevuld · Doel totaal: {currency(totals.total)} · Afgerond: {currency(totals.doneAmount)} · Echt betaald: {currency(totals.sumPaid)}
        </p>

        <div className="mb-4">
          <DebtOverTimeChart data={chartData} />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-auto text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Maand</th>
                <th className="px-3 py-2 text-left font-semibold">Focusschuld</th>
                <th className="px-3 py-2 text-left font-semibold">Doel</th>
                <th className="px-3 py-2 text-left font-semibold">Beschrijving</th>
                <th className="px-3 py-2 text-right font-semibold">Betaald (€)</th>
                <th className="px-3 py-2 text-center font-semibold">Gedaan</th>
              </tr>
            </thead>
            <tbody>
              {itemsWithState.map(
                ({ item, done, setDone, paidAmount, setPaidAmount, linkedDebt, setLinkedDebt }: { item: SchuldenPlanItem; done: boolean; setDone: (value: boolean) => void; paidAmount: number; setPaidAmount: (value: number) => void; linkedDebt: string | ""; setLinkedDebt: (value: string | "") => void }) => {
                  const debtLabel = schuldenLijst.find((d) => d.id === linkedDebt)?.naam || "";
                  const focusText = debtLabel || item.focusSchuld || "Kies een schuld als focus";
                  return (
                    <tr
                      key={item.id}
                      className={`border-b last:border-b-0 ${
                        item.month === selectedMonth ? "bg-indigo-50/70" : ""
                      }`}
                    >
                      <td className="px-3 py-2 align-top font-medium text-slate-900">{item.labelMaand}</td>
                      <td className="px-3 py-2 align-top text-slate-900 space-y-1">
                        <div className="text-xs font-semibold text-slate-900">{focusText}</div>
                        <select
                          className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          value={linkedDebt}
                          onChange={(e) => setLinkedDebt(e.target.value)}
                        >
                          <option value="">Koppel een schuld</option>
                          {schuldenLijst.map((schuld) => (
                            <option key={schuld.id} value={schuld.id}>
                              {schuld.naam || "(naamloos)"}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 align-top text-slate-900">{currency(item.doelBedrag)}</td>
                      <td className="px-3 py-2 align-top text-slate-700">{item.beschrijving}</td>
                      <td className="px-3 py-2 align-top text-right">
                        <input
                          type="number"
                          className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          value={paidAmount || ""}
                          onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-3 py-2 align-top text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-400 text-indigo-600 focus:ring-indigo-500"
                          checked={done}
                          onChange={(event) => setDone(event.target.checked)}
                        />
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold text-slate-800">
                <td className="px-3 py-2">Totaal</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-slate-900">{currency(sumPlanned)}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right text-slate-900">{currency(sumPaid)}</td>
                <td className="px-3 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
};

export default SchuldenPlanTable;

