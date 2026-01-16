import { useLocalStorage } from "../hooks/useLocalStorage";
import { numberInputValue, parseNumberInput } from "../utils/numberInput";

export function BufferCard() {
  const [bufferTarget, setBufferTarget] = useLocalStorage<number>("buffer-target", 0);
  const [bufferCurrent, setBufferCurrent] = useLocalStorage<number>("buffer-current", 0);

  const safeTarget = isNaN(bufferTarget) ? 0 : bufferTarget;
  const safeCurrent = isNaN(bufferCurrent) ? 0 : bufferCurrent;
  const remaining = safeTarget - safeCurrent;
  const clampedRemaining = remaining < 0 ? 0 : remaining;

  return (
    <div className="mt-6 card-shell p-5 text-slate-900">
      <h2 className="text-lg font-semibold">Buffer & spaardoel</h2>
      <p className="text-xs text-slate-600">Bouw je vangnet en zie hoe dichtbij je al bent.</p>

      <div className="mt-3 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700">Doelbedrag buffer</label>
          <input
            type="number"
            className="mt-1 block w-full rounded-lg border border-white/50 bg-white/80 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
            value={numberInputValue(safeTarget)}
            onChange={(e) => setBufferTarget(parseNumberInput(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700">Huidige buffer</label>
          <input
            type="number"
            className="mt-1 block w-full rounded-lg border border-white/50 bg-white/80 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
            value={numberInputValue(safeCurrent)}
            onChange={(e) => setBufferCurrent(parseNumberInput(e.target.value))}
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-600">
        Nog te sparen tot doel:{" "}
        <span className={clampedRemaining <= 0 ? "font-semibold text-emerald-700" : "font-semibold text-slate-800"}>
          €{clampedRemaining.toFixed(0)}
        </span>
      </p>
    </div>
  );
}
