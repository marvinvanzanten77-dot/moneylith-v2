import type { MonthId, SchuldenPlanItem } from "../types";

const MONTHS: { id: MonthId; label: string }[] = [
  { id: "2025-12", label: "dec 2025" },
  { id: "2026-01", label: "jan 2026" },
  { id: "2026-02", label: "feb 2026" },
  { id: "2026-03", label: "mrt 2026" },
  { id: "2026-04", label: "apr 2026" },
  { id: "2026-05", label: "mei 2026" },
  { id: "2026-06", label: "jun 2026" },
  { id: "2026-07", label: "jul 2026" },
  { id: "2026-08", label: "aug 2026" },
  { id: "2026-09", label: "sep 2026" },
  { id: "2026-10", label: "okt 2026" },
  { id: "2026-11", label: "nov 2026" },
  { id: "2026-12", label: "dec 2026" },
];

export const SCHULDENPLAN: SchuldenPlanItem[] = MONTHS.map((month) => ({
  id: month.id,
  month: month.id,
  labelMaand: month.label,
  focusSchuld: "",
  doelBedrag: 0,
  beschrijving: "",
}));
