import { saveCloudRecovery } from "./cloudRecovery.js";
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
export async function restoreCloudState(storage: Storage, state: CloudState, saveRecovery = saveCloudRecovery) {
  if (!validateCloudState(state)) throw Error("Ongeldige cloudgegevens.");
  const previous = collectCloudState(storage);
  // Persist the recovery outside localStorage before changing any financial keys.
  const legacyKey = "moneylith.cloud.localRecovery";
  const legacy = storage.getItem(legacyKey);
  try { await saveRecovery(previous, legacy); } catch {
    throw Error("De lokale herstelkopie kon niet worden bewaard. Er is niets overschreven. Maak ruimte vrij op je apparaat en probeer opnieuw.");
  }
  // An edit may have happened while IndexedDB was committing. Never overwrite it.
  if (JSON.stringify(collectCloudState(storage)) !== JSON.stringify(previous))
    throw Error("Je lokale gegevens zijn ondertussen gewijzigd. Probeer de cloudversie opnieuw te laden; er is niets overschreven.");
  // The old copy is now durable in IndexedDB too, so reclaim its limited storage.
  storage.removeItem(legacyKey);
  const replace = (value: CloudState) => {
    for (const key of Object.keys(collectCloudState(storage))) storage.removeItem(key);
    for (const [key, raw] of Object.entries(value)) storage.setItem(key, raw);
  };
  try { replace(state); } catch {
    try { replace(previous); } catch { /* durable IndexedDB recovery remains available */ }
    throw Error("Herstellen mislukt. Je vorige lokale administratie is als herstelkopie op dit apparaat bewaard.");
  }
}
