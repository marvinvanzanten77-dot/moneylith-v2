export type MonthId = string; // "2025-12", "2026-01", etc.

export interface MonthLimit {
  month: MonthId;
  limit: number;
}

export interface PotjeDef {
  id: string; // bv "snacks"
  label: string; // bv "Snacks (Esso/werk)"
  description?: string;
  limits: MonthLimit[]; // maand -> limiet in euro
}

export interface SchuldenPlanItem {
  id: string;
  month: MonthId; // "2025-12" etc.
  labelMaand: string; // "dec 2025" etc.
  focusSchuld: string;
  doelBedrag: number;
  beschrijving: string;
}

export interface FixedCostItem {
  id: string;
  naam: string;
  bedrag: number;
  dagVanMaand: number; // 1-31
  opmerking?: string;
}
