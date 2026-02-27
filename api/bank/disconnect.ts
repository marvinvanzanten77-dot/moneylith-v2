import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearOauthState, clearTokens } from "../../server/utils/bankAuth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  clearTokens(res);
  clearOauthState(res);
  console.log("[bank.disconnect] bank session cleared");
  res.status(200).json({ ok: true, connected: false, purgeRecommended: true });
}

