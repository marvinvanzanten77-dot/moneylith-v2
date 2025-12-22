import type { VercelRequest, VercelResponse } from "@vercel/node";
import { rateLimit } from "./utils/rateLimit.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!rateLimit(req, res, { limit: 20, windowMs: 60_000 })) return;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OPENAI_API_KEY ontbreekt op de server" });
    return;
  }

  const { prompt, state } = req.body || {};

  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "prompt ontbreekt" });
    return;
  }

  const formatInstruction = `Gebruik EXACT dit format, zonder extra alinea's: STATUS: ...  GEVOLG IN TIJD: ...  GEVOLG PER MAAND: ...  RISICO-INDICATOR: ...  Regels (schulden): - Leidende tijd: aflosMode == 'minimum' -> debtClearMonths; aflosMode == 'aggressive' -> debtClearMonthsAggressive. - debtClearMonthsBuffered is secundair; noem deze alleen als hij >12 maanden afwijkt van de leidende tijd. - Status (schulden): "stabiel" als aflosMode=='aggressive' en debtClearMonthsAggressive < 48; "kwetsbaar" als aflosMode=='minimum' en debtClearMonths > 60; "onhoudbaar" als debtClearMonths > 120 of netIncome <= 0. Gebruik alleen deze labels. - Gevolg per maand (schulden): bij minimum = ?{debtsMinPayment}; bij aggressive = ?{netIncome}. - Risico-indicator (schulden): "laag" als aggressive <36; "middel" als 36-84; "hoog" als >84. Gebruik alleen deze labels.  Regels (vermogen/opbouwen): - assetTargetMonths is leidend voor tijd (op basis van assetMonthlyContribution en assetTarget). - Als assetTargetMonths === 0 -> doel is bereikt. - Als assetMonthlyContribution === 0 -> geen opbouwtempo. - Status (vermogen): "stabiel" als assetTargetMonths <= 36; "kwetsbaar" als 36 < assetTargetMonths <= 96; "onhoudbaar" als assetTargetMonths > 96 of assetMonthlyContribution === 0. Gebruik alleen deze labels. - Gevolg in tijd (vermogen): assetTargetMonths === 0 -> Vermogensdoel is reeds bereikt; anders ¤ {assetTargetMonths} maanden tot eerste vermogensdoel; bij maandinleg 0: Geen opbouwbaar tijdpad berekenbaar. - Gevolg per maand (vermogen): Maandelijkse opbouw: ?{assetMonthlyContribution} (altijd tonen, ook bij 0). - Risico-indicator (vermogen): laag als assetTargetMonths <=36; middel 36-96; hoog >96 of maandinleg 0. Alleen deze drie woorden.  Verboden taal: geen advies/aanraden/doelstelling/motivatie. Alleen feiten en consequenties.`;

  const contextSummary = typeof state === "object" ? JSON.stringify(state ?? {}) : String(state ?? "");

  try {
    const completion = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "Je bent een consequente spiegel. Benoem alleen de impact van de huidige invoer (financieel en in tijd). Geen advies, geen lange teksten, geen code. Gebruik aflosMode om te bepalen welke aflostijd leidend is ('minimum' -> debtClearMonths, 'aggressive' -> debtClearMonthsAggressive). debtClearMonthsBuffered is secundair (>12 maanden afwijking). Netto maandruimte bepaalt druk per maand (laag = kwetsbaar, hoog = stabiel). Voor vermogen gebruik assetTargetMonths als leidende tijd; als 0, dan doel al bereikt. Als maandinleg 0, geen opbouwtempo. Vermijd advies/raad/motivatie. Als allowProactiveSavingsAdvice == false: geef geen ongevraagde bespaar/optimalisatievoorstellen, bespreek besparingen alleen als de gebruiker er expliciet om vraagt. Als allowProactiveSavingsAdvice == true: je mag proactief bespaar/optimalisatievoorstellen doen.",
          },
          {
            role: "user",
            content: `Context (JSON): ${contextSummary}\n\nVraag: ${prompt}\n\n${formatInstruction}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 300,
      }),
    });

    if (!completion.ok) {
      const text = await completion.text();
      res.status(502).json({ error: "Upstream OpenAI error", detail: text });
      return;
    }

    const data = (await completion.json()) as any;
    const answer = data?.choices?.[0]?.message?.content ?? "Geen antwoord ontvangen.";
    res.status(200).json({ answer });
  } catch (error: any) {
    res.status(500).json({ error: "AI-proxy fout", detail: String(error) });
  }
}
