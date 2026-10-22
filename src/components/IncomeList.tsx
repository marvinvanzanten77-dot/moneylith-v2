import { RecordReview } from "./RecordReview";
import { recordReview } from "../logic/inputReadiness";
import { ExpandableRecord, recordControlClass } from "./ExpandableRecord";
import { Button } from "./WorkspaceUI";
import { useEffect, useId, useRef, useState } from "react";

import { useLocalStorage } from "../hooks/useLocalStorage";
import { formatCurrency } from "../utils/format";
import { numberInputValue, parseNumberInput } from "../utils/numberInput";
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
  confirmed?: boolean;
}

const newId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
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
  confirmed = false,
}: IncomeListProps) {
  useId(); // reserved for potential aria relationships; avoid breaking existing structure
  const [localItems, setLocalItems] = useLocalStorage<IncomeItem[]>(
    storageKey ?? "moneylith.personal.incomeItems",
    [],
  );
  const items = controlledItems ?? localItems;
  const setItems = onItemsChange ?? setLocalItems;
  const isReadOnly = readOnly === true;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deductionMonth, setDeductionMonth] = useState(new Date().toISOString().slice(0,7));
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
    updateItems(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const addItem = () => {
    if (isReadOnly) return;
    const id = newId();
    const next = [
      ...items,
      { id, naam: "", bedrag: 0, amountEntered: false, opmerking: "" },
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
          <p className="text-sm text-slate-600">{heading ?? "Inkomen"}</p>
          <h3 className="text-lg font-semibold text-slate-900">
            {subheading ?? "Overzicht van je inkomsten"}
          </h3>
          <p className="text-xs text-slate-500">
            Vrije ruimte = inkomen - vaste lasten. Dit bedrag wordt in andere
            tabs gebruikt als startpunt.
          </p>
        </div>
        <Button type="button" onClick={addItem} disabled={isReadOnly}>
          {addLabel ?? "+ Nieuwe inkomstenstroom"}
        </Button>
      </div>

      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-slate-600">
            {emptyLabel ?? "Nog geen inkomsten toegevoegd."}
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
                        placeholder="Bijv. salaris"
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
                        step={1}
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
                    {item.bankEvidence && <label className="flex flex-col gap-1"><span><input type="checkbox" checked={item.followLatestBank === true} disabled={isReadOnly} onChange={e => updateItem(item.id,{followLatestBank:e.target.checked})} /> Volg het laatst opgehaalde inkomen</span><span className="text-xs">Bij synchroniseren wordt de laatste ontvangst van dezelfde gekoppelde inkomstenbron overgenomen. Laatst geregistreerd: {item.bankEvidence.through}.</span></label>}
                    <div className="space-y-2"><p className="font-semibold">Beslaglegging / inhouding werkgever</p><label className="block">Maand<input type="month" className={recordControlClass} value={deductionMonth} onChange={e => setDeductionMonth(e.target.value)} /></label><label className="block">Ingehouden bedrag (alleen administratie)<input type="number" min="0" step="0.01" className={recordControlClass} value={item.payrollDeductions?.[deductionMonth] ?? ""} placeholder="Nog niet ingevuld" readOnly={isReadOnly} onChange={e => updateItem(item.id,{payrollDeductions:{...item.payrollDeductions,[deductionMonth]:e.target.value === "" ? null : Math.max(0,Number(e.target.value))}})} /></label><p className="text-xs">Vul dit in vanaf je loonstrook, bijvoorbeeld op je salarisdag. Het ontvangen inkomen is al na inhouding. Dit veld verandert geen saldo, inkomen, schuld of prognose. Banksync kan dit bedrag niet vaststellen.</p></div>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-600">Verwachte ontvangstdag (optioneel, 1–31)</span>
                      <input type="number" min={1} max={31} className={recordControlClass} value={item.dagVanMaand ?? ""} readOnly={isReadOnly} onChange={e => {
                        const n = Number(e.target.value);
                        updateItem(item.id, {dagVanMaand:e.target.value && Number.isInteger(n) && n>=1 && n<=31 ? n : undefined});
                      }} />
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
          <span>{totalLabel ?? "Totaal inkomen"}</span>
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
                  items.reduce((sum, item) => sum + item.bedrag, 0),
                )
              : "Nog niet ingevuld"}
          </span>
        </div>
      </div>
    </div>
  );
}
