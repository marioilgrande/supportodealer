import { checkCredentials, createSessionToken, setCookie, json } from '../lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const user = checkCredentials(body.email, body.password);
  if (!user) return json({ error: 'Credenziali non valide' }, 401);

  const token = await createSessionToken(user);
  return json({ ok: true, role: user.role }, 200, { 'Set-Cookie': setCookie(token) });
}
