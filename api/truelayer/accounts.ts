import type { VercelRequest, VercelResponse } from "@vercel/node";

const getEnv = (key: string) => process.env[key] || "";

const getApiBase = () => {
  const env = (getEnv("TRUELAYER_ENV") || "sandbox").toLowerCase();
  return env === "production" || env === "prod"
    ? "https://api.truelayer.com"
    : "https://api.truelayer-sandbox.com";
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

  const authHeader = req.headers.authorization || "";
  const { access_token } = readBody(req);
  const token =
    authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : access_token;

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Missing access_token" });
    return;
  }

  try {
    const dataRes = await fetch(`${getApiBase()}/data/v1/accounts`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const raw = await dataRes.text();
    const payload = raw ? JSON.parse(raw) : {};
    if (!dataRes.ok) {
      res.status(dataRes.status).json({
        error: payload?.error || "Accounts fetch failed",
        error_description: payload?.error_description || raw,
      });
      return;
    }

    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({ error: "Accounts fetch error" });
  }
}
