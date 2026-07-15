import { clearCookie, json } from '../lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler() {
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
}
