import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

process.env.GOOGLE_CLIENT_ID = "id";
process.env.GOOGLE_CLIENT_SECRET = "secret";
process.env.GOOGLE_REDIRECT_URI = "http://localhost/cb";
process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");

const { encryptToken, decryptToken } = await import("./tokenCrypto.js");

test("descifra lo que cifró", () => {
  const token = "1//refresh-token-de-ejemplo";
  assert.equal(decryptToken(encryptToken(token)), token);
});

test("el mismo texto produce cifrados distintos (IV aleatorio)", () => {
  assert.notEqual(encryptToken("abc"), encryptToken("abc"));
});

test("no guarda el token en claro", () => {
  assert.ok(!Buffer.from(encryptToken("secreto-visible"), "base64").toString("utf8").includes("secreto-visible"));
});

test("detecta manipulación del texto cifrado", () => {
  const raw = Buffer.from(encryptToken("abc"), "base64");
  raw[raw.length - 1] ^= 0xff;
  assert.throws(() => decryptToken(raw.toString("base64")));
});
