import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

const jsonError = (code: string, message: string) => ({ error: { code, message } });

/**
 * Normalize an IP for rate-limit bucketing.
 *
 * - Strips the IPv4-mapped IPv6 prefix (::ffff:1.2.3.4 -> 1.2.3.4).
 * - Masks IPv6 addresses to their /64 prefix so an attacker who owns a
 *   whole IPv6 block cannot rotate through 2^64 addresses to defeat the
 *   limiter. This mirrors what express-rate-limit v7.5+ does internally
 *   via ipKeyGenerator(), but without requiring the newer dep.
 * - Relies on app.set('trust proxy', 1) so req.ip is the real client IP
 *   when we run behind Vercel / nginx / Cloudflare.
 */
function normalizeIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  let v = ip.trim();
  if (!v) return 'unknown';

  // ::ffff:1.2.3.4  ->  1.2.3.4
  if (v.startsWith('::ffff:')) v = v.slice(7);

  // IPv6: keep the first 4 hextets (64 bits), collapse the rest.
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
 * per-IP bucket. Both must be exhausted to bypass the limiter.
 */
function emailIpKey(req: Request): string {
  const email = String((req.body as any)?.email ?? '').toLowerCase().trim();
  return `${normalizeIp(req.ip)}:${email}`;
}

function emailOnlyKey(req: Request): string {
  return String((req.body as any)?.email ?? '').toLowerCase().trim();
}

// ── Login ────────────────────────────────────────────────────
export const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailIpKey,
  message: jsonError('RATE_LIMITED', 'Too many login attempts. Try again in 15 minutes.'),
});

// ── Refresh ──────────────────────────────────────────────────
export const authRefreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonError('RATE_LIMITED', 'Too many refresh attempts.'),
});

// ── Signup (IP + email) ──────────────────────────────────────
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailIpKey,
  message: jsonError('RATE_LIMITED', 'Too many signups from this IP. Try again in an hour.'),
});

// ── Signup (email only) ──────────────────────────────────────
export const signupEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailOnlyKey,
  message: jsonError('RATE_LIMITED', 'Too many signup attempts for this email. Try again in an hour.'),
});

// ── Google signup completion ─────────────────────────────────
export const googleSignupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonError('RATE_LIMITED', 'Too many signup attempts. Try again in an hour.'),
});