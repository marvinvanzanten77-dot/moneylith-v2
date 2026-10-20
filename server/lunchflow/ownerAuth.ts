import crypto from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCookie } from "../utils/cookies.js";
export const ownerCookie = "__Host-ml_lunchflow_owner";
export type OwnerConfig = {
  email: string;
  codeHash: string;
  secret: string;
  apiKey: string;
};
export function ownerConfig(
  env: NodeJS.ProcessEnv = process.env,
): OwnerConfig | null {
  if (
    env.LUNCHFLOW_PRIVATE_ENABLED !== "true" ||
    env.VERCEL_ENV === "preview" ||
    !env.LUNCHFLOW_API_KEY?.trim() ||
    !env.LUNCHFLOW_OWNER_EMAIL?.includes("@") ||
    !/^[a-f0-9]{64}$/.test(env.LUNCHFLOW_OWNER_CODE_HASH ?? "") ||
    !/^[a-f0-9]{64}$/.test(env.LUNCHFLOW_SESSION_SECRET ?? "")
  )
    return null;
  return {
    email: env.LUNCHFLOW_OWNER_EMAIL.trim().toLowerCase(),
    codeHash: env.LUNCHFLOW_OWNER_CODE_HASH!,
    secret: env.LUNCHFLOW_SESSION_SECRET!,
    apiKey: env.LUNCHFLOW_API_KEY,
  };
}
export const hashCode = (code: string) =>
  crypto.createHash("sha256").update(code).digest("hex");
const equal = (a: string, b: string) =>
  a.length === b.length &&
  crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function validOwnerCredentials(
  email: unknown,
  code: unknown,
  config: OwnerConfig,
) {
  return (
    typeof email === "string" &&
    typeof code === "string" &&
    code.length >= 40 &&
    code.length <= 256 &&
    equal(hashCode(email.trim().toLowerCase()), hashCode(config.email)) &&
    equal(hashCode(code), config.codeHash)
  );
}
const sign = (payload: string, c: OwnerConfig) =>
  crypto
    .createHmac("sha256", c.secret)
    .update("moneylith-lunchflow-owner-v1:" + c.codeHash + ":" + payload)
    .digest("hex");
export function createOwnerSession(c: OwnerConfig, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      email: c.email,
      iat: now,
      exp: now + 3600000,
      nonce: crypto.randomBytes(16).toString("hex"),
    }),
  ).toString("base64url");
  return payload + "." + sign(payload, c);
}
export function validOwnerSession(
  req: Pick<VercelRequest, "headers">,
  c: OwnerConfig,
  now = Date.now(),
) {
  try {
    const cookies = (req.headers.cookie ?? "")
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.startsWith(ownerCookie + "="));
    if (cookies.length !== 1) return false;
    const token = decodeURIComponent(cookies[0].slice(ownerCookie.length + 1));
    if (token.length > 2048) return false;
    const parts = token.split(".");
    if (
      parts.length !== 2 ||
      !/^[a-f0-9]{64}$/.test(parts[1]) ||
      !equal(sign(parts[0], c), parts[1])
    )
      return false;
    const p = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return (
      p.email === c.email &&
      Number.isSafeInteger(p.exp) &&
      Number.isSafeInteger(p.iat) &&
      p.iat <= now &&
      p.exp > now &&
      p.exp - p.iat === 3600000
    );
  } catch {
    return false;
  }
}
export function writeOwnerCookie(res: VercelResponse, token: string) {
  setCookie(res, ownerCookie, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: token ? 3600 : 0,
  });
}
