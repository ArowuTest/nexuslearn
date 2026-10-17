import { createHmac, timingSafeEqual } from "node:crypto";

const DEV_SECRET = "local-narration-access-only";

export function narrationAccessSecret() {
  const configured = String(process.env.NARRATION_ACCESS_SECRET || "").trim();
  if (configured) return configured;
  const env = String(process.env.NEXUSLEARN_ENV || process.env.VERCEL_ENV || "").toLowerCase();
  if (env === "production") return "";
  return DEV_SECRET;
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
  if (got.length !== want.length) return false;
  return timingSafeEqual(got, want);
}
