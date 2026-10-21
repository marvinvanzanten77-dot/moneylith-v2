export type CloudState = Record<string, string>;
const legacy = new Set([
  "selected-month", "month-focus", "income-netto", "income-netto-business",
  "fixed-costs", "fixed-costs-business", "fixed-cost-items", "fixed-cost-items-business",
]);
export function cloudKey(key: string) {
  return !/demo|token|secret|password/i.test(key) && (
    key.startsWith("moneylith.personal.") || key.startsWith("moneylith.business.") ||
    key === "moneylith.chat.v1.personal" || key === "moneylith.chat.v1.business-real" ||
    legacy.has(key)
  );
}
export function validateCloudState(value: unknown): value is CloudState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > 500) return false;
  return entries.every(([key, raw]) => {
    if (!cloudKey(key) || typeof raw !== "string") return false;
    try { JSON.parse(raw); return true; } catch { return false; }
  });
}
export function collectCloudState(storage: Storage): CloudState {
  const state: CloudState = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && cloudKey(key)) {
      const value = storage.getItem(key);
      if (value !== null) state[key] = value;
    }
  }
  return Object.fromEntries(Object.entries(state).sort(([a], [b]) => a.localeCompare(b)));
}
export function restoreCloudState(storage: Storage, state: CloudState) {
  if (!validateCloudState(state)) throw Error("Ongeldige cloudgegevens.");
  const previous = collectCloudState(storage);
  // Keep one local recovery copy outside the uploaded financial keys.
  storage.setItem("moneylith.cloud.localRecovery", JSON.stringify(previous));
  const replace = (value: CloudState) => {
    for (const key of Object.keys(collectCloudState(storage))) storage.removeItem(key);
    for (const [key, raw] of Object.entries(value)) storage.setItem(key, raw);
  };
  try { replace(state); } catch {
    try { replace(previous); } catch { /* recovery copy remains available */ }
    throw Error("Herstellen mislukt. Je vorige lokale administratie is als herstelkopie bewaard.");
  }
}
