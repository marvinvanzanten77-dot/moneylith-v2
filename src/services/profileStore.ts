import { base64ToBuffer, deriveAesKey, hashPassword, randomSalt, timingSafeEqual } from "../utils/cryptoHelpers";

const DB_NAME = "moneylith-profiles";
const STORE_NAME = "profiles";
const DB_VERSION = 1;
const DEFAULT_ITERATIONS = 150_000;

export type ProfileRecord = {
  profileId: string;
  username: string;
  email?: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt?: string;
  encryption?: {
    enabled: boolean;
    salt: string;
    iterations: number;
  };
  schemaVersion?: number;
};

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "profileId" });
        store.createIndex("username", "username", { unique: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const runTx = async <T>(mode: IDBTransactionMode, cb: (store: IDBObjectStore) => IDBRequest<T>) => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const req = cb(store);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
};

const toProfileSession = (record: ProfileRecord) => ({
  profileId: record.profileId,
  username: record.username,
  email: record.email,
  createdAt: record.createdAt,
  lastLoginAt: record.lastLoginAt,
  encryption: record.encryption,
});

export const listProfiles = async (): Promise<ProfileRecord[]> => {
  try {
    return await runTx("readonly", (store) => store.getAll());
  } catch {
    return [];
  }
};

export const getProfile = async (profileId: string): Promise<ProfileRecord | null> => {
  if (!profileId) return null;
  try {
    const result = await runTx<ProfileRecord | undefined>("readonly", (store) => store.get(profileId));
    return result ?? null;
  } catch {
    return null;
  }
};

export const touchLastLogin = async (profileId: string) => {
  try {
    const profile = await getProfile(profileId);
    if (!profile) return;
    const next: ProfileRecord = { ...profile, lastLoginAt: new Date().toISOString() };
    await runTx("readwrite", (store) => store.put(next));
  } catch {
    /* ignore */
  }
};

export const createProfile = async (input: {
  username: string;
  email?: string;
  password: string;
  encrypt?: boolean;
}): Promise<ProfileRecord> => {
  const profileId =
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const salt = randomSalt();
  const passwordHash = await hashPassword(input.password, salt, DEFAULT_ITERATIONS);
  const now = new Date().toISOString();
  const record: ProfileRecord = {
    profileId,
    username: input.username,
    email: input.email,
    salt,
    passwordHash,
    createdAt: now,
    lastLoginAt: now,
    encryption: input.encrypt
      ? { enabled: true, salt: randomSalt(), iterations: DEFAULT_ITERATIONS }
      : { enabled: false, salt, iterations: DEFAULT_ITERATIONS },
    schemaVersion: 1,
  };
  await runTx("readwrite", (store) => store.put(record));
  return record;
};

export const verifyProfilePassword = async (profile: ProfileRecord, password: string) => {
  const computed = await hashPassword(password, profile.salt, profile.encryption?.iterations ?? DEFAULT_ITERATIONS);
  const a = base64ToBuffer(profile.passwordHash);
  const b = base64ToBuffer(computed);
  return timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
};

export const removeProfile = async (profileId: string) => {
  try {
    await runTx("readwrite", (store) => store.delete(profileId));
  } catch {
    /* ignore */
  }
};

export const deriveProfileEncryptionKey = async (profile: ProfileRecord, password: string) => {
  if (!profile.encryption?.enabled) return null;
  return deriveAesKey(password, profile.encryption.salt, profile.encryption.iterations);
};

export type ProfileSession = ReturnType<typeof toProfileSession>;

export const asSession = toProfileSession;
