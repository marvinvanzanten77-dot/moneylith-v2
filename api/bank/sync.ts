import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureValidToken, persistTokens, readTokens } from "../utils/bankAuth.js";
import { runBankSync } from "../utils/bankSync.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const stored = readTokens(req);
  if (!stored) {
    res.status(401).json({ error: "No linked bank session found" });
    return;
  }

  try {
    const valid = await ensureValidToken(stored);
    if (valid.accessToken !== stored.accessToken || valid.expiresAt !== stored.expiresAt) {
      persistTokens(res, valid);
      console.log("[bank.sync] token refreshed");
    }

    const result = await runBankSync(valid.accessToken);
    console.log("[bank.sync] sync complete", {
      accounts: result.accounts.length,
      transactions: result.transactions.length,
    });

    res.status(200).json({
      ok: true,
      synced_at: new Date().toISOString(),
      accounts: result.accounts,
      transactions: result.transactions,
    });
  } catch (err) {
    console.error("[bank.sync] sync failed", { message: err instanceof Error ? err.message : String(err) });
    res.status(502).json({ error: "Bank sync failed" });
  }
}
