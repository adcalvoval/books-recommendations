// In-memory sliding-window rate limiter. Vercel Fluid Compute reuses warm
// instances across requests, so this gives real (if per-instance, not
// globally distributed) protection against a single client hammering the
// Claude-backed endpoint. Good enough for a low-traffic personal app; swap
// for a shared store (Upstash/Vercel KV) if this needs to scale.
const hits = new Map<string, number[]>();

const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS_PER_WINDOW = 20;
const MAX_TRACKED_KEYS = 5000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const existing = hits.get(key) ?? [];
  const recent = existing.filter((ts) => ts > windowStart);

  if (recent.length >= MAX_HITS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((recent[0] + WINDOW_MS - now) / 1000);
    hits.set(key, recent);
    return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }

  recent.push(now);
  hits.set(key, recent);

  // Prevent unbounded growth from many distinct IPs.
  if (hits.size > MAX_TRACKED_KEYS) {
    const oldestKey = hits.keys().next().value;
    if (oldestKey !== undefined) hits.delete(oldestKey);
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function getClientKey(req: { headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (ip ?? 'unknown').split(',')[0].trim();
}
