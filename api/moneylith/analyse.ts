import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { rateLimit } from "../../server/utils/rateLimit.js";
import { verifyTurnstile } from "../../server/utils/verifyTurnstile.js";
import { auditLog } from "../../server/utils/audit.js";

import { buildChatRequest } from "../../src/ai/context.js";

const MODEL = "gpt-4.1-mini";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const started = Date.now();
  let rateLimited = false;
  const okLimit = rateLimit(req, res, { limit: 20, windowMs: 60_000 });
  if (!okLimit) {
    rateLimited = true;
    auditLog({
      ts: new Date().toISOString(),
      route: "api/moneylith/analyse",
      status: "fail",
      latencyMs: Date.now() - started,
      rateLimited: true,
      turnstile: false,
    });
    return;
  }

  const ok = await verifyTurnstile(req);
  if (!ok) {
    res.status(403).json({ error: "Verificatie mislukt, probeer opnieuw." });
    auditLog({
      ts: new Date().toISOString(),
      route: "api/moneylith/analyse",
      status: "fail",
      latencyMs: Date.now() - started,
      rateLimited,
      turnstile: false,
    });
    return;
  }

  let messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  let scope: string | undefined;
  try {
    if (req.body?.scope !== undefined) {
      const selected = buildChatRequest(req.body);
      messages = selected.messages;
      scope = selected.scope;
    } else {
      // Existing per-tab analysis contract; the shared chat always uses the scoped protocol.
      const { system, user } = req.body ?? {};
      if (typeof system !== "string" || typeof user !== "string" || !system || !user || system.length + user.length > 500_000) throw new Error("Ongeldige analysevraag.");
      messages = [{ role: "system", content: system }, { role: "user", content: user }];
    }
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Ongeldige AI-context." });
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "AI niet beschikbaar: OPENAI_API_KEY ontbreekt op de server." });
    return;
  }

  const client = new OpenAI({ apiKey, timeout: 25_000, maxRetries: 0 });

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages,
      max_tokens: 600,
      temperature: 0.3,
    });

    const content = completion.choices?.[0]?.message?.content?.toString().trim() ?? "";
    if (!content) throw new Error("Empty AI response");
    auditLog({
      ts: new Date().toISOString(),
      route: "api/moneylith/analyse",
      status: "success",
      latencyMs: Date.now() - started,
      rateLimited,
      turnstile: true,
      tokens: completion?.usage
        ? {
            prompt: completion.usage.prompt_tokens,
            completion: completion.usage.completion_tokens,
          }
        : undefined,
    });
    res.status(200).json({ content, ...(scope ? { scope } : {}) });
  } catch (error) {
    res.status(502).json({ error: "AI-service kon geen antwoord geven. Probeer het later opnieuw." });
    auditLog({
      ts: new Date().toISOString(),
      route: "api/moneylith/analyse",
      status: "fail",
      latencyMs: Date.now() - started,
      rateLimited,
      turnstile: true,
    });
  }
}

