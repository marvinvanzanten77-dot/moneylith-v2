import { useState, useMemo } from "react";
import type { FinancialSnapshot } from "../../types";
import { AiAnalyzeButton } from "../AiAnalyzeButton";

interface RitmeProps {
  financialSnapshot?: FinancialSnapshot | null;
  variant?: "personal" | "business";
  businessMode?: "cashflow" | "risk";
  readOnly?: boolean;
  mode?: "personal" | "business";
  aiAnalysisDone?: boolean;
  onRunFullAi?: () => void;
  onBucketsRefresh?: () => void;
  spendBuckets: {
    id: string;
    name: string;
    monthlyAverage: number;
    lastMonthTotal?: number;
    shareOfFree?: number;
    description?: string;
    isEssential?: boolean;
  }[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value || 0);

export function StepRitme({
  financialSnapshot,
  spendBuckets = [],
  variant = "personal",
  businessMode = "cashflow",
  readOnly = false,
  mode = "personal",
  aiAnalysisDone = false,
  onRunFullAi,
  onBucketsRefresh,
}: RitmeProps) {
  const snapshot = financialSnapshot ?? null;
  const netFreeDisplay = snapshot?.netFree ?? 0;
  const isBusiness = variant === "business";
  const isRisk = isBusiness && businessMode === "risk";
  const isReadOnly = readOnly === true;
  const hasCoreData = spendBuckets.length > 0 || netFreeDisplay !== 0;
  const locked = false; // altijd tonen, fallback potjes vullen dit op
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
  const selectedBucket = useMemo(() => {
    if (selectedBucketId) return spendBuckets.find((b) => b.id === selectedBucketId) ?? null;
    return spendBuckets[0] ?? null;
  }, [spendBuckets, selectedBucketId]);

  const sourceLabelMap: Record<string, string> = {
    manual: "Handmatig",
    transactions: "Afschriften",
    buckets: "Buckets",
  };
  const incomeSourceLabel = snapshot?.totalIncome?.source ? sourceLabelMap[snapshot.totalIncome.source] ?? "Handmatig" : "Handmatig";
  const fixedSourceLabel = snapshot?.fixedCostsTotal?.source ? sourceLabelMap[snapshot.fixedCostsTotal.source] ?? "Handmatig" : "Handmatig";
  const netFreeSource = isBusiness
    ? "Handmatig"
    : incomeSourceLabel === fixedSourceLabel
    ? incomeSourceLabel
    : `${incomeSourceLabel} / ${fixedSourceLabel}`;

  if (locked) {
    return (
      <div className="space-y-4">
      <div className="flex flex-col gap-2 mb-4">
        <h1 className="text-2xl font-semibold text-slate-50">Ritme</h1>
        <p className="text-sm text-slate-400">
          Dit zijn je potjes: waar je geld na vaste lasten naartoe stroomt, maand na maand. Dit zijn geen vaste lasten, maar je variabele maandstromen.
        </p>
      </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-200">
          Nog geen AI-analyse uitgevoerd. Vul eerst kerngegevens in of voer een AI-analyse uit om potjes te vullen.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-2xl font-semibold text-slate-50">{isRisk ? "Risico & Zekerheid" : isBusiness ? "Cashflow" : "Ritme"}</h1>
        <p className="text-sm text-slate-400">
          {isRisk
            ? "Kwetsbaarheden, afhankelijkheden en buffers die bepalen hoe stevig je bedrijf staat."
            : isBusiness
            ? "Maandelijkse stroom van omzet, kosten en wat er onder de streep overblijft."
            : "Dit zijn je potjes: waar je geld na vaste lasten naartoe stroomt, maand na maand. Dit zijn geen vaste lasten, maar je variabele maandstromen."}
        </p>
        {!isBusiness && (
          <div className="flex flex-wrap items-center gap-2">
            <AiAnalyzeButton
              tab="ritme"
              mode={mode}
              label="AI: analyseer afschriften"
              onSuccess={onBucketsRefresh ?? onRunFullAi}
            />
            {onRunFullAi && (
              <button
                type="button"
                onClick={() => {
                  onRunFullAi();
                  onBucketsRefresh?.();
                }}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-400"
              >
                Alleen potjes bepalen
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
        <div className="2xl:col-span-2 flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex items-center justify-between text-sm">
            <div>
              <span className="text-slate-400">
                {isRisk ? "Zakelijke weerbaarheid" : isBusiness ? "Netto bedrijfsresultaat per maand" : "Vrije ruimte na vaste lasten (per maand)"}
              </span>
              <div className="text-[11px] text-slate-400">Bron: {netFreeSource}</div>
              <div className="text-[11px] text-slate-400">
                {isRisk
                  ? "Op basis van je verplichtingen, cashflow en kapitaal."
                  : isBusiness
                  ? "Op basis van je huidige vaste lasten en ritme."
                  : "Dit bedrag kun je elke maand vrij verdelen."}
              </div>
            </div>
            <span className="font-semibold text-slate-50">{formatCurrency(netFreeDisplay)}</span>
          </div>

          {spendBuckets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
              {isRisk
                ? "Zonder volledige gegevens kan het risicoprofiel niet betrouwbaar worden bepaald."
                : isBusiness
                ? "Zonder afschriften kan geen cashflow-overzicht worden opgebouwd. Upload eerst afschriften."
                : "Zonder afschriften kan er geen ritme worden opgebouwd. Upload eerst afschriften."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {spendBuckets.map((bucket) => {
                const monthly = bucket.monthlyAverage ?? 0;
                const sharePercent =
                  bucket.shareOfFree != null
                    ? Math.round(bucket.shareOfFree * 100)
                    : netFreeDisplay > 0
                    ? Math.round((monthly / netFreeDisplay) * 100)
                    : 0;

                return (
                  <button
                    key={bucket.id}
                    type="button"
                    className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-4 flex flex-col gap-2 text-left hover:border-fuchsia-500/70 hover:bg-slate-900/80 transition-colors"
                    onClick={() => {
                      if (isReadOnly) return;
                      setSelectedBucketId(bucket.id);
                    }}
                    disabled={isReadOnly}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-50">{bucket.name}</h2>
                        {bucket.isEssential && (
                          <span className="mt-1 inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                            Essentieel
                          </span>
                        )}
                      </div>
                      <div className="text-right text-xs text-slate-400">
                        <div>{sharePercent}% van je vrije geld</div>
                      </div>
                    </div>

                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-slate-400">Gemiddeld per maand</span>
                      <span className="font-medium text-slate-50">{formatCurrency(monthly)}</span>
                    </div>

                    <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-fuchsia-500/80 group-hover:bg-fuchsia-400"
                        style={{ width: `${Math.min(Math.max(sharePercent, 0), 100)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="2xl:col-span-1">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">
                {isRisk ? "Hoe dit wordt bepaald" : selectedBucket ? selectedBucket.name : isBusiness ? "Wat je hier ziet" : "Ritme uitgelegd"}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {isRisk
                  ? "Je risicoprofiel wordt afgeleid uit je maanddruk, buffer, cashflow en aflosbaarheid."
                  : selectedBucket
                  ? selectedBucket.description ?? (isBusiness
                      ? "Dit vertegenwoordigt een deel van je maandelijkse zakelijke uitgaven buiten je vaste lasten."
                      : "Dit potje vertegenwoordigt een deel van je maandelijkse uitgaven buiten je vaste lasten.")
                  : isBusiness
                  ? "Dit is je maandelijkse herhaling van inkomsten en uitgaven op basis van afschriften."
                  : "Ritme laat zien waar je geld elke maand automatisch naartoe stroomt. Het wordt opgebouwd uit je afschriften. Hier zie je waar bijsturen het meeste effect heeft."}
              </p>
              {isRisk ? (
                <p className="text-xs text-slate-400 mt-1">
                  Hoe zwaarder de vaste lasten en hoe lager de buffer, hoe kwetsbaarder de bedrijfspositie.
                </p>
              ) : null}
              {!selectedBucket && isBusiness && !isRisk && (
                <p className="text-xs text-slate-400 mt-1">
                  Hier zie je direct waar bijsturen het meeste effect heeft op je bedrijfsresultaat.
                </p>
              )}
            </div>

            {!isRisk && selectedBucket && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Gemiddeld per maand</span>
                  <span className="font-medium text-slate-50">{formatCurrency(selectedBucket.monthlyAverage ?? 0)}</span>
                </div>
                {typeof selectedBucket.shareOfFree === "number" && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Aandeel van je vrije geld</span>
                    <span className="font-medium text-slate-50">{Math.round(selectedBucket.shareOfFree * 100)}%</span>
                  </div>
                )}
              </div>
            )}

            {!selectedBucket && !isRisk && (
              <p className="text-xs text-slate-400">
                Upload eerst afschriften bij de vorige stap zodat ik potjes voor je kan vormen.
              </p>
            )}

            {!isRisk ? (
              <p className="text-xs text-slate-500">
                {isBusiness
                  ? "Deze cashflow beinvloedt direct de ruimte die je voor je bedrijfsdoelen hebt."
                  : "Deze potjes concurreren direct met je doelen om je maandruimte."}
              </p>
            ) : null}

            {!isRisk ? (
              <p className="text-xs text-slate-500">
                {isBusiness
                  ? "Cashflow is de zakelijke herhaling in je uitgaven en inkomsten. Hier zie je waar bijsturen het meeste effect heeft."
                  : "Ritme is de herhaling in je uitgaven, opgebouwd uit afschriften. Hier zie je waar bijsturen het meeste effect heeft."}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
