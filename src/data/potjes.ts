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

const buildLimits = (
  ranges: Array<{ start: MonthId; end: MonthId; limit: number }>
): MonthLimit[] => {
  return ranges.flatMap(({ start, end, limit }) =>
    rangeMonths(start, end).map((month) => ({ month, limit }))
  );
};

export const POTJES: PotjeDef[] = [
  {
    id: "snacks",
    label: "Snacks (Esso/werk)",
    limits: buildLimits([
      { start: "2025-12", end: "2026-03", limit: 50 },
      { start: "2026-04", end: "2026-06", limit: 40 },
      { start: "2026-07", end: "2026-09", limit: 30 },
      { start: "2026-10", end: "2026-12", limit: 20 },
    ]),
  },
  {
    id: "roken",
    label: "Roken / vapen",
    limits: buildLimits([
      { start: "2025-12", end: "2026-03", limit: 150 },
      { start: "2026-04", end: "2026-06", limit: 100 },
      { start: "2026-07", end: "2026-09", limit: 80 },
      { start: "2026-10", end: "2026-12", limit: 50 },
    ]),
  },
  {
    id: "googleplay",
    label: "Google Play / mini-aankopen",
    limits: buildLimits([
      { start: "2025-12", end: "2026-03", limit: 15 },
      { start: "2026-04", end: "2026-06", limit: 10 },
      { start: "2026-07", end: "2026-09", limit: 5 },
      { start: "2026-10", end: "2026-12", limit: 0 },
    ]),
  },
  {
    id: "ai",
    label: "AI-tools (Suno / Hailuo / ElevenLabs / etc.)",
    limits: buildLimits([
      { start: "2025-12", end: "2026-03", limit: 70 },
      { start: "2026-04", end: "2026-06", limit: 60 },
      { start: "2026-07", end: "2026-09", limit: 50 },
      { start: "2026-10", end: "2026-12", limit: 40 },
    ]),
  },
  {
    id: "impuls",
    label: "Impulsaankopen (Action / Rockx / snacks)",
    limits: buildLimits([
      { start: "2025-12", end: "2026-03", limit: 40 },
      { start: "2026-04", end: "2026-06", limit: 30 },
      { start: "2026-07", end: "2026-09", limit: 25 },
      { start: "2026-10", end: "2026-12", limit: 20 },
    ]),
  },
  {
    id: "tanken",
    label: "Tanken",
    limits: buildLimits([
      { start: "2025-12", end: "2026-03", limit: 300 },
      { start: "2026-04", end: "2026-06", limit: 290 },
      { start: "2026-07", end: "2026-09", limit: 275 },
      { start: "2026-10", end: "2026-12", limit: 250 },
    ]),
  },
];
