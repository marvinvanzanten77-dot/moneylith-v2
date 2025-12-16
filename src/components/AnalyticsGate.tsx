import React, { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { parseConsentCookie } from "./useConsentCookie";

export const AnalyticsGate: React.FC = () => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const consent = parseConsentCookie();
    if (consent?.analytics) {
      if (import.meta.env.MODE === "development") {
        console.debug("[analytics] consent=true -> render <Analytics />");
      }
      setEnabled(true);
    } else if (import.meta.env.MODE === "development") {
      console.debug("[analytics] consent missing/false -> skip analytics");
    }
  }, []);

  if (!enabled) return null;
  return <Analytics />;
};
