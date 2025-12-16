import { useEffect, useMemo } from "react";
import { VermogenCard } from "../VermogenCard";
import type { FinancialSnapshot } from "../../types";
import type { FinanceMode } from "../../logic/snapshot";

type AssetItem = {
  id: string;
  naam: string;
  bedrag: number;
};

type AssetSummary = {
  totalAssets: number;
  assetsCount: number;
};

interface StepVermogenProps {
  assets: AssetItem[];
  onAssetsChange: (items: AssetItem[]) => void;
  onAssetSummary?: (summary: AssetSummary) => void;
  financialSnapshot?: FinancialSnapshot | null;
  variant?: "personal" | "business";
  readOnly?: boolean;
  mode?: FinanceMode;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value || 0);

export function StepVermogen({
  assets,
  onAssetsChange,
  onAssetSummary,
  financialSnapshot,
  variant = "personal",
  readOnly = false,
  mode = "personal",
}: StepVermogenProps) {
  const isBusiness = variant === "business";
  const isReadOnly = readOnly === true;

  const summary = useMemo(() => {
    const totalAssets = assets.reduce(
      (sum, item) => sum + (Number.isFinite(item.bedrag) ? Math.max(0, item.bedrag) : 0),
      0
    );
    return { totalAssets, assetsCount: assets.length };
  }, [assets]);

  useEffect(() => {
    if (isReadOnly) return;
    onAssetSummary?.(summary);
  }, [summary, onAssetSummary, isReadOnly]);

  const monthlyFixedCosts = financialSnapshot?.fixedCostsTotal?.value ?? 0;
  const runwayMonths = monthlyFixedCosts > 0 ? summary.totalAssets / monthlyFixedCosts : null;

  let bufferStatusLabel = "Onbekend";
  if (runwayMonths != null) {
    if (runwayMonths < 1) bufferStatusLabel = "Kritisch";
    else if (runwayMonths < 3) bufferStatusLabel = "Zwak";
    else if (runwayMonths <= 6) bufferStatusLabel = "Gezond";
    else bufferStatusLabel = "Ruim";
  }

  const title = isBusiness ? "Kapitaal" : "Vermogen";
  const subtitle = isBusiness
    ? "Buffers, reserves en bedrijfsmiddelen die je bedrijf veerkracht en slagkracht geven."
    : "Spaarpotten, buffers en bezittingen die je financiële basis vormen.";

  const leftTitle = isBusiness ? "Je zakelijke buffers & assets" : "Wat je nu hebt";
  const leftSubtext = isBusiness
    ? "Hier zie je je zakelijke kapitaal: wat je bedrijf kan opvangen en wat voor je werkt."
    : "Overzicht van je buffers en bezittingen.";
  const emptyText = isBusiness
    ? "Je hebt hier nog geen zakelijke buffers of assets ingevuld. Voeg eerst zakelijk kapitaal toe."
    : "Je hebt hier nog geen vermogen of buffers ingevuld. Voeg eerst potjes of bezittingen toe.";

  const rightTitle = isBusiness ? "Buffer & kapitaal" : "Buffer & vermogen";
  const rightSubtext = isBusiness
    ? "Overzicht van je totale zakelijke kapitaal en hoe lang je bedrijf ongeveer kan draaien op de buffer."
    : "Overzicht van je totale vermogen en hoeveel maanden buffer je ongeveer hebt.";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-2xl font-semibold text-slate-50">{title}</h1>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 flex flex-col gap-4">
          <div className="card-shell p-5 text-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{leftTitle}</h2>
                <p className="text-sm text-slate-600">{leftSubtext}</p>
              </div>
              <span className="text-xs text-slate-500">Totaal: {summary.assetsCount} stuks</span>
            </div>

            {summary.totalAssets === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-50">{emptyText}</div>
            ) : null}

            <VermogenCard items={assets} onItemsChange={onAssetsChange} onSummaryChange={onAssetSummary} readOnly={isReadOnly} />

            <div className="rounded-lg bg-white/80 p-3 text-sm text-slate-800 shadow-inner mt-3">
              <p>Totaal vermogen: {formatCurrency(summary.totalAssets)}</p>
              <p>Aantal posten: {summary.assetsCount}</p>
              {runwayMonths != null ? (
                <p>Dekt ongeveer: {Math.floor(runwayMonths)} maanden vaste lasten</p>
              ) : (
                <p>Nog geen vaste lasten ingesteld</p>
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-1">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col gap-4 text-slate-50">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">{rightTitle}</h2>
              <p className="text-xs text-slate-400 mt-1">{rightSubtext}</p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">{isBusiness ? "Totaal zakelijk kapitaal" : "Totaal vermogen"}</span>
                <span className="font-medium text-slate-50">{formatCurrency(summary.totalAssets)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Runway / buffer</span>
                <span className="font-medium text-slate-50">
                  {runwayMonths != null ? `${Math.floor(runwayMonths)} maanden` : "Nog niet berekend"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Buffer-gezondheid</span>
                <span className="font-medium text-slate-50">{bufferStatusLabel}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Richtwaarde: 3-6 maanden vaste lasten als minimale {isBusiness ? "zakelijke" : "persoonlijke"} buffer. Meer is extra slagruimte.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
