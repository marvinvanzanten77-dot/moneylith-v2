import { useEffect } from "react";

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
  proposals?: Record<
    string,
    {
      minPayment: number;
      monthsToClear: number | null;
      note: string;
      strategyKey?: string;
    }
  >;
  onAcceptProposal?: (id: string) => void;
  onRejectProposal?: (id: string) => void;
};

const createId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

export const SchuldenkaartCard = ({
  items,
  onChange,
  onSummaryChange,
  variant = "personal",
  readOnly = false,
  proposals,
  onAcceptProposal,
  onRejectProposal,
}: SchuldenkaartCardProps) => {
  const isReadOnly = readOnly === true;

  useEffect(() => {
    const totalDebt = items.reduce((sum, item) => sum + (Number.isFinite(item.saldo) ? Math.max(0, item.saldo) : 0), 0);
    const totalMinPayment = items.reduce(
      (sum, item) => sum + (Number.isFinite(item.minimaleMaandlast ?? NaN) ? Math.max(0, item.minimaleMaandlast ?? 0) : 0),
      0
    );
    onSummaryChange?.({ totalDebt, totalMinPayment, debtCount: items.length });
  }, [items, onSummaryChange]);

  const addItem = () => {
    if (isReadOnly) return;
    onChange([...items, { id: createId(), naam: "", saldo: 0, minimaleMaandlast: undefined }]);
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
  };

  const totalSaldo = items.reduce((sum, item) => sum + (Number.isFinite(item.saldo) ? Math.max(0, item.saldo) : 0), 0);
  const totalMinLasten = items.reduce(
    (sum, item) => sum + (Number.isFinite(item.minimaleMaandlast ?? NaN) ? Math.max(0, item.minimaleMaandlast ?? 0) : 0),
    0
  );

  const restbedragLabel = variant === "business" ? "Restbedrag (€)" : "Openstaand bedrag (€)";
  const maandLabel = variant === "business" ? "Maandelijkse betaling" : "Maanddruk (minimaal)";

  return (
    <div className="card-shell p-3 text-slate-900 space-y-2">
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
          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm hover:shadow"
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
          const proposalColors =
            proposal?.strategyKey === "avalanche"
              ? {
                  border: "border-indigo-200",
                  bg: "bg-indigo-50",
                  badge: "bg-indigo-200 text-indigo-900",
                  reject: "border-indigo-200 text-indigo-900",
                }
              : proposal?.strategyKey === "balanced"
              ? {
                  border: "border-emerald-200",
                  bg: "bg-emerald-50",
                  badge: "bg-emerald-200 text-emerald-900",
                  reject: "border-emerald-300 text-emerald-900",
                }
              : {
                  border: "border-amber-200",
                  bg: "bg-amber-50",
                  badge: "bg-amber-200 text-amber-900",
                  reject: "border-amber-300 text-amber-900",
                };
          return (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm space-y-2">
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 text-xs text-slate-800">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-600">Naam</span>
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-2 py-1 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  value={item.naam}
                  onChange={(e) => updateItem(item.id, { naam: e.target.value })}
                  placeholder={variant === "business" ? "Bijv. zakelijke lening ING, BTW-regeling" : "Bijv. DUO"}
                  readOnly={isReadOnly}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-600">{restbedragLabel}</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="rounded-md border border-slate-300 px-2 py-1 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  value={Number.isFinite(item.saldo) ? item.saldo : ""}
                  onChange={(e) => updateItem(item.id, { saldo: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  readOnly={isReadOnly}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-600">{maandLabel}</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="rounded-md border border-slate-300 px-2 py-1 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  value={Number.isFinite(item.minimaleMaandlast ?? NaN) ? item.minimaleMaandlast : ""}
                  onChange={(e) =>
                    updateItem(item.id, {
                      minimaleMaandlast: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="optioneel"
                  readOnly={isReadOnly}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-600">Afschrijvingsdag (0-31)</span>
                <input
                  type="number"
                  min={0}
                  max={31}
                  className="rounded-md border border-slate-300 px-2 py-1 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  value={Number.isFinite(item.afschrijfDag ?? NaN) ? item.afschrijfDag : ""}
                  onChange={(e) =>
                    updateItem(item.id, {
                      afschrijfDag:
                        e.target.value === ""
                          ? undefined
                          : Math.max(0, Math.min(31, parseInt(e.target.value, 10) || 0)),
                    })
                  }
                  placeholder="0 = geen vaste dag"
                  readOnly={isReadOnly}
                />
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-[11px] font-semibold text-slate-600">Opmerking (gebruiker)</span>
                <textarea
                  className="rounded-md border border-slate-300 px-2 py-1 shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  value={item.gebruikerOpmerking ?? ""}
                  onChange={(e) => updateItem(item.id, { gebruikerOpmerking: e.target.value })}
                  placeholder="Eigen notitie of context"
                  readOnly={isReadOnly}
                  rows={2}
                />
              </label>
              {item.aiOpmerking && (
                <div className="md:col-span-2 rounded-md bg-slate-50 border border-purple-100 p-2 text-[11px] text-slate-700">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-purple-600">AI opmerking</div>
                  <div className="whitespace-pre-line">{item.aiOpmerking}</div>
                </div>
              )}
              {proposal && !isReadOnly && (
                <div className={`md:col-span-2 rounded-md border ${proposalColors.border} ${proposalColors.bg} p-2 text-[11px] text-slate-900 space-y-1`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      AI voorstel {proposal.strategyKey ? `(${proposal.strategyKey})` : ""}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${proposalColors.badge}`}>
                      {formatCurrency(proposal.minPayment)}
                    </span>
                  </div>
                  <div>
                    Bij dit tempo is deze schuld ongeveer{" "}
                    {proposal.monthsToClear ? `${proposal.monthsToClear} maanden` : "onbekend aantal maanden"} aanwezig.
                  </div>
                  <div className="text-slate-800">{proposal.note}</div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onAcceptProposal?.(item.id)}
                      className="rounded-md bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-emerald-950 hover:bg-emerald-400"
                    >
                      Accepteer
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectProposal?.(item.id)}
                      className={`rounded-md border px-3 py-1 text-[11px] font-semibold hover:bg-white/60 ${proposalColors.reject}`}
                    >
                      Verberg
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end">
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
        );})}
      </div>

      <div className="rounded-lg bg-white/80 p-2.5 text-xs text-slate-800 shadow-inner">
        <p>Totaal openstaand: {formatCurrency(totalSaldo)}</p>
        <p>Aantal schulden: {items.length}</p>
        <p>Som maanddruk (minimaal): {formatCurrency(totalMinLasten)}</p>
      </div>
    </div>
  );
};
