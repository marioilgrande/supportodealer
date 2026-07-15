import { json } from '../lib/auth.js';
import { sql } from '../lib/db.js';

export const config = { runtime: 'edge' };

// Il dealer indica se la risposta automatica è bastata.
export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const id = Number(body.ticketId);
  if (!id) return json({ error: 'ticketId mancante' }, 400);
  const esito = body.bastata ? 'bastata' : 'non_bastata';

  try {
    await sql`UPDATE ticket SET esito = ${esito}, updated_at = NOW() WHERE id = ${id}`;
  } catch (err) {
    return json({ error: 'DB: ' + (err.message || 'errore') }, 500);
  }
  return json({ ok: true });
}
