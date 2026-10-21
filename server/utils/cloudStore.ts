import crypto from "node:crypto";
export type CloudUserRecord = {
  email: string; salt: string; hash: string; createdAt: string;
  bankOwnerVerified?: boolean;
};
export const hasCloudStore = () => Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
export async function cloudCommand(args: (string | number)[]): Promise<unknown> {
  if (!hasCloudStore()) throw Error("Cloud storage is not configured.");
  const base = process.env.KV_REST_API_URL!;
  if (!base.startsWith("https://")) throw Error("Cloud storage requires HTTPS.");
  const resp = await fetch(base, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15000),
  });
  const json = await resp.json() as { result?: unknown; error?: unknown };
  if (!resp.ok || json.error || !("result" in json)) throw Error("Cloud storage unavailable.");
  return json.result;
}
const userKey = (email: string) => `ml:cloud:user:${email.toLowerCase()}`;
const snapshotKey = (email: string) => `ml:cloud:snapshot:${email.toLowerCase()}`;
export async function getCloudUser(email: string): Promise<CloudUserRecord | null> {
  const raw = await cloudCommand(["GET", userKey(email)]);
  if (raw === null) return null;
  if (typeof raw !== "string") throw Error("Invalid account record.");
  const user = JSON.parse(raw) as CloudUserRecord;
  if (user.email !== email.toLowerCase() || typeof user.hash !== "string" || typeof user.salt !== "string")
    throw Error("Invalid account record.");
  return user;
}
export async function setCloudUser(email: string, value: CloudUserRecord): Promise<boolean> {
  return await cloudCommand(["SET", userKey(email), JSON.stringify(value), "NX"]) === "OK";
}
export async function getCloudSnapshot(email: string): Promise<{ encrypted: string; revision: string } | null> {
  const raw = await cloudCommand(["GET", snapshotKey(email)]);
  if (raw === null) return null;
  if (typeof raw !== "string") throw Error("Invalid snapshot.");
  const envelope = JSON.parse(raw) as { encrypted: string; revision: string };
  if (!envelope.encrypted || !envelope.revision) throw Error("Unsupported snapshot format.");
  return envelope;
}
export async function setCloudSnapshot(email: string, encryptedPayload: string, expectedRevision: string | null) {
  const revision = crypto.randomUUID();
  const script = `local old = redis.call('GET', KEYS[1])
    local version = ''
    if old then version = cjson.decode(old).revision end
    if version ~= ARGV[1] then return 0 end
    redis.call('SET', KEYS[1], ARGV[2])
    return 1`;
  const saved = await cloudCommand(["EVAL", script, 1, snapshotKey(email), expectedRevision ?? "",
    JSON.stringify({ encrypted: encryptedPayload, revision })]);
  return saved === 1 ? revision : null;
}
export async function allowCloudLogin(ip: string) {
  const key = "ml:cloud:login-limit:" + crypto.createHash("sha256").update(ip).digest("hex");
  const count = await cloudCommand(["EVAL",
    "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], 900) end; return n",
    1, key]);
  return typeof count === "number" && count <= 15;
}
