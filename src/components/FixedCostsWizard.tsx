import React from "react";
import type { FixedCostItem } from "../types";

type FixedCostsWizardProps = {
  items: FixedCostItem[];
  onChange: (items: FixedCostItem[]) => void;
  onClose: () => void;
};

export function FixedCostsWizard({ items, onChange, onClose }: FixedCostsWizardProps) {
  const handleToggleFixed = (id: string) => {
    onChange(
      items.map((item) =>
        item.id === id ? { ...item, isFixed: !item.isFixed, isIgnored: item.isFixed ? item.isIgnored : false } : item
      )
    );
  };

  const handleToggleIgnored = (id: string) => {
    onChange(
      items.map((item) =>
        item.id === id ? { ...item, isIgnored: !item.isIgnored, isFixed: item.isIgnored ? item.isFixed : false } : item
      )
    );
  };

  const handleLabelChange = (id: string, value: string) => {
    onChange(items.map((item) => (item.id === id ? { ...item, customLabel: value || undefined } : item)));
  };

  const handleAmountChange = (id: string, value: string) => {
    const num = value === "" ? undefined : Number(value);
    onChange(
      items.map((item) =>
        item.id === id
          ? { ...item, customMonthlyAmount: Number.isNaN(num as number) ? item.customMonthlyAmount : num }
          : item
      )
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-3xl rounded-xl bg-white p-4 shadow-lg dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Vaste lasten – controleer je terugkerende kosten</h2>
          <button onClick={onClose} className="text-sm underline">
            Sluiten
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Er zijn nog geen terugkerende kosten gedetecteerd.</p>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            {items.map((item) => {
              const label = item.customLabel ?? item.descriptionPattern;
              const baseMonthly = item.estimatedMonthlyAmount ?? 0;
              const effectiveMonthly = item.customMonthlyAmount ?? baseMonthly;

              return (
                <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      className="w-1/2 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                      value={label}
                      onChange={(e) => handleLabelChange(item.id, e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={item.isFixed} onChange={() => handleToggleFixed(item.id)} />
                        <span>Vaste last</span>
                      </label>
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={item.isIgnored} onChange={() => handleToggleIgnored(item.id)} />
                        <span>Negeren</span>
                      </label>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      ≈ {item.frequency}, {item.sampleCount}× gezien, laatst op {item.lastDate}
                    </span>
                    <span>Standaard maandbedrag: €{baseMonthly.toFixed(2)}</span>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span>Maandbedrag:</span>
                    <input
                      type="number"
                      className="w-32 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                      defaultValue={item.customMonthlyAmount ?? ""}
                      placeholder={baseMonthly.toFixed(2)}
                      onBlur={(e) => handleAmountChange(item.id, e.target.value)}
                    />
                    <span className="text-xs text-slate-500">(gebruikt: €{effectiveMonthly.toFixed(2)})</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
