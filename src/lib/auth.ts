import { createHmac, timingSafeEqual } from "node:crypto";

const DAY = 86_400_000;

export async function createSession(password: string, now = Date.now()) {
  const expires = String(now + DAY);
  const signature = createHmac("sha256", password).update(expires).digest("base64url");
  return `${expires}.${signature}`;
}

export async function verifySession(token: string | undefined, password: string | undefined, now = Date.now()) {
  if (!token || !password) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || Number(expires) < now) return false;
  const expected = createHmac("sha256", password).update(expires).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "base64url"); } catch { return false; }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
