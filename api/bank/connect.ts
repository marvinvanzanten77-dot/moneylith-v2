import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateState, getAuthBase, persistOauthState } from "../../server/utils/bankAuth.js";

const getEnv = (key: string) => process.env[key] || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const clientId = getEnv("TRUELAYER_CLIENT_ID");
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost:3000";
  const expectedCallbackPath = "/api/bank/callback";
  const computedRedirectUri = `${proto}://${host}${expectedCallbackPath}`;
  const configuredRedirectUri = (getEnv("TRUELAYER_REDIRECT_URI") || "").trim();
  let redirectUri = configuredRedirectUri || computedRedirectUri;
  try {
    const parsed = new URL(redirectUri);
    if (parsed.pathname !== expectedCallbackPath) {
      console.warn("[bank.connect] invalid TRUELAYER_REDIRECT_URI path, falling back to computed callback", {
        configuredRedirectUri,
        expectedCallbackPath,
      });
      redirectUri = computedRedirectUri;
    }
  } catch {
    if (configuredRedirectUri) {
      console.warn("[bank.connect] invalid TRUELAYER_REDIRECT_URI value, falling back to computed callback", {
        configuredRedirectUri,
      });
    }
    redirectUri = computedRedirectUri;
  }
  if (!clientId) {
    res.status(500).json({ error: "Missing TRUELAYER_CLIENT_ID" });
    return;
  }

  const state = generateState();
  persistOauthState(res, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "accounts transactions balance",
    state,
  });

  const countryId = (getEnv("TRUELAYER_COUNTRY_ID") || "NL").toUpperCase();
  params.set("country_id", countryId);

  // Providers are optional; when omitted, TrueLayer shows providers for the chosen country.
  // If this is set, pass it through exactly as configured.
  const providers = (getEnv("TRUELAYER_PROVIDERS") || "").trim();
  if (providers && providers.toLowerCase() !== "nl") {
    params.set("providers", providers);
  } else if (providers.toLowerCase() === "nl") {
    console.warn("[bank.connect] ignoring TRUELAYER_PROVIDERS=nl; use country_id=NL instead");
  }

  const url = `${getAuthBase()}/?${params.toString()}`;
  console.log("[bank.connect] redirecting to consent", {
    authBase: getAuthBase(),
    redirectUri,
    countryId,
    providers: providers && providers.toLowerCase() !== "nl" ? providers : null,
  });
  res.redirect(302, url);
}

