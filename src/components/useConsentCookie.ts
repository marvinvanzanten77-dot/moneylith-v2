import { useCallback, useEffect, useState } from "react";

type ConsentValue = {
  analytics: boolean;
  ts: string;
};

const COOKIE_NAME = "moneylith_consent";
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

function parseCookie(): ConsentValue | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split(";").find((c) => c.trim().startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  try {
    const val = decodeURIComponent(match.split("=")[1]);
    const obj = JSON.parse(val);
    if (typeof obj.analytics === "boolean" && typeof obj.ts === "string") return obj as ConsentValue;
  } catch {
    return null;
  }
  return null;
}

function setConsentCookie(val: ConsentValue) {
  if (typeof document === "undefined") return;
  const isSecure = window.location.protocol === "https:";
  const encoded = encodeURIComponent(JSON.stringify(val));
  const parts = [
    `${COOKIE_NAME}=${encoded}`,
    `Max-Age=${MAX_AGE_SECONDS}`,
    "Path=/",
    "SameSite=Lax",
    isSecure ? "Secure" : "",
  ].filter(Boolean);
  document.cookie = parts.join("; ");
}

export function useConsentCookie() {
  const [consent, setConsent] = useState<ConsentValue | null>(null);

  useEffect(() => {
    setConsent(parseCookie());
  }, []);

  const saveConsent = useCallback((analytics: boolean) => {
    const val: ConsentValue = { analytics, ts: new Date().toISOString() };
    setConsentCookie(val);
    setConsent(val);
  }, []);

  return { consent, saveConsent };
}
