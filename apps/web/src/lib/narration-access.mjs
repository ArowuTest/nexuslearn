import { createHmac, timingSafeEqual } from "node:crypto";

// Optional. Production does not require NARRATION_ACCESS_SECRET, and there is
// no built-in value. Approved clips play from the API approval list. Signed
// links fail closed wherever the secret is unset, including production.
export function narrationAccessSecret() {
  return String(process.env.NARRATION_ACCESS_SECRET || "").trim();
}

export function signNarrationPath(pathname, expiresAt, secret = narrationAccessSecret()) {
  if (!secret || !pathname.startsWith("/audio/")) return "";
  const payload = `${expiresAt}.${pathname}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function narrationSignatureValid(pathname, expiresAt, signature, nowSeconds = Date.now() / 1000, secret = narrationAccessSecret()) {
  if (!secret || !signature || !pathname.startsWith("/audio/")) return false;
  const exp = Number(expiresAt);
  if (!Number.isFinite(exp) || exp < nowSeconds || exp > nowSeconds + 60 * 60 * 12) return false;
  const expected = signNarrationPath(pathname, String(Math.trunc(exp)), secret);
  const got = Buffer.from(String(signature));
  const want = Buffer.from(expected);
  if (got.length !== want.length || expected === "") return false;
  return timingSafeEqual(got, want);
}
