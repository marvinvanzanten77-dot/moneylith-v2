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

const ALL_MONTH_LIMITS: MonthLimit[] = rangeMonths("2025-12", "2026-12").map((month) => ({
  month,
  limit: 0,
}));

export const POTJES: PotjeDef[] = [
  {
    id: "snacks",
    label: "Snacks (Esso/werk)",
    limits: ALL_MONTH_LIMITS,
  },
  {
    id: "roken",
    label: "Roken / vapen",
    limits: ALL_MONTH_LIMITS,
  },
  {
    id: "googleplay",
    label: "Google Play / mini-aankopen",
    limits: ALL_MONTH_LIMITS,
  },
  {
    id: "ai",
    label: "AI-tools (Suno / Hailuo / ElevenLabs / etc.)",
    limits: ALL_MONTH_LIMITS,
  },
  {
    id: "impuls",
    label: "Impulsaankopen (Action / Rockx / snacks)",
    limits: ALL_MONTH_LIMITS,
  },
  {
    id: "tanken",
    label: "Tanken",
    limits: ALL_MONTH_LIMITS,
  },
];
