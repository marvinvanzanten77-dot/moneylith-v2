import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateState, getAuthBase, persistOauthState } from "../utils/bankAuth.js";

const getEnv = (key: string) => process.env[key] || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const clientId = getEnv("TRUELAYER_CLIENT_ID");
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost:3000";
  const redirectUri = getEnv("TRUELAYER_REDIRECT_URI") || `${proto}://${host}/api/bank/callback`;
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

  const providers = getEnv("TRUELAYER_PROVIDERS") || "nl";
  if (providers) {
    params.set("providers", providers);
  }

  const url = `${getAuthBase()}/?${params.toString()}`;
  console.log("[bank.connect] redirecting to consent", { redirectUri, providers });
  res.redirect(302, url);
}
