import { useLocalStorage } from "../hooks/useLocalStorage";

export function BufferCard() {
  const [bufferTarget, setBufferTarget] = useLocalStorage<number>("buffer-target", 0);
  const [bufferCurrent, setBufferCurrent] = useLocalStorage<number>("buffer-current", 0);

  const safeTarget = isNaN(bufferTarget) ? 0 : bufferTarget;
  const safeCurrent = isNaN(bufferCurrent) ? 0 : bufferCurrent;
  const remaining = safeTarget - safeCurrent;
  const clampedRemaining = remaining < 0 ? 0 : remaining;

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Buffer & spaardoel 2026</h2>
      <p className="text-xs text-slate-500">Hou bij hoeveel financiële buffer je al hebt opgebouwd.</p>

      <div className="mt-3 space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Doelbedrag buffer</label>
          <input
            type="number"
            className="mt-1 block w-full rounded-md border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            value={safeTarget || ""}
            onChange={(e) => setBufferTarget(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Huidige buffer</label>
          <input
            type="number"
            className="mt-1 block w-full rounded-md border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            value={safeCurrent || ""}
            onChange={(e) => setBufferCurrent(parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-600">
        Nog te sparen tot doel: {" "}
        <span className={clampedRemaining <= 0 ? "font-semibold text-emerald-700" : "font-semibold text-slate-800"}>
          €{clampedRemaining.toFixed(0)}
        </span>
      </p>
    </div>
  );
}
