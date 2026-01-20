import type { VercelRequest, VercelResponse } from "@vercel/node";

const getEnv = (key: string) => process.env[key] || "";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const clientId = getEnv("TRUELAYER_CLIENT_ID");
  const redirectUri = getEnv("TRUELAYER_REDIRECT_URI") || "http://localhost:3000/api/truelayer/callback";
  const env = (getEnv("TRUELAYER_ENV") || "sandbox").toLowerCase();
  const authBase =
    env === "production" || env === "prod"
      ? "https://auth.truelayer.com"
      : "https://auth.truelayer-sandbox.com";
  const scopes = getEnv("TRUELAYER_SCOPES") || "info accounts transactions";
  const providers = getEnv("TRUELAYER_PROVIDERS");

  if (!clientId) {
    res.status(400).json({ error: "Missing TRUELAYER_CLIENT_ID" });
    return;
  }

  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state,
    nonce,
  });
  if (providers) {
    params.set("providers", providers);
  }

  res.status(200).json({
    url: `${authBase}/?${params.toString()}`,
    state,
  });
}
