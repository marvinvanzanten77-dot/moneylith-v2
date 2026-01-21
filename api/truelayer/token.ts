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
      // Log detailed error for debugging
      console.error("❌ TrueLayer Token Exchange Failed:", {
        status: tokenRes.status,
        error: payload?.error,
        description: payload?.error_description,
        timestamp: new Date().toISOString(),
      });

      // User-friendly error messages
      let userMessage = "Token exchange failed";
      if (payload?.error === "invalid_grant") {
        userMessage = "Authorization code expired or invalid. Please retry bank login.";
      } else if (payload?.error === "invalid_client") {
        userMessage = "Client configuration error. Please contact support.";
      }

      res.status(tokenRes.status).json({
        error: userMessage,
        code: payload?.error || "token_exchange_failed",
        retry: true, // Signal to client that retry is possible
      });
      return;
    }

    console.log("✅ Token exchange successful");
    res.status(200).json(payload);
  } catch (error) {
    console.error("❌ Token Exchange Error:", {
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    
    res.status(500).json({
      error: "Token exchange error - please try again",
      code: "token_exchange_error",
      retry: true,
    });
  }
}
