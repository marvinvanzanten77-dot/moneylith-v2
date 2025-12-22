import type { VercelRequest, VercelResponse } from "@vercel/node";

export async function verifyTurnstile(req: VercelRequest): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const optional = process.env.TURNSTILE_OPTIONAL !== "false";
  if (!secret) {
    console.warn("Turnstile secret ontbreekt; verificatie overgeslagen.");
    return true;
  }

  const token = (req.body as any)?.turnstileToken || (req.headers["x-turnstile-token"] as string) || "";
  if (!token) {
    return optional;
  }

  try {
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
    });
    const data = (await resp.json()) as { success?: boolean };
    if (data?.success) return true;
    return optional;
  } catch (err) {
    console.error("Turnstile verification failed", err);
    return optional;
  }
}

export function requireTurnstile(req: VercelRequest, res: VercelResponse) {
  return verifyTurnstile(req).then((ok) => {
    if (!ok) {
      res.status(403).json({ error: "Verificatie mislukt, probeer opnieuw." });
      return false;
    }
    return true;
  });
}
