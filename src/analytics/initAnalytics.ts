export function initAnalytics() {
  if (import.meta.env.MODE === "development") {
    console.debug("[analytics] initAnalytics called");
  }
  // TODO: vendor-specifieke analytics initialisatie toevoegen
}
