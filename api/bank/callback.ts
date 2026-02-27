import type { VercelRequest, VercelResponse } from "@vercel/node";
import { consumeOauthState, exchangeCodeForToken, persistTokens } from "../../server/utils/bankAuth.js";
import { runBankSync } from "../../server/utils/bankSync.js";

const getEnv = (key: string) => process.env[key] || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const returnedState = typeof req.query.state === "string" ? req.query.state : "";
  const error = typeof req.query.error === "string" ? req.query.error : "";
  const errorDescription = typeof req.query.error_description === "string" ? req.query.error_description : "";

  if (error) {
    console.error("[bank.callback] consent error", { error, errorDescription });
    res.redirect(302, "/?bank=error");
    return;
  }
  if (!code) {
    res.redirect(302, "/?bank=error");
    return;
  }

  const expectedState = consumeOauthState(req, res);
  if (!expectedState || !returnedState || expectedState !== returnedState) {
    console.error("[bank.callback] invalid state", { expectedState: !!expectedState, returnedState: !!returnedState });
    res.redirect(302, "/?bank=state_error");
    return;
  }

  try {
    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost:3000";
    const redirectUri = getEnv("TRUELAYER_REDIRECT_URI") || `${proto}://${host}/api/bank/callback`;

    const tokenBundle = await exchangeCodeForToken(code, redirectUri);
    persistTokens(res, tokenBundle);

    // Start sync once in callback so we detect integration issues early.
    const synced = await runBankSync(tokenBundle.accessToken);
    console.log("[bank.callback] initial sync complete", {
      accounts: synced.accounts.length,
      transactions: synced.transactions.length,
    });

    res.redirect(302, "/?bank=connected");
  } catch (err) {
    console.error("[bank.callback] token/sync failure", {
      message: err instanceof Error ? err.message : String(err),
    });
    res.redirect(302, "/?bank=error");
  }
}

