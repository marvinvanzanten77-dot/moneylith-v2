import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "../utils/format";
import { numberInputValue, parseNumberInput } from "../utils/numberInput";
import { parseDateNlToIso } from "../utils/date";

type SchuldenSummary = {
  totalDebt: number;
  totalMinPayment: number;
  debtCount: number;
};

export type SchuldItem = {
  id: string;
  naam: string;
  saldo: number;
  minimaleMaandlast?: number;
  afschrijfDag?: number;
  gebruikerOpmerking?: string;
  aiOpmerking?: string;
};

type SchuldenkaartCardProps = {
  items: SchuldItem[];
  onChange: (items: SchuldItem[]) => void;
  onSummaryChange?: (summary: SchuldenSummary) => void;
  variant?: "personal" | "business";
  readOnly?: boolean;
  reorderEnabled?: boolean;
  onReorder?: (sourceId: string, targetId: string) => void;
  proposals?: Record<
    string,
    {
      minPayment: number;
      monthsToClear: number | null;
      note: string;
      strategyKey?: string;
      month?: number;
      monthLabel?: string;
    }
  >;
  acceptedIds?: Set<string>;
  onAcceptProposal?: (id: string) => void;
  onRejectProposal?: (id: string) => void;
};

const createId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

export const SchuldenkaartCard = ({
  items,
  onChange,
  onSummaryChange,
  variant = "personal",
  readOnly = false,
  reorderEnabled = false,
  onReorder,
  proposals = {},
  acceptedIds = new Set<string>(),
  onAcceptProposal,
  onRejectProposal,
}: SchuldenkaartCardProps) => {
  const isReadOnly = readOnly === true;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const totalDebt = items.reduce((sum, item) => sum + (Number.isFinite(item.saldo) ? Math.max(0, item.saldo) : 0), 0);
    const totalMinPayment = items.reduce(
      (sum, item) =>
        sum + (Number.isFinite(item.minimaleMaandlast ?? NaN) ? Math.max(0, item.minimaleMaandlast ?? 0) : 0),
      0,
    );
    onSummaryChange?.({ totalDebt, totalMinPayment, debtCount: items.length });
  }, [items, onSummaryChange]);

  const addItem = () => {
    if (isReadOnly) return;
    const id = createId();
    onChange([...items, { id, naam: "", saldo: 0, minimaleMaandlast: undefined }]);
    setExpandedId(id);
  };

  const updateItem = (id: string, partial: Partial<SchuldItem>) => {
    if (isReadOnly) return;
    onChange(items.map((item) => (item.id === id ? { ...item, ...partial } : item)));
  };

  const removeItem = (id: string) => {
    if (isReadOnly) return;
    const ok = window.confirm("Weet je zeker dat je deze verplichting wilt verwijderen?");
    if (!ok) return;
    onChange(items.filter((item) => item.id !== id));
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

  const totalSaldo = items.reduce((sum, item) => sum + (Number.isFinite(item.saldo) ? Math.max(0, item.saldo) : 0), 0);
  const totalMinLasten = items.reduce(
    (sum, item) => sum + (Number.isFinite(item.minimaleMaandlast ?? NaN) ? Math.max(0, item.minimaleMaandlast ?? 0) : 0),
    0,
  );

  const restbedragLabel = variant === "business" ? "Restbedrag (EUR)" : "Openstaand bedrag (EUR)";
  const maandLabel = variant === "business" ? "Maandelijkse betaling" : "Maanddruk (minimaal)";

  return (
    <div ref={listRef} className="card-shell p-3 text-slate-900 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-600">{variant === "business" ? "Verplichtingenkaart" : "Schuldenkaart"}</p>
          <h3 className="text-base font-semibold text-slate-900">
            {variant === "business" ? "Overzicht van je verplichtingen" : "Overzicht van je schulden"}
          </h3>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-amber-400 hover:shadow"
          disabled={isReadOnly}
        >
          {variant === "business" ? "+ Nieuwe verplichting" : "+ Nieuwe schuld"}
        </button>
      </div>

      <div className="space-y-2">
        {items.length === 0 && (
          <p className="rounded-lg border border-slate-300 bg-white/80 p-3 text-sm text-slate-600">
            {variant === "business" ? "Nog geen zakelijke verplichtingen toegevoegd." : "Nog geen schulden toegevoegd."}
          </p>
        )}
        {items.map((item) => {
          const proposal = proposals?.[item.id];
          const isExpanded = expandedId === item.id;
          const isAccepted = acceptedIds.has(item.id);
          return (
            <div
              key={item.id}
              className={`rounded-xl border bg-white shadow-sm transition-all duration-200 ${
                isExpanded ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200 hover:border-amber-200"
              }`}
              draggable={reorderEnabled}
              onDragStart={(event) => {
                if (!reorderEnabled) return;
                event.dataTransfer.setData("text/plain", item.id);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => {
                if (!reorderEnabled) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                if (!reorderEnabled) return;
                event.preventDefault();
                const sourceId = event.dataTransfer.getData("text/plain");
                if (!sourceId || sourceId === item.id) return;
                onReorder?.(sourceId, item.id);
              }}
            >
              <button
                type="button"
                onClick={() => toggleExpanded(item.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                  isExpanded ? "bg-amber-50" : "hover:bg-slate-50"
                }`}
                disabled={isReadOnly}
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-900">{item.naam?.trim() || "Naam"}</span>
                  {proposal?.strategyKey && (
                    <span className="text-[11px] font-semibold text-amber-700">
                      {proposal.strategyKey.toUpperCase()} -{" "}
                      {proposal.strategyKey === "fullpay" && proposal.monthLabel
                        ? `${proposal.monthLabel} - `
                        : proposal.strategyKey === "fullpay" && proposal.month
                        ? `Maand ${proposal.month} - `
                        : ""}
                      {formatCurrency(proposal.minPayment)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 font-semibold text-slate-800">
                  <span>{formatCurrency(Number.isFinite(item.saldo) ? Math.max(0, item.saldo) : 0)}</span>
                  <span className="text-xs text-slate-500" aria-hidden>
                    {isExpanded ? "v" : ">"}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-amber-100 px-3 py-3 text-xs text-slate-800 space-y-2">
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-slate-600">Naam</span>
                      <input
                        type="text"
                        className="rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        value={item.naam}
                        onChange={(e) => updateItem(item.id, { naam: e.target.value })}
                        placeholder={variant === "business" ? "Factuur/Verplichting" : "Schuldnaam"}
                        readOnly={isReadOnly}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-slate-600">{restbedragLabel}</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        value={numberInputValue(item.saldo)}
                        onChange={(e) => updateItem(item.id, { saldo: parseNumberInput(e.target.value) })}
                        placeholder="0"
                        readOnly={isReadOnly}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-slate-600">{maandLabel}</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        value={numberInputValue(item.minimaleMaandlast)}
                        onChange={(e) => updateItem(item.id, { minimaleMaandlast: parseNumberInput(e.target.value) })}
                        placeholder="0"
                        readOnly={isReadOnly}
                      />
                    </label>
                    {proposal?.strategyKey === "fullpay" && proposal.month ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-slate-600">Maand (fullpay voorstel)</span>
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-sm font-semibold text-amber-800">
                          {proposal.monthLabel ?? `Maand ${proposal.month}`}
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-slate-600">Aflosdag (bijv. 15 of 15-01-2024)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                          value={item.afschrijfDag ? item.afschrijfDag.toString() : ""}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            if (val.includes("-")) {
                              const iso = parseDateNlToIso(val);
                              if (iso) {
                                const day = new Date(iso).getDate();
                                updateItem(item.id, { afschrijfDag: day });
                                return;
                              }
                            }
                            updateItem(item.id, { afschrijfDag: parseInt(val) || undefined });
                          }}
                          placeholder="Dag 1-31"
                          readOnly={isReadOnly}
                        />
                      </label>
                    )}
                    <label className="flex flex-col gap-1 md:col-span-2">
                      <span className="text-[11px] font-semibold text-slate-600">Opmerking</span>
                      <textarea
                        className="rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        value={item.gebruikerOpmerking ?? ""}
                        onChange={(e) => updateItem(item.id, { gebruikerOpmerking: e.target.value })}
                        placeholder="Notities of details over deze schuld"
                        readOnly={isReadOnly}
                        rows={2}
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
                        {variant === "business" ? "Verplichting" : "Schuld"}
                      </span>
                      {proposal && (
                        <>
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 font-semibold">
                            AI voorstel: {proposal.strategyKey ?? "strategie"}
                          </span>
                          {proposal.strategyKey === "fullpay" && proposal.month && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 font-semibold">
                            {proposal.monthLabel ?? `Maand ${proposal.month}`}
                          </span>
                          )}
                          {proposal.monthsToClear !== null && (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 font-semibold">
                              {proposal.monthsToClear} mnd
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {proposal && !isAccepted && (
                        <>
                          <button
                            type="button"
                            onClick={() => onAcceptProposal?.(item.id)}
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 hover:bg-emerald-100"
                            disabled={isReadOnly}
                          >
                            Accepteren
                          </button>
                          <button
                            type="button"
                            onClick={() => onRejectProposal?.(item.id)}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                            disabled={isReadOnly}
                          >
                            Afwijzen
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-[11px] font-semibold text-red-600 hover:underline"
                        disabled={isReadOnly}
                      >
                        Verwijderen
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg bg-white/80 p-3 text-xs text-slate-800 shadow-inner">
        <div className="flex items-center justify-between">
          <span>Totaal openstaand</span>
          <span className="font-semibold">{formatCurrency(totalSaldo)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span>Totaal minimale maandlast</span>
          <span className="font-semibold">{formatCurrency(totalMinLasten)}</span>
        </div>
      </div>
    </div>
  );
};











