import { jwtVerify, SignJWT } from 'jose';

const COOKIE_NAME = 'session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 giorni

function secret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET);
}

export async function createSessionToken(payload = {}) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret());
}

// Legge un cookie per nome ESATTO. Attenzione: una regex tipo /session=([^;]+)/
// pescava il cookie sbagliato quando ne esisteva un altro con nome che finisce
// allo stesso modo (es. `_vercel_session`), facendo fallire ogni accesso.
function leggiCookie(header, nome) {
  for (const parte of String(header || '').split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nome) return parte.slice(i + 1).trim();
  }
  return null;
}

export async function verifyRequest(request) {
  // 1) cookie di sessione; 2) header Authorization: Bearer <token>, usato dalla
  //    dashboard quando il browser non conserva i cookie.
  let token = leggiCookie(request.headers.get('cookie'), COOKIE_NAME);
  if (!token) {
    const auth = request.headers.get('authorization') || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) token = m[1].trim();
  }
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload;
  } catch {
    return null;
  }
}

export function setCookie(token) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`;
}

export function clearCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }
  });
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Due utenti ammessi: Mario (admin) e Simone (backup). Password condivisa via env,
// oppure una password per utente (AUTH_PASSWORD_MARIO / AUTH_PASSWORD_SIMONE).
export function checkCredentials(email, password) {
  const e = (email || '').toLowerCase().trim();
  const p = password || '';
  const users = [
    { email: (process.env.AUTH_EMAIL || '').toLowerCase().trim(), pass: process.env.AUTH_PASSWORD || '', role: 'admin' },
    { email: (process.env.AUTH_EMAIL_SIMONE || '').toLowerCase().trim(), pass: process.env.AUTH_PASSWORD_SIMONE || process.env.AUTH_PASSWORD || '', role: 'backup' }
  ];
  for (const u of users) {
    if (u.email && u.pass && safeEqual(e, u.email) && safeEqual(p, u.pass)) {
      return { email: u.email, role: u.role };
    }
  }
  return null;
}
