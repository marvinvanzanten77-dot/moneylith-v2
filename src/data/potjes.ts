import { MonthId, MonthLimit, PotjeDef } from "../types";

const rangeMonths = (start: MonthId, end: MonthId): MonthId[] => {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  const months: MonthId[] = [];

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const paddedMonth = String(month).padStart(2, "0");
    months.push(`${year}-${paddedMonth}` as MonthId);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }

  return months;
};

export const createZeroLimits = (): MonthLimit[] =>
  rangeMonths("2025-12", "2026-12").map((month) => ({
    month,
    limit: 0,
  }));

export const getDefaultPotjes = (): PotjeDef[] => [
  {
    id: "snacks",
    label: "",
    description: "",
    limits: createZeroLimits(),
    categoryKey: "",
    customName: "",
  },
  {
    id: "roken",
    label: "",
    description: "",
    limits: createZeroLimits(),
    categoryKey: "",
    customName: "",
  },
  {
    id: "googleplay",
    label: "",
    description: "",
    limits: createZeroLimits(),
    categoryKey: "",
    customName: "",
  },
  {
    id: "ai",
    label: "",
    description: "",
    limits: createZeroLimits(),
    categoryKey: "",
    customName: "",
  },
  {
    id: "impuls",
    label: "",
    description: "",
    limits: createZeroLimits(),
    categoryKey: "",
    customName: "",
  },
  {
    id: "tanken",
    label: "",
    description: "",
    limits: createZeroLimits(),
    categoryKey: "",
    customName: "",
  },
];

export const POTJES: PotjeDef[] = getDefaultPotjes();
