import type { VercelRequest, VercelResponse } from "@vercel/node";

const getEnv = (key: string) => process.env[key] || "";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const clientId = getEnv("TRUELAYER_CLIENT_ID");
  const redirectUri = getEnv("TRUELAYER_REDIRECT_URI") || "http://localhost:3000/api/truelayer/callback";

  if (!clientId) {
    res.status(400).json({ error: "Missing TRUELAYER_CLIENT_ID" });
    return;
  }

  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const scope = "info accounts transactions";

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    nonce,
  });

  res.status(200).json({
    url: `https://auth.truelayer.com/?${params.toString()}`,
    state,
  });
}
