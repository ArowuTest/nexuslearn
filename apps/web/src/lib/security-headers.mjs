// Browser protections for a children's site. Script and style allowances stay
// wide enough for the Next.js production pages. HSTS is added only when the
// site is actually served over HTTPS.

const PRODUCTION_API = "https://nexuslearn-api.onrender.com";

export function securityHeaders(env = process.env) {
  const connect = ["'self'", PRODUCTION_API, "http://localhost:*", "http://127.0.0.1:*", "http://api.test"];
  const configured = String(env.NEXT_PUBLIC_API_URL || "").trim();
  if (configured) {
    try {
      const origin = new URL(configured).origin;
      if (!connect.includes(origin)) connect.push(origin);
    } catch {
      // An unusable API address must not widen the policy to every site.
    }
  }
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "media-src 'self' blob: data:",
        "font-src 'self' data:",
        `connect-src ${connect.join(" ")}`,
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ].join("; "),
    },
  ];
  const mode = String(env.NEXUSLEARN_ENV || "").trim().toLowerCase();
  const production = env.VERCEL === "1" || mode === "production" || mode === "prod";
  if (!production) {
    const policy = headers.find((item) => item.key === "Content-Security-Policy");
    if (policy) {
      policy.value = policy.value.replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'unsafe-eval'");
      policy.value = policy.value.replace("connect-src ", "connect-src ws: wss: ");
    }
  }
  if (production) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  }
  return headers;
}
