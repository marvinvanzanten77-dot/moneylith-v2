import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureValidToken, persistTokens, readTokens } from "../utils/bankAuth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const stored = readTokens(req);
  if (!stored) {
    res.status(200).json({ connected: false });
    return;
  }

  try {
    const valid = await ensureValidToken(stored);
    if (valid.accessToken !== stored.accessToken || valid.expiresAt !== stored.expiresAt) {
      persistTokens(res, valid);
      console.log("[bank.status] token refreshed");
    }
    res.status(200).json({
      connected: true,
      expires_at: new Date(valid.expiresAt).toISOString(),
    });
  } catch (err) {
    console.error("[bank.status] invalid token", {
      message: err instanceof Error ? err.message : String(err),
    });
    res.status(200).json({ connected: false });
  }
}
