import crypto from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearCookie, parseCookies, setCookie } from "./cookies.js";

export type TokenBundle = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
  tokenType?: string;
};

const TOKENS_COOKIE = "ml_bank_tokens";
const STATE_COOKIE = "ml_bank_state";

const getEnv = (key: string) => process.env[key] || "";

export const getAuthBase = () => {
  const env = (getEnv("TRUELAYER_ENV") || "sandbox").toLowerCase();
  return env === "production" || env === "prod"
    ? "https://auth.truelayer.com"
    : "https://auth.truelayer-sandbox.com";
};

export const getApiBase = () => {
  const env = (getEnv("TRUELAYER_ENV") || "sandbox").toLowerCase();
  return env === "production" || env === "prod"
    ? "https://api.truelayer.com"
    : "https://api.truelayer-sandbox.com";
};

const getEncryptionKey = () => {
  const secret =
    process.env.BANK_TOKEN_ENCRYPTION_KEY || process.env.TURNSTILE_SECRET_KEY || process.env.TRUELAYER_CLIENT_SECRET || "";
  return crypto.createHash("sha256").update(secret).digest();
};

const encrypt = (input: string) => {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(input, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
};

const decrypt = (input: string) => {
  const data = Buffer.from(input, "base64url");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
};

export const generateState = () => crypto.randomUUID();

export const persistOauthState = (res: VercelResponse, state: string) => {
  setCookie(res, STATE_COOKIE, state, { maxAge: 60 * 15 });
};

export const consumeOauthState = (req: VercelRequest, res: VercelResponse): string | null => {
  const cookies = parseCookies(req);
  const state = cookies[STATE_COOKIE] || null;
  clearCookie(res, STATE_COOKIE);
  return state;
};

export const clearOauthState = (res: VercelResponse) => {
  clearCookie(res, STATE_COOKIE);
};

export const persistTokens = (res: VercelResponse, token: TokenBundle) => {
  const payload = encrypt(JSON.stringify(token));
  const cookieMeta = {
    name: TOKENS_COOKIE,
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
  const approxBytes = Buffer.byteLength(`ml_bank_tokens=${payload}; Path=/; SameSite=Lax; HttpOnly; Secure`, "utf8");
  if (approxBytes > 3500) {
    console.warn("[bank.auth] token cookie near browser size limit", { approxBytes, ...cookieMeta });
  } else {
    console.log("[bank.auth] token cookie size", { approxBytes, ...cookieMeta });
  }
  setCookie(res, TOKENS_COOKIE, payload, { maxAge: 60 * 60 * 24 * 30 });
};

export const readTokens = (req: VercelRequest): TokenBundle | null => {
  const cookies = parseCookies(req);
  const payload = cookies[TOKENS_COOKIE];
  if (!payload) return null;
  try {
    const json = decrypt(payload);
    const parsed = JSON.parse(json) as TokenBundle;
    if (!parsed?.accessToken || !parsed?.refreshToken || !parsed?.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearTokens = (res: VercelResponse) => {
  clearCookie(res, TOKENS_COOKIE);
};

export const exchangeCodeForToken = async (code: string, redirectUri: string): Promise<TokenBundle> => {
  const clientId = getEnv("TRUELAYER_CLIENT_ID");
  const clientSecret = getEnv("TRUELAYER_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Missing TRUELAYER_CLIENT_ID/TRUELAYER_CLIENT_SECRET");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const resp = await fetch(`${getAuthBase()}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const payload = (await resp.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    error?: string;
  };
  if (!resp.ok || !payload.access_token || !payload.refresh_token || !payload.expires_in) {
    throw new Error(payload.error || `Token exchange failed (${resp.status})`);
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + payload.expires_in * 1000 - 30_000,
    scope: payload.scope,
    tokenType: payload.token_type,
  };
};

export const refreshAccessToken = async (refreshToken: string): Promise<TokenBundle> => {
  const clientId = getEnv("TRUELAYER_CLIENT_ID");
  const clientSecret = getEnv("TRUELAYER_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Missing TRUELAYER_CLIENT_ID/TRUELAYER_CLIENT_SECRET");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const resp = await fetch(`${getAuthBase()}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const payload = (await resp.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    error?: string;
  };
  if (!resp.ok || !payload.access_token || !payload.expires_in) {
    throw new Error(payload.error || `Token refresh failed (${resp.status})`);
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || refreshToken,
    expiresAt: Date.now() + payload.expires_in * 1000 - 30_000,
    scope: payload.scope,
    tokenType: payload.token_type,
  };
};

export const ensureValidToken = async (token: TokenBundle): Promise<TokenBundle> => {
  if (token.expiresAt > Date.now()) return token;
  return refreshAccessToken(token.refreshToken);
};
