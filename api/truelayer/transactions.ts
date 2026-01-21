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
      // Log detailed error
      console.error("❌ TrueLayer Transactions Fetch Failed:", {
        status: txRes.status,
        accountId: account_id,
        error: txData?.error,
        description: txData?.error_description,
        timestamp: new Date().toISOString(),
      });

      // User-friendly error messages
      let userMessage = "Failed to fetch transactions";
      if (txRes.status === 401) {
        userMessage = "Access token invalid or expired. Please reconnect your bank.";
      } else if (txRes.status === 403) {
        userMessage = "Access denied to this account. Please check permissions.";
      } else if (txRes.status === 404) {
        userMessage = "Account not found. Please try again.";
      }

      res.status(txRes.status).json({
        error: userMessage,
        code: txData?.error || "transaction_fetch_failed",
        retry: txRes.status >= 500, // Retry for server errors
      });
      return;
    }

    console.log(`✅ Fetched ${txData?.transactions?.length || 0} transactions for account ${account_id}`);
    // Return transaction data
    res.status(200).json(txData);
  } catch (error) {
    console.error("❌ Transactions Fetch Error:", {
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    
    res.status(500).json({
      error: "Failed to fetch transactions - please try again",
      code: "transaction_fetch_error",
      retry: true,
    });
  }
}
