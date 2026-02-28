type CloudUserRecord = {
  email: string;
  salt: string;
  hash: string;
  createdAt: string;
};

const usersMemory = new Map<string, CloudUserRecord>();
const snapshotsMemory = new Map<string, string>();

const hasKv = () => Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const kvFetch = async (path: string) => {
  const base = process.env.KV_REST_API_URL as string;
  const token = process.env.KV_REST_API_TOKEN as string;
  const resp = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const json = (await resp.json().catch(() => ({}))) as { result?: unknown };
  return { ok: resp.ok, result: json.result };
};

const userKey = (email: string) => `ml:cloud:user:${email.toLowerCase()}`;
const snapshotKey = (email: string) => `ml:cloud:snapshot:${email.toLowerCase()}`;

export async function getCloudUser(email: string): Promise<CloudUserRecord | null> {
  const key = userKey(email);
  if (hasKv()) {
    const data = await kvFetch(`/get/${encodeURIComponent(key)}`);
    if (!data.ok || !data.result || typeof data.result !== "string") return null;
    try {
      return JSON.parse(data.result) as CloudUserRecord;
    } catch {
      return null;
    }
  }
  return usersMemory.get(key) ?? null;
}

export async function setCloudUser(email: string, value: CloudUserRecord): Promise<void> {
  const key = userKey(email);
  const raw = JSON.stringify(value);
  if (hasKv()) {
    await kvFetch(`/set/${encodeURIComponent(key)}/${encodeURIComponent(raw)}`);
    return;
  }
  usersMemory.set(key, value);
}

export async function getCloudSnapshot(email: string): Promise<string | null> {
  const key = snapshotKey(email);
  if (hasKv()) {
    const data = await kvFetch(`/get/${encodeURIComponent(key)}`);
    if (!data.ok || !data.result || typeof data.result !== "string") return null;
    return data.result;
  }
  return snapshotsMemory.get(key) ?? null;
}

export async function setCloudSnapshot(email: string, encryptedPayload: string): Promise<void> {
  const key = snapshotKey(email);
  if (hasKv()) {
    await kvFetch(`/set/${encodeURIComponent(key)}/${encodeURIComponent(encryptedPayload)}`);
    return;
  }
  snapshotsMemory.set(key, encryptedPayload);
}

