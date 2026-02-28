import crypto from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearCookie, parseCookies, setCookie } from "./cookies.js";

const SESSION_COOKIE = "ml_cloud_session";

const getSecret = () => {
  const src =
    process.env.CLOUD_AUTH_SECRET ||
    process.env.BANK_TOKEN_ENCRYPTION_KEY ||
    process.env.TRUELAYER_CLIENT_SECRET ||
    "moneylith-cloud-dev-secret";
  return crypto.createHash("sha256").update(src).digest("hex");
};

const sign = (value: string) => crypto.createHmac("sha256", getSecret()).update(value).digest("hex");

export const hashPassword = (password: string, salt?: string) => {
  const useSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, useSalt, 64).toString("hex");
  return { salt: useSalt, hash };
};

export const verifyPassword = (password: string, salt: string, expectedHash: string) => {
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expectedHash, "hex"));
};

export const setCloudSession = (res: VercelResponse, email: string) => {
  const payload = JSON.stringify({
    email: email.toLowerCase(),
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
  });
  const b64 = Buffer.from(payload, "utf8").toString("base64url");
  const value = `${b64}.${sign(b64)}`;
  setCookie(res, SESSION_COOKIE, value, { maxAge: 60 * 60 * 24 * 30 });
};

export const clearCloudSession = (res: VercelResponse) => {
  clearCookie(res, SESSION_COOKIE);
};

export const getCloudSessionEmail = (req: VercelRequest): string | null => {
  const cookie = parseCookies(req)[SESSION_COOKIE];
  if (!cookie) return null;
  const [b64, mac] = cookie.split(".");
  if (!b64 || !mac) return null;
  if (sign(b64) !== mac) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as { email?: string; exp?: number };
    if (!payload.email || !payload.exp || payload.exp < Date.now()) return null;
    return payload.email.toLowerCase();
  } catch {
    return null;
  }
};

const getEncKey = () => {
  const src = process.env.CLOUD_ENCRYPTION_KEY || process.env.CLOUD_AUTH_SECRET || "moneylith-cloud-encryption";
  return crypto.createHash("sha256").update(src).digest();
};

export const encryptCloudPayload = (plain: string) => {
  const iv = crypto.randomBytes(12);
  const key = getEncKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
};

export const decryptCloudPayload = (encrypted: string) => {
  const data = Buffer.from(encrypted, "base64url");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const key = getEncKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
};

