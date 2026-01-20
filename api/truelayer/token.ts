import type { VercelRequest, VercelResponse } from "@vercel/node";

const getEnv = (key: string) => process.env[key] || "";

const getAuthBase = () => {
  const env = (getEnv("TRUELAYER_ENV") || "sandbox").toLowerCase();
  return env === "production" || env === "prod"
    ? "https://auth.truelayer.com"
    : "https://auth.truelayer-sandbox.com";
};

const readBody = (req: VercelRequest) => {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body || {};
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { code, redirect_uri } = readBody(req);
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Missing code" });
    return;
  }

  const clientId = getEnv("TRUELAYER_CLIENT_ID");
  const clientSecret = getEnv("TRUELAYER_CLIENT_SECRET");
  const redirectUri = redirect_uri || getEnv("TRUELAYER_REDIRECT_URI");
  if (!clientId || !clientSecret || !redirectUri) {
    res.status(400).json({
      error: "Missing TRUELAYER_CLIENT_ID/TRUELAYER_CLIENT_SECRET/TRUELAYER_REDIRECT_URI",
    });
    return;
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  try {
    const tokenRes = await fetch(`${getAuthBase()}/connect/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });

    const raw = await tokenRes.text();
    const payload = raw ? JSON.parse(raw) : {};
    if (!tokenRes.ok) {
      res.status(tokenRes.status).json({
        error: payload?.error || "Token exchange failed",
        error_description: payload?.error_description || raw,
      });
      return;
    }

    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({ error: "Token exchange error" });
  }
}
