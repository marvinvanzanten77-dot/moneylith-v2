import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { code, state, error, error_description } = req.query;

  res.status(200).json({
    ok: !error,
    code: typeof code === "string" ? code : null,
    state: typeof state === "string" ? state : null,
    error: typeof error === "string" ? error : null,
    error_description: typeof error_description === "string" ? error_description : null,
  });
}
