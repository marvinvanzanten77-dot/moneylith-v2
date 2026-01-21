import type { VercelRequest, VercelResponse } from "@vercel/node";

const getEnv = (key: string) => process.env[key] || "";

const getAuthBase = () => {
  const env = (getEnv("TRUELAYER_ENV") || "sandbox").toLowerCase();
  return env === "production" || env === "prod"
    ? "https://auth.truelayer.com"
    : "https://auth.truelayer-sandbox.com";
};

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

// HANDLER FUNCTIONS

async function handleAuthStart(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const clientId = getEnv("TRUELAYER_CLIENT_ID");
  const redirectUri = getEnv("TRUELAYER_REDIRECT_URI") || "http://localhost:3000/api/truelayer/callback";
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
    url: `${getAuthBase()}/?${params.toString()}`,
    state,
  });
}

async function handleToken(req: VercelRequest, res: VercelResponse) {
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
      console.error("❌ TrueLayer Token Exchange Failed:", {
        status: tokenRes.status,
        error: payload?.error,
        description: payload?.error_description,
        timestamp: new Date().toISOString(),
      });

      let userMessage = "Token exchange failed";
      if (payload?.error === "invalid_grant") {
        userMessage = "Authorization code expired or invalid. Please retry bank login.";
      } else if (payload?.error === "invalid_client") {
        userMessage = "Client configuration error. Please contact support.";
      }

      res.status(tokenRes.status).json({
        error: userMessage,
        code: payload?.error || "token_exchange_failed",
        retry: true,
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

async function handleCallback(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { code, state, error, error_description } = req.query;

  res.status(200).json({
    ok: !error,
    code: typeof code === "string" ? code : null,
    state: typeof state === "string" ? state : null,
    error: typeof error === "string" ? error : null,
    error_description: typeof error_description === "string" ? error_description : null,
  });
}

async function handleAccounts(req: VercelRequest, res: VercelResponse) {
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

async function handleTransactions(req: VercelRequest, res: VercelResponse) {
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
    const txRes = await fetch(`${getApiBase()}/data/v1/accounts/${account_id}/transactions`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    const txData = await txRes.json();
    if (!txRes.ok) {
      console.error("❌ TrueLayer Transactions Fetch Failed:", {
        status: txRes.status,
        accountId: account_id,
        error: txData?.error,
        description: txData?.error_description,
        timestamp: new Date().toISOString(),
      });

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
        retry: txRes.status >= 500,
      });
      return;
    }

    console.log(`✅ Fetched ${txData?.transactions?.length || 0} transactions for account ${account_id}`);
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

// MAIN ROUTER
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { truelayer } = req.query;
  const action = Array.isArray(truelayer) ? truelayer[0] : truelayer;

  switch (action) {
    case "auth-start":
      return await handleAuthStart(req, res);
    case "token":
      return await handleToken(req, res);
    case "callback":
      return await handleCallback(req, res);
    case "accounts":
      return await handleAccounts(req, res);
    case "transactions":
      return await handleTransactions(req, res);
    default:
      res.status(404).json({ error: "Unknown TrueLayer action" });
  }
}
