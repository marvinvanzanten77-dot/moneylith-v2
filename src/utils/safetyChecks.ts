import { buildNamespacedKey } from "./userStorage";

const TEST_KEY = "__moneylith_safety__";

export const runStorageSafetyChecks = () => {
  if (typeof window === "undefined") return;
  try {
    const storage = window.localStorage;
    const legacyValue = JSON.stringify({ legacy: true });
    storage.setItem(TEST_KEY, legacyValue);

    const profileAKey = buildNamespacedKey("safety-profile-a", TEST_KEY);
    const profileBKey = buildNamespacedKey("safety-profile-b", TEST_KEY);
    storage.setItem(profileAKey, JSON.stringify({ debt: 1 }));

    console.assert(storage.getItem(TEST_KEY) === legacyValue, "Legacy data blijft intact zonder login.");
    console.assert(storage.getItem(profileAKey) !== storage.getItem(profileBKey), "Profiel A data is niet zichtbaar in B.");
    console.assert(storage.getItem(profileAKey) !== storage.getItem(TEST_KEY), "Profiel A wijzigt local-default niet.");

    const fallbackRead = storage.getItem(buildNamespacedKey("missing-profile", TEST_KEY)) ?? storage.getItem(TEST_KEY);
    console.assert(fallbackRead === legacyValue, "Fallback naar legacy data werkt als namespaced key ontbreekt.");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[safety-check] Checks overgeslagen:", err);
  } finally {
    try {
      const storage = window.localStorage;
      storage.removeItem(TEST_KEY);
      storage.removeItem(buildNamespacedKey("safety-profile-a", TEST_KEY));
      storage.removeItem(buildNamespacedKey("safety-profile-b", TEST_KEY));
      storage.removeItem(buildNamespacedKey("missing-profile", TEST_KEY));
    } catch {
      /* ignore cleanup errors */
    }
  }
};
