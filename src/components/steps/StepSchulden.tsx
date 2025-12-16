import React, { useMemo, useState } from "react";
import { SchuldenkaartCard, type SchuldItem } from "../SchuldenkaartCard";
import type { FinancialSnapshot } from "../../types";
import type { AiActions } from "../../logic/extractActions";
import { buildDebtsPatchesFromActions, canApplyDebtsSuggestions } from "../../logic/applyDebtsSuggestions";
import { useLocalStorage } from "../../hooks/useLocalStorage";

interface StepSchuldenProps {
  onDebtSummary: (s: { totalDebt: number; totalMinPayment: number; debtCount: number }) => void;
  financialSnapshot?: FinancialSnapshot | null;
  debtSummary?: { totalDebt: number; totalMinPayment: number; debtCount: number };
  debts?: SchuldItem[];
  onDebtsChange?: (items: SchuldItem[]) => void;
  variant?: "personal" | "business";
  readOnly?: boolean;
  mode?: "personal" | "business";
  actions?: AiActions | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value || 0);

export function StepSchulden({
  onDebtSummary,
  financialSnapshot,
  debtSummary,
  debts = [],
  onDebtsChange,
  variant = "personal",
  readOnly = false,
  mode = "personal",
  actions = null,
}: StepSchuldenProps) {
  const snapshot = financialSnapshot ?? null;
  const totalDebt = snapshot?.totalDebt ?? debtSummary?.totalDebt ?? debts.reduce((sum, d) => sum + (d.saldo || 0), 0);
  const totalMinPayment =
    snapshot?.monthlyPressure ?? debtSummary?.totalMinPayment ?? debts.reduce((sum, d) => sum + (d.minimaleMaandlast || 0), 0);
  const debtCount = debtSummary?.debtCount ?? debts.length;
  const netFree = snapshot?.netFree ?? 0;
  const monthsToClear = totalDebt > 0 && totalMinPayment > 0 ? Math.ceil(totalDebt / totalMinPayment) : null;
  const freeAfterDebt = netFree - totalMinPayment;
  const isReadOnly = readOnly === true;
  const storageKey = `moneylith.${variant}.debts.uploadStatus`;
  const pendingRowsKey = `moneylith.${variant}.debts.pendingRows`;
  const pendingNameKey = `moneylith.${variant}.debts.pendingFileName`;
  const [uploadStatus, setUploadStatus] = useLocalStorage<string | null>(storageKey, null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useLocalStorage<string | null>(pendingNameKey, null);
  const [pendingRows, setPendingRows] = useLocalStorage<SchuldItem[]>(pendingRowsKey, []);
  const applyCheck = canApplyDebtsSuggestions({ mode, actions, currentDebts: debts });

  const pressureLine =
    totalDebt > 0 && totalMinPayment > 0
      ? `Bij dit tempo: ${monthsToClear} maanden tot schuldenvrij`
      : "Nog geen realistisch aflostempo berekend";

  const psychologicalLine =
    totalDebt > 0 && totalMinPayment > 0
      ? `Bij dit tempo blijft deze schuld je nog ${monthsToClear ?? "?"} maanden volgen.`
      : totalMinPayment > 0
      ? `Elke maand gaat hier minimaal ${formatCurrency(totalMinPayment)} vast naar het verleden.`
      : "";

  const title = variant === "business" ? "Verplichtingen" : "Schulden";
  const subtitle =
    variant === "business"
      ? "Zakelijke schulden, contracten en regelingen die hoe dan ook betaald moeten worden."
      : "Zie in één oogopslag hoeveel druk je schulden zetten op je maand en waar de grootste knelpunten zitten.";

  const createId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

  const parseCsvDebts = (text: string): SchuldItem[] => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return [];
    const delimiter = lines[0].includes(";") && lines[0].split(";").length >= lines[0].split(",").length ? ";" : ",";
    const parseLine = (line: string) => line.split(delimiter).map((s) => s.trim());
    const headerCells = parseLine(lines[0]).map((h) => h.toLowerCase());
    const hasHeader = headerCells.some((h) => h.includes("naam") || h.includes("bedrag") || h.includes("maand"));
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const headers = hasHeader ? headerCells : [];

    const nameIdx = headers.findIndex(
      (h) => h.includes("naam") || h.includes("schuld") || h.includes("crediteur") || h.includes("beschrijving")
    );
    const amountIdx = headers.findIndex(
      (h) =>
        h.includes("saldo") ||
        h.includes("bedrag") ||
        h.includes("rest") ||
        h.includes("openstaand") ||
        h.includes("restbedrag")
    );
    const minIdx = headers.findIndex(
      (h) =>
        h.includes("maand") ||
        h.includes("termijn") ||
        h.includes("minim") ||
        h.includes("betaling") ||
        h.includes("aflossing")
    );

    const toNumber = (value: string) => {
      const normalized = value.replace(/[€\s]/g, "").replace(",", ".");
      const num = parseFloat(normalized);
      return Number.isFinite(num) ? num : 0;
    };

    return dataLines
      .map((line) => {
        const cells = parseLine(line);
        const get = (idx: number | undefined, fallbackIdx?: number) => {
          if (typeof idx === "number" && idx >= 0 && idx < cells.length) return cells[idx];
          if (typeof fallbackIdx === "number" && fallbackIdx >= 0 && fallbackIdx < cells.length) return cells[fallbackIdx];
          return "";
        };
        const naam = get(nameIdx >= 0 ? nameIdx : 0);
        const saldoRaw = get(amountIdx >= 0 ? amountIdx : 1);
        const maandRaw = get(minIdx >= 0 ? minIdx : 2);
        const saldo = toNumber(saldoRaw);
        const minimaleMaandlast = toNumber(maandRaw);
        if (!naam && saldo === 0 && minimaleMaandlast === 0) return null;
        return { id: createId(), naam: naam || "Schuld", saldo, minimaleMaandlast: minimaleMaandlast || undefined };
      })
      .filter(Boolean) as SchuldItem[];
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const file = event.target.files?.[0];
    if (file) {
      setUploadError(null);
      setPendingFileName(file.name);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = (ev.target?.result as string) ?? "";
        const parsed = parseCsvDebts(text);
        if (!parsed.length) {
          setPendingRows([]);
          setUploadStatus(null);
          setUploadError("Kon geen schulden uit dit bestand lezen. Gebruik kolommen: naam, bedrag, maandbedrag.");
          return;
        }
        setPendingRows(parsed);
        setUploadStatus(`Bestand geladen (${file.name}). Klik 'Bestand uploaden' om over te nemen.`);
      };
      reader.onerror = () => {
        setPendingRows([]);
        setUploadStatus(null);
        setUploadError("Lezen van het bestand is mislukt.");
      };
      reader.readAsText(file);
    }
  };

  const handleApplyUpload = () => {
    if (isReadOnly || pendingRows.length === 0) return;
    const merged = [...debts, ...pendingRows];
    onDebtsChange?.(merged);
    setPendingRows([]);
    setPendingFileName(null);
    setUploadError(null);
    setUploadStatus("Bestand verwerkt en schulden toegevoegd.");
  };

  const uploadButtonDisabled = useMemo(() => isReadOnly || pendingRows.length === 0, [isReadOnly, pendingRows.length]);

  const handleApplyAiDebts = () => {
    if (isReadOnly || !applyCheck.ok || !actions) return;
    const patches = buildDebtsPatchesFromActions(actions);
    if (!patches.length) return;
    onDebtsChange?.(patches);
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-50">{title}</h1>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 flex flex-col gap-4">
          <div className="card-shell p-5 text-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {variant === "business" ? "Je zakelijke verplichtingen" : "Je schulden"}
                </h2>
                <p className="text-sm text-slate-600">
                  {variant === "business"
                    ? "Overzicht van leningen, belastingregelingen, leases en andere vaste verplichtingen. Dit bepaalt je minimale maanddruk."
                    : "Breng al je schulden in kaart en zie meteen de impact."}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {applyCheck.ok && !isReadOnly && (
                  <button
                    type="button"
                    onClick={handleApplyAiDebts}
                    className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-400"
                  >
                    Neem AI-suggesties over
                  </button>
                )}
                <span className="text-xs text-slate-500">Totaal: {debtCount} stuks</span>
              </div>
            </div>
            <SchuldenkaartCard
              items={debts}
              onChange={(next) => {
                if (isReadOnly) return;
                (onDebtsChange ?? (() => {}))(next);
              }}
              onSummaryChange={onDebtSummary}
              variant={variant}
              readOnly={isReadOnly}
            />
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/60 p-4 text-sm text-slate-800">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Totaal schuld</span>
                  <span className="font-semibold">{formatCurrency(totalDebt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Maanddruk (minimaal)</span>
                  <span className="font-semibold">{formatCurrency(totalMinPayment)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Vrije ruimte na schulden</span>
                  <span className="font-semibold">{formatCurrency(freeAfterDebt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tijd tot nul bij huidig tempo</span>
                  <span className="font-semibold">
                    {monthsToClear ? `${monthsToClear} maanden` : "Nog geen realistisch aflostempo berekend"}
                  </span>
                </div>
              </div>
              {psychologicalLine ? <p className="mt-3 text-xs text-slate-600">{psychologicalLine}</p> : null}
            </div>
          </div>

          {variant === "personal" && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
              <h3 className="text-lg font-semibold text-slate-50">Bulk-upload schulden</h3>
              <p className="mt-1 text-xs text-slate-400">
                Upload een CSV (kolommen: naam, bedrag, maandbedrag). Klik daarna op "Bestand uploaden" om ze toe te voegen.
              </p>
              <div className="mt-3">
                <input
                  type="file"
                  accept=".csv"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-amber-500 file:px-3 file:py-2 file:font-semibold file:text-slate-900"
                  onChange={handleUpload}
                  disabled={isReadOnly}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyUpload}
                  disabled={uploadButtonDisabled}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 disabled:opacity-50"
                >
                  Bestand uploaden
                </button>
                {pendingFileName && (
                  <span className="text-[11px] text-slate-300">
                    {pendingFileName} ({pendingRows.length} regel{pendingRows.length === 1 ? "" : "s"})
                  </span>
                )}
              </div>
              {uploadStatus && <p className="mt-2 text-xs text-amber-200">{uploadStatus}</p>}
              {uploadError && <p className="mt-1 text-xs text-red-300">{uploadError}</p>}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-slate-50">
          <h2 className="text-lg font-semibold text-slate-50">Schulddruk op je maand</h2>
          <p className="mt-1 text-xs text-slate-400">Samenvatting van je totale schuld en minimale maandelijkse druk.</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Totaal schuld</span>
              <span className="font-semibold">{formatCurrency(totalDebt)}</span>
            </div>
            <div className="flex justify-between">
              <span>Maanddruk (minimaal)</span>
              <span className="font-semibold">{formatCurrency(totalMinPayment)}</span>
            </div>
            <div className="flex justify-between">
              <span>Vrije ruimte na schulden</span>
              <span className="font-semibold">{formatCurrency(freeAfterDebt)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tijd tot nul bij huidig tempo</span>
              <span className="font-semibold">
                {monthsToClear ? `${monthsToClear} maanden` : "Nog geen realistisch aflostempo berekend"}
              </span>
            </div>
          </div>
          {pressureLine ? <p className="mt-3 text-xs text-slate-400">{pressureLine}</p> : null}
        </div>
      </div>
    </div>
  );
}
