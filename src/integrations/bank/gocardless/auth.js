import { request } from "./client.js";

let cachedToken = null;

const getEnv = (key) => process.env[key] || "";

export async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  const secretId = getEnv("GC_SECRET_ID");
  const secretKey = getEnv("GC_SECRET_KEY");
  if (!secretId || !secretKey) {
    throw new Error("GC_SECRET_ID/GC_SECRET_KEY ontbreken");
  }
  const payload = { secret_id: secretId, secret_key: secretKey };
  const data = await request("/token/new/", { method: "POST", body: JSON.stringify(payload) });
  const token = data?.access;
  const expiresIn = data?.access_expires || 300;
  cachedToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}
