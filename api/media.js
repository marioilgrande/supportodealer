// Video, copertine e moduli dei portali info-utili, serviti al dealer.
// I file restano solo nel portale di origine (niente copie da tenere allineate):
// qui li si legge con la chiave condivisa e li si passa al browser.
// Inoltra l'intestazione Range, cosi' i capitoli dei video saltano al minuto giusto.
import { FONTI } from '../lib/brand-sync.js';

export const config = { runtime: 'edge' };

const AMMESSI = /^assets\/(video|moduli|cte)\/[A-Za-z0-9._ -]+\.(mp4|jpg|jpeg|png|webp|pdf)$/;

export default async function handler(request) {
  const u = new URL(request.url);
  const brand = u.searchParams.get('b') || '';
  const file = u.searchParams.get('f') || '';
  if (!FONTI[brand] || !AMMESSI.test(file) || file.includes('..')) {
    return new Response('Non trovato', { status: 404 });
  }

  const headers = { 'x-supporto-token': process.env.SUPPORTO_TOKEN || '' };
  const range = request.headers.get('range');
  if (range) headers.range = range;

  const r = await fetch(FONTI[brand].url + file.split('/').map(encodeURIComponent).join('/'), { headers, redirect: 'manual' });
  if (r.status !== 200 && r.status !== 206) return new Response('Non disponibile', { status: r.status === 404 ? 404 : 502 });

  const out = new Headers();
  for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const v = r.headers.get(k); if (v) out.set(k, v);
  }
  out.set('accept-ranges', 'bytes');
  out.set('cache-control', 'public, max-age=3600, s-maxage=86400');
  return new Response(r.body, { status: r.status, headers: out });
}
