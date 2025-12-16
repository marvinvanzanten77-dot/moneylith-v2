import type { VercelRequest, VercelResponse } from "@vercel/node";

// In-memory opslag (alleen voor dev/preview). Op Vercel is dit per instance/ cold start.
const memoryStore: Record<string, any> = {};

function getUserKey(req: VercelRequest) {
  // Simpel mechanisme: header x-user-id (fallback: demo)
  const key = req.headers["x-user-id"];
  if (Array.isArray(key)) return key[0] ?? "demo";
  return key || "demo";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userKey = getUserKey(req);

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method === "GET") {
    const state = memoryStore[userKey] ?? {};
    res.status(200).json({ ok: true, state });
    return;
  }

  if (req.method === "PUT" || req.method === "POST") {
    const body = req.body;
    if (body === undefined) {
      res.status(400).json({ error: "Lege body" });
      return;
    }
    // Geen schema-validatie hier; doel is een simpel startpunt.
    memoryStore[userKey] = body;
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
