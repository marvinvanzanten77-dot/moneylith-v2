export const businessStrategies = [
  {
    value: "cashflow",
    label: "Kasstroom stabiliseren",
    hint: "Breng ontvangsten en betaalmomenten in balans.",
  },
  {
    value: "revenue",
    label: "Omzet verhogen",
    hint: "Onderzoek je omzetbasis en de vraag van klanten.",
  },
  {
    value: "margin",
    label: "Marge verbeteren",
    hint: "Bekijk omzet en bijbehorende bedrijfskosten.",
  },
  {
    value: "buffer",
    label: "Bedrijfsbuffer opbouwen",
    hint: "Werk aan ruimte voor onverwachte uitgaven.",
  },
  {
    value: "debts",
    label: "Schulden verminderen",
    hint: "Bekijk hoofdsommen, rente en aflossingen afzonderlijk.",
  },
] as const;
export const businessPressures = [
  { value: "variable_revenue", label: "Wisselende omzet" },
  { value: "costs", label: "Hoge bedrijfskosten" },
  { value: "late_payments", label: "Late klantbetalingen" },
  { value: "taxes", label: "Belastingverplichtingen" },
  { value: "debts", label: "Zakelijke schulden" },
  { value: "buffer", label: "Onvoldoende bedrijfsbuffer" },
] as const;
export type GuidedIntent<
  S extends string = string,
  P extends string = string,
> = {
  primaryGoal: S | null;
  mainPressure: P[];
  timeHorizon: "3_maanden" | "1_jaar" | "5_jaar" | null;
  aiStyle: "spiegelend" | "confronterend" | "ondersteunend" | null;
};
export type BusinessIntent = GuidedIntent<
  (typeof businessStrategies)[number]["value"],
  (typeof businessPressures)[number]["value"]
>;
export const emptyBusinessIntent = (): BusinessIntent => ({
  primaryGoal: null,
  mainPressure: [],
  timeHorizon: null,
  aiStyle: null,
});
export function validateBusinessIntent(
  value: unknown,
): asserts value is BusinessIntent {
  const v = value as BusinessIntent;
  if (
    !v ||
    (v.primaryGoal !== null &&
      !businessStrategies.some((o) => o.value === v.primaryGoal)) ||
    !Array.isArray(v.mainPressure) ||
    new Set(v.mainPressure).size !== v.mainPressure.length ||
    !v.mainPressure.every((p) =>
      businessPressures.some((o) => o.value === p),
    ) ||
    ![null, "3_maanden", "1_jaar", "5_jaar"].includes(v.timeHorizon) ||
    ![null, "spiegelend", "confronterend", "ondersteunend"].includes(v.aiStyle)
  )
    throw new Error("Kies geldige zakelijke intentieopties.");
}
