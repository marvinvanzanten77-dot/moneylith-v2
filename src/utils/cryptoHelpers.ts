const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type EncryptedPayload = {
  iv: string;
  ciphertext: string;
  version: number;
};

export const bufferToBase64 = (input: ArrayBuffer | Uint8Array) => {
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
};

export const base64ToBuffer = (input: string) => {
  const binary = typeof atob !== "undefined" ? atob(input) : Buffer.from(input, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

export const randomSalt = (length = 16) => {
  if (typeof crypto === "undefined") throw new Error("Crypto not available");
  const saltBytes = new Uint8Array(length);
  crypto.getRandomValues(saltBytes);
  return bufferToBase64(saltBytes);
};

export const deriveKeyBytes = async (password: string, saltB64: string, iterations = 150_000, length = 32) => {
  if (typeof crypto === "undefined" || !crypto.subtle) throw new Error("SubtleCrypto not available");
  const salt = base64ToBuffer(saltB64);
  const keyMaterial = await crypto.subtle.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    length * 8
  );
  return new Uint8Array(bits);
};

export const hashPassword = async (password: string, saltB64: string, iterations = 150_000) => {
  const bytes = await deriveKeyBytes(password, saltB64, iterations, 32);
  return bufferToBase64(bytes);
};

export const timingSafeEqual = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
};

export const deriveAesKey = async (password: string, saltB64: string, iterations = 150_000) => {
  if (typeof crypto === "undefined" || !crypto.subtle) throw new Error("SubtleCrypto not available");
  const salt = base64ToBuffer(saltB64);
  const keyMaterial = await crypto.subtle.importKey("raw", textEncoder.encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

export const encryptString = async (plainText: string, key: CryptoKey): Promise<EncryptedPayload> => {
  if (typeof crypto === "undefined" || !crypto.subtle) throw new Error("SubtleCrypto not available");
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(plainText));
  return {
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(encrypted),
    version: 1,
  };
};

export const decryptString = async (payload: EncryptedPayload, key: CryptoKey): Promise<string> => {
  if (typeof crypto === "undefined" || !crypto.subtle) throw new Error("SubtleCrypto not available");
  const iv = base64ToBuffer(payload.iv);
  const cipherBuf = base64ToBuffer(payload.ciphertext);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBuf);
  return textDecoder.decode(decrypted);
};

