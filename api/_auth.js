import crypto from 'crypto';

const COOKIE_NAME = 'yysession';
const SALT = '__yangyoung_counseling_v1__';
const MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30일

export function makeToken(password) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    if (k) out[k] = v.join('=');
  });
  return out;
}

export function verifyAuth(req) {
  const expected = process.env.SITE_PASSWORD;
  if (!expected) return false;
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  const valid = makeToken(expected);
  if (token.length !== valid.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(valid));
}

export function setSessionCookie(res, password) {
  const token = makeToken(password);
  const flags = `Path=/; Max-Age=${MAX_AGE_SEC}; HttpOnly; SameSite=Lax; Secure`;
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; ${flags}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`);
}

export function requireAuth(req, res) {
  if (verifyAuth(req)) return true;
  res.status(401).json({ error: 'unauthorized' });
  return false;
}
