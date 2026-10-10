/** Constant-time-ish string compare for shared secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Vaani's webhook settings take a URL only (no custom headers, no request signing),
 * so the secret may also arrive as ?secret=... in the URL. The header still works.
 */
export function hasWebhookSecret(req: Request): boolean {
  const supplied = req.headers.get("x-webhook-secret") ?? new URL(req.url).searchParams.get("secret") ?? "";
  return safeEqual(supplied, process.env.VAANI_WEBHOOK_SECRET ?? "");
}
