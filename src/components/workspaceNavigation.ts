/** UI state only. No financial values cross workspace boundaries. */
export const workspaceStepMap = {
  intent: "intent",
  foundation: "fundament",
  debts: "schulden",
  assets: "vermogen",
  goals: "focus",
  accounts: "rekeningen",
  bank: "bank",
  patterns: "afschriften",
  inbox: "inbox",
  forecast: "action",
  backup: "backup",
  settings: "settings",
} as const;
const key = "moneylith.navigation.step.v1";
export function readWorkspaceStep() {
  try {
    const saved = sessionStorage.getItem(key);
    return (
      Object.values(workspaceStepMap).find((step) => step === saved) ?? "intent"
    );
  } catch {
    return "intent";
  }
}
export function rememberWorkspaceStep(step: string) {
  try {
    sessionStorage.setItem(key, step);
  } catch {
    /* Navigation remains usable without storage. */
  }
}
export function readBusinessStep(): keyof typeof workspaceStepMap {
  const saved = readWorkspaceStep();
  return (
    (Object.keys(workspaceStepMap) as (keyof typeof workspaceStepMap)[]).find(
      (key) => workspaceStepMap[key] === saved,
    ) ?? "intent"
  );
}
