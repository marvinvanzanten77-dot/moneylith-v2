import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { rateLimit } from "./utils/rateLimit";
import { verifyTurnstile } from "./utils/verifyTurnstile";
import { auditLog } from "./utils/audit";

const MODEL = "gpt-4o-mini";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const started = Date.now();
  let rateLimited = false;
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const okLimit = rateLimit(req, res, { limit: 20, windowMs: 60_000 });
    if (!okLimit) {
      rateLimited = true;
      auditLog({
        ts: new Date().toISOString(),
        route: "api/moneylith-analyse",
        status: "fail",
        latencyMs: Date.now() - started,
        rateLimited: true,
        turnstile: false,
      });
      return;
    }

    const ok = await verifyTurnstile(req);
    if (!ok) {
      // In productie liever een 403, maar voor stabiliteit fallback naar soft-error
      res.status(200).json({ error: "Verificatie mislukt, probeer opnieuw." });
      auditLog({
        ts: new Date().toISOString(),
        route: "api/moneylith-analyse",
        status: "fail",
        latencyMs: Date.now() - started,
        rateLimited,
        turnstile: false,
      });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const { system, user } = (req.body || {}) as { system?: string; user?: string };
    if (!system || !user) {
      res.status(200).json({ content: "AI offline: ontbrekende payload (system/user)." });
      return;
    }

    // Fallback: als de key ontbreekt of een call faalt, leveren we een mock-antwoord
    // zodat de frontend niet vastloopt tijdens productie.
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

    let content = "";
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
      content = completion.choices?.[0]?.message?.content?.toString().trim() ?? "";
      auditLog({
        ts: new Date().toISOString(),
        route: "api/moneylith-analyse",
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
    } catch (err) {
      console.error("OpenAI call failed, serving mock", err);
      content =
        "AI call mislukte; gebruik mock analyse.\n- Controleer je OPENAI_API_KEY of model.\n- Probeer later opnieuw.";
      auditLog({
        ts: new Date().toISOString(),
        route: "api/moneylith-analyse",
        status: "fail",
        latencyMs: Date.now() - started,
        rateLimited,
        turnstile: true,
      });
    }
    res.status(200).json({ content });
  } catch (error) {
    console.error("moneylith/analyse error", error);
    const fallback =
      "AI call mislukte; gebruik mock analyse.\n" +
      "- Controleer je OPENAI_API_KEY\n" +
      "- Probeer later opnieuw";
    res.status(200).json({ content: fallback });
    auditLog({
      ts: new Date().toISOString(),
      route: "api/moneylith-analyse",
      status: "fail",
      latencyMs: Date.now() - started,
      rateLimited,
      turnstile: true,
    });
  }
}
