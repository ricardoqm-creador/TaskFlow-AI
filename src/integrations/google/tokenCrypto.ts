import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getGoogleConfig } from "./googleConfig.js";

// Cifrado AES-256-GCM: los tokens OAuth nunca se guardan en claro en la base de datos.
// Formato almacenado: base64(iv[12] | authTag[16] | ciphertext)
export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getGoogleConfig().tokenKey, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function decryptToken(stored: string): string {
  const raw = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", getGoogleConfig().tokenKey, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
