import { RecordReview } from "./RecordReview";
import { recordReview } from "../logic/inputReadiness";
import { ExpandableRecord, recordControlClass } from "./ExpandableRecord";
import { useEffect, useRef, useState } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { FixedCostManualItem } from "../types";
import { formatCurrency } from "../utils/format";
import { numberInputValue, parseNumberInput } from "../utils/numberInput";

interface FixedCostsListProps {
  onSumChange?: (sum: number) => void;
  items?: FixedCostManualItem[];
  onItemsChange?: (items: FixedCostManualItem[]) => void;
  storageKey?: string;
  heading?: string;
  subheading?: string;
  addLabel?: string;
  emptyLabel?: string;
  totalLabel?: string;
  readOnly?: boolean;
  confirmed?: boolean;
}

const newId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return String(Date.now());
};

export function FixedCostsList({
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
  confirmed = false,
}: FixedCostsListProps) {
  const [localItems, setLocalItems] = useLocalStorage<FixedCostManualItem[]>(
    storageKey ?? "moneylith.personal.fixedCosts",
    [],
  );
  const items = controlledItems ?? localItems;
  const setItems = onItemsChange ?? setLocalItems;
  const isReadOnly = readOnly === true;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onSumChange?.(items.reduce((sum, item) => sum + (item.paymentRoute === "withheld" ? 0 : item.bedrag || 0), 0));
  }, [items, onSumChange]);

  const updateItems = (next: FixedCostManualItem[]) => {
    if (isReadOnly) return;
    setItems(next);
    onSumChange?.(next.reduce((sum, item) => sum + (item.paymentRoute === "withheld" ? 0 : item.bedrag || 0), 0));
  };

  const updateItem = (id: string, patch: Partial<FixedCostManualItem>) => {
    if (isReadOnly) return;
    updateItems(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const addItem = () => {
    if (isReadOnly) return;
    const id = newId();
    const next = [
      ...items,
      {
        id,
        naam: "",
        bedrag: 0,
        amountEntered: false,
        dagVanMaand: 0,
        opmerking: "",
      },
    ];
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

    document.addEventListener("click", handleClickAway);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClickAway);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [expandedId]);

  return (
    <div ref={listRef} className="card-shell space-y-3 p-4 text-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600">{heading ?? "Vaste lasten"}</p>
          <h3 className="text-lg font-semibold text-slate-900">
            {subheading ?? "Overzicht van je vaste lasten"}
          </h3>
          <p className="text-xs text-slate-500">
            Laat zien hoeveel % van je inkomen hierheen gaat. Lager is rustiger;
            hoger? Kijk of iets omlaag kan.
          </p>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-amber-400 hover:shadow"
          disabled={isReadOnly}
        >
          {addLabel ?? "+ Nieuwe vaste last"}
        </button>
      </div>

      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-slate-600">
            {emptyLabel ?? "Nog geen vaste lasten toegevoegd."}
          </p>
        )}
        {items.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <ExpandableRecord
              key={item.id}
              expanded={isExpanded}
              onToggle={() => toggleExpanded(item.id)}
              disabled={isReadOnly}
              title={item.naam?.trim() || "Naam"}
              summary={
                <span>
                  {item.amountEntered !== false &&
                  Number.isFinite(item.bedrag) &&
                  (item.bedrag !== 0 || item.amountEntered === true)
                    ? formatCurrency(item.bedrag)
                    : "Nog niet ingevuld"}
                  {item.paymentRoute === "withheld" && <span className="ml-2 text-xs">Al ingehouden op inkomen/toeslagen · geen extra afschrijving</span>}
                  {item.budgetCategory && <span className="ml-2 text-xs">Maandbudget · {item.budgetCategory}</span>}
                  {item.amountRange && <span className="ml-2 text-xs">Wisselend: {formatCurrency(item.amountRange.min, true)}–{formatCurrency(item.amountRange.max, true)}</span>}
                  {recordReview(item).ready && <span className="ml-2 text-xs text-emerald-700">Regel gecontroleerd</span>}
                  {item.bankEvidence && <span className="ml-2 text-xs text-slate-600">Uit bankgegevens · {confirmed ? "gecontroleerd" : "nog controleren"}</span>}
                </span>
              }
            >
              {isExpanded && (
                <div className="border-t border-amber-100 px-3 py-3 text-sm text-slate-800">
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-600">
                        Naam
                      </span>
                      <input
                        type="text"
                        className={recordControlClass}
                        value={item.naam}
                        onChange={(e) =>
                          updateItem(item.id, { naam: e.target.value })
                        }
                        placeholder="Bijv. huur"
                        readOnly={isReadOnly}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-600">
                        Bedrag
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className={recordControlClass}
                        value={
                          item.amountEntered === false
                            ? ""
                            : item.amountEntered === true
                              ? item.bedrag
                              : (numberInputValue(item.bedrag) ?? "")
                        }
                        onChange={(e) =>
                          updateItem(item.id, {
                            bedrag: parseNumberInput(e.target.value),
                            amountEntered: e.target.value.trim() !== "",
                          })
                        }
                        placeholder="Bedrag invullen"
                        readOnly={isReadOnly}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-600">
                        Dag van incasso
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className={recordControlClass}
                        value={
                          Number.isFinite(item.dagVanMaand) && item.dagVanMaand > 0
                            ? item.dagVanMaand
                            : ""
                        }
                        onChange={(e) =>
                          updateItem(item.id, {
                            dagVanMaand: parseInt(e.target.value) || 0,
                          })
                        }
                        placeholder="1-31 (kies incassodag)"
                        readOnly={isReadOnly}
                      />
                      <span className="text-[11px] text-slate-500">
                        Tip: dag waarop dit normaal wordt afgeschreven.
                      </span>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-600">
                        Opmerking
                      </span>
                      <input
                        type="text"
                        className={recordControlClass}
                        value={item.opmerking ?? ""}
                        onChange={(e) =>
                          updateItem(item.id, { opmerking: e.target.value })
                        }
                        placeholder="optioneel"
                        readOnly={isReadOnly}
                      />
                    </label>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="min-w-0">Betaalwijze<select aria-label="Betaalwijze" className={recordControlClass + " block w-full min-w-0"} value={item.paymentRoute ?? "bank"} disabled={isReadOnly} onChange={e => updateItem(item.id, {paymentRoute:e.target.value as FixedCostManualItem["paymentRoute"]})}>
                      <option value="bank">Vanaf een bankrekening</option><option value="card">Via creditcard / bunq</option><option value="third-party">Via iemand anders</option><option value="withheld">Al ingehouden op ontvangen inkomen / toeslagen</option>
                    </select></label>
                    <label><input type="checkbox" checked={!!item.amountRange} disabled={isReadOnly} onChange={e => updateItem(item.id,{amountRange:e.target.checked ? {min:0,max:0}:undefined})} /> Bedrag wisselt per maand</label>
                    {item.amountRange && <>{(["min","max"] as const).map(key => <label key={key}>{key === "min" ? "Minimum" : "Maximum"}<input className={recordControlClass} type="number" min="0" step="0.01" value={item.amountRange![key]} onChange={e => updateItem(item.id,{amountRange:{...item.amountRange!,[key]:Math.max(0,Number(e.target.value))}})} /></label>)}<p className="text-xs sm:col-span-2">Vul bij Bedrag zelf het verwachte maandbedrag in. De bandbreedte is informatie en wordt niet automatisch gemiddeld.</p></>}
                    {item.budgetCategory && <p className="text-xs sm:col-span-2">Dit budget telt eenmaal mee in je vaste maandruimte. Patronen toont alleen het bedrag boven dit budget, vanaf {item.budgetSince || "de ingestelde maand"}. Pas hier het budget aan; verwijder deze last om weer alle aankopen te tonen.</p>}
                    {item.paymentRoute === "withheld" && <p className="text-xs sm:col-span-2">Registreer het bedrag voor je overzicht. Het ontvangen inkomen moet al na deze inhouding zijn; deze last wordt daarom niet opnieuw van je beschikbare geld afgetrokken.</p>}
                  </div>
                  <RecordReview item={item} disabled={isReadOnly} onReview={reviewedInput => updateItem(item.id, {reviewedInput})} />
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
            </ExpandableRecord>
          );
        })}
      </div>

      <div className="rounded-lg bg-white/80 p-3 text-sm text-slate-800 shadow-inner">
        <div className="flex items-center justify-between">
          <span>{totalLabel ?? "Nog te betalen vaste lasten en budgetten"}</span>
          <span className="font-semibold">
            {confirmed ||
            (items.length > 0 &&
              items.every(
                (item) =>
                  item.amountEntered !== false &&
                  Number.isFinite(item.bedrag) &&
                  (item.bedrag !== 0 || item.amountEntered === true),
              ))
              ? formatCurrency(
                  items.reduce((sum, item) => sum + (item.paymentRoute === "withheld" ? 0 : item.bedrag), 0),
                )
              : "Nog niet ingevuld"}
          </span>
        </div>
      </div>
    </div>
  );
}
