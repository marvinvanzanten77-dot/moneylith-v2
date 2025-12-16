import type { VercelRequest, VercelResponse } from "@vercel/node";

type WindowConfig = { limit: number; windowMs: number };

// In-memory sliding window. On Vercel, scope is per instance and may reset on cold start.
const buckets = new Map<string, number[]>();

function getKey(req: VercelRequest) {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "unknown";
  const user = (req.headers["x-user-id"] as string) || "";
  return user ? `user:${user}` : `ip:${ip}`;
}

export function rateLimit(req: VercelRequest, res: VercelResponse, cfg: WindowConfig): boolean {
  const key = getKey(req);
  const now = Date.now();
  const windowStart = now - cfg.windowMs;
  const arr = buckets.get(key)?.filter((ts) => ts > windowStart) ?? [];

  if (arr.length >= cfg.limit) {
    res.status(429).json({ error: "Te veel verzoeken. Probeer het later opnieuw." });
    return false;
  }

  arr.push(now);
  buckets.set(key, arr);
  return true;
}
