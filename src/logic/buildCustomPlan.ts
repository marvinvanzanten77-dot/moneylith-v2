import type { CustomPlan } from "./debtSimulator";

type ParsedPlan = Partial<CustomPlan>;

const extractJson = (text: string): any | null => {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const slice = text.slice(start, end + 1);
      return JSON.parse(slice);
    }
  } catch {
    return null;
  }
  return null;
};

/**
 * Convert free-form AI text into a conservative CustomPlan.
 * Recognizes:
 *  - priority: [id|naam,...]
 *  - extra: {id|naam: amount}
 *  - budget: number
 */
// Custom plan support verwijderd
export function buildCustomPlanFromAI(): CustomPlan {
  return {};
}
