import type { VercelRequest, VercelResponse } from "@vercel/node";

const getEnv = (key: string) => process.env[key] || "";

const getAuthBase = () => {
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

  const { access_token, account_id } = readBody(req);
  if (!access_token || !account_id) {
    res.status(400).json({ error: "Missing access_token or account_id" });
    return;
  }

  try {
    // Fetch transactions for the account (last 90 days by default)
    const txRes = await fetch(`${getAuthBase()}/data/v1/accounts/${account_id}/transactions`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    const txData = await txRes.json();
    if (!txRes.ok) {
      res.status(txRes.status).json({
        error: txData?.error || "Failed to fetch transactions",
        error_description: txData?.error_description,
      });
      return;
    }

    // Return transaction data
    res.status(200).json(txData);
  } catch (error) {
    console.error("Transactions fetch error:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
}
