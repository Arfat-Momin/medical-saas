import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

const jsonError = (code: string, message: string) => ({ error: { code, message } });

/**
 * Normalize an IP for rate-limit bucketing.
 *
 * - Strips the IPv4-mapped IPv6 prefix (::ffff:1.2.3.4 -> 1.2.3.4).
 * - Masks IPv6 addresses to their /64 prefix so an attacker who owns a
 *   whole IPv6 block cannot rotate through 2^64 addresses to defeat the
 *   limiter.
 * - Relies on app.set('trust proxy', 1) so req.ip is the real client IP
 *   when we run behind Vercel / nginx / Cloudflare.
 */
function normalizeIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  let v = ip.trim();
  if (!v) return 'unknown';

  if (v.startsWith('::ffff:')) v = v.slice(7);

  if (v.includes(':')) {
    const parts = v.split(':');
    if (parts.length >= 4) {
      return parts.slice(0, 4).join(':') + '::/64';
    }
  }
  return v;
}

/**
 * Keyed on IP + email so an attacker rotating IPs still hits the
 * per-email bucket, and an attacker rotating emails still hits the
 * per-IP bucket.
 */
function emailIpKey(req: Request): string {
  const email = String((req.body as any)?.email ?? '').toLowerCase().trim();
  return `${normalizeIp(req.ip)}:${email}`;
}

function emailOnlyKey(req: Request): string {
  return String((req.body as any)?.email ?? '').toLowerCase().trim();
}

/**
 * Prefer the authenticated userId for per-user buckets; fall back to the
 * normalized IP if the request is unauthenticated. This is used by the
 * sync and global limiters, which run AFTER authenticate middleware, so
 * req.auth should almost always be present.
 */
function userOrIpKey(req: Request): string {
  const userId = req.auth?.userId;
  if (userId) return `u:${userId}`;
  return `ip:${normalizeIp(req.ip)}`;
}

// ── Login ──────────────────────────────────────────────────────────
export const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailIpKey,
  message: jsonError('RATE_LIMITED', 'Too many login attempts. Try again in 15 minutes.'),
});

// ── Refresh ────────────────────────────────────────────────────────
export const authRefreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonError('RATE_LIMITED', 'Too many refresh attempts.'),
});

// ── Signup (IP + email) ────────────────────────────────────────────
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailIpKey,
  message: jsonError('RATE_LIMITED', 'Too many signups from this IP. Try again in an hour.'),
});

// ── Signup (email only) ────────────────────────────────────────────
export const signupEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailOnlyKey,
  message: jsonError('RATE_LIMITED', 'Too many signup attempts for this email. Try again in an hour.'),
});

// ── Google signup completion ───────────────────────────────────────
export const googleSignupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonError('RATE_LIMITED', 'Too many signup attempts. Try again in an hour.'),
});

// ── Sync pull ──────────────────────────────────────────────────────
// A typical initial sync is ~50-100 requests. Multi-device users can
// burst higher. 600/min per user gives plenty of headroom while still
// stopping a runaway client loop from melting the DB.
export const syncPullLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: jsonError('RATE_LIMITED', 'Too many sync requests. Please slow down.'),
});

// ── Sync device registration ───────────────────────────────────────
export const syncDeviceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: jsonError('RATE_LIMITED', 'Too many device registrations. Please slow down.'),
});

// ── Global authenticated API safety net ────────────────────────────
// Applied once, after authenticate, before module routers. Protects
// against any client-side loop that would otherwise hit a module
// endpoint thousands of times a minute. Not a substitute for the
// per-route limiters above; those give more specific 429s.
export const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: jsonError('RATE_LIMITED', 'Too many requests. Please slow down.'),
});