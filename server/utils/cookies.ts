import type { VercelRequest, VercelResponse } from "@vercel/node";

type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
  maxAge?: number;
};

export function parseCookies(req: VercelRequest): Record<string, string> {
  const raw = req.headers.cookie;
  if (!raw) return {};
  return raw.split(";").reduce<Record<string, string>>((acc, part) => {
    const idx = part.indexOf("=");
    if (idx <= 0) return acc;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

export function setCookie(res: VercelResponse, key: string, value: string, options: CookieOptions = {}) {
  const secure = options.secure ?? process.env.NODE_ENV === "production";
  const sameSite = options.sameSite ?? "Lax";
  const path = options.path ?? "/";
  const parts = [`${key}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];

  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }
  if (secure) {
    parts.push("Secure");
  }
  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  const serialized = parts.join("; ");
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", serialized);
    return;
  }
  if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, serialized]);
    return;
  }
  res.setHeader("Set-Cookie", [String(existing), serialized]);
}

export function clearCookie(res: VercelResponse, key: string) {
  setCookie(res, key, "", { maxAge: 0 });
}
