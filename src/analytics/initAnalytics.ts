let didInit = false;

export function initAnalytics() {
  if (typeof window === "undefined") return;
  if (didInit) return;

  const scriptSrc = import.meta.env.VITE_ANALYTICS_SRC as string | undefined;
  if (!scriptSrc) {
    if (import.meta.env.MODE === "development") {
      console.debug("[analytics] initAnalytics skipped (no VITE_ANALYTICS_SRC)");
    }
    return;
  }

  if (document.querySelector('script[data-moneylith-analytics="true"]')) {
    didInit = true;
    return;
  }

  const script = document.createElement("script");
  script.src = scriptSrc;
  script.defer = true;
  script.setAttribute("data-moneylith-analytics", "true");

  const siteId = import.meta.env.VITE_ANALYTICS_SITE as string | undefined;
  if (siteId) {
    script.setAttribute("data-domain", siteId);
  }

  document.head.appendChild(script);
  didInit = true;

  if (import.meta.env.MODE === "development") {
    console.debug("[analytics] vendor script injected");
  }
}
