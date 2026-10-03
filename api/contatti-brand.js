import { json } from '../lib/auth.js';
import { getContatti, isBrand } from '../lib/kb.js';

export const config = { runtime: 'edge' };

// Contatti del brand per il dealer (sostituiscono Dealer Support + SIS/SUB).
// Qui arrivano SOLO i contatti pubblici: quelli marcati riservato:true nei
// portali info-utili non vengono importati dal sync.
export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const brand = isBrand(body.brand) ? body.brand : '';
  if (!brand) return json({ error: 'brand mancante' }, 400);
  return json({ ok: true, brand, contatti: await getContatti(brand) });
}
