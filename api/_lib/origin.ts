// Blocks requests whose Origin header doesn't match this deployment or an
// explicit allowlist. Browsers attach Origin on every POST, cross-origin or
// not, so this stops other sites' scripts from calling the endpoint using a
// visitor's session. It's not a substitute for auth — a curl request can
// still spoof the header — but combined with rate limiting it meaningfully
// raises the cost of casual abuse against the Claude API budget.
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin requests in some browsers, curl, server-to-server

  const allowed = new Set<string>();
  if (process.env.VERCEL_URL) allowed.add(`https://${process.env.VERCEL_URL}`);
  if (process.env.ALLOWED_ORIGIN) {
    process.env.ALLOWED_ORIGIN.split(',').forEach((o) => allowed.add(o.trim()));
  }
  allowed.add('http://localhost:5173');
  allowed.add('http://localhost:3000');

  if (allowed.has(origin)) return true;

  // Any Vercel preview deployment for this project (*.vercel.app) — previews
  // get a fresh VERCEL_URL per deploy that the allowlist above won't have.
  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}
