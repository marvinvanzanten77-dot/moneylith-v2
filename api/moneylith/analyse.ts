import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { rateLimit } from "../utils/rateLimit";
import { verifyTurnstile } from "../utils/verifyTurnstile";
import { initSentry, Sentry } from "../utils/sentry";
import { auditLog } from "../utils/audit";

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

  initSentry();

  const apiKey = process.env.OPENAI_API_KEY;
  const { system, user } = (req.body || {}) as { system?: string; user?: string };
  if (!system || !user) {
    res.status(400).json({ error: "Missing system/user payload" });
    return;
  }

  if (!apiKey) {
    const fallback =
      "AI offline: gebruik mock analyse.\n" +
      "- Inkomsten: geen analyse\n" +
      "- Vaste lasten: geen analyse\n" +
      "- Schulden/Doelen: geen analyse";
    res.status(200).json({ content: fallback });
    return;
  }

  const client = new OpenAI({ apiKey });

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 600,
      temperature: 0.3,
    });

    const content = completion.choices?.[0]?.message?.content?.toString().trim() ?? "";
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
    res.status(200).json({ content });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { route: "api/moneylith/analyse" },
      extra: { message: (error as any)?.message },
    });
    const fallback =
      "AI call mislukte; gebruik mock analyse.\n" +
      "- Controleer je OPENAI_API_KEY\n" +
      "- Probeer later opnieuw";
    res.status(200).json({ content: fallback });
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
