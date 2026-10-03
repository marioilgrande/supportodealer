// Knowledge base multi-brand: procedure/risposte, offerte e contatti.
// FONTE = database (tabelle `procedura`, `offerta`, `contatto`), filtrate per brand.
// I contenuti arrivano dai portali info-utili tramite strumenti/sync-brand.cjs
// (righe con origine='sync') e da quello che Mario aggiunge dal pannello
// (origine='manuale'). Non c'e' piu' alcun contenuto ACEA.
import { sql } from './db.js';

export const BRANDS = [
  { id: 'plenitude', nome: 'Plenitude' },
  { id: 'sorgenia',  nome: 'Sorgenia'  },
  { id: 'alperia',   nome: 'Alperia'   }
];
export const isBrand = (b) => BRANDS.some(x => x.id === b);

// Risposte fisse, valide per tutti i brand (modificabili come procedure "fissa-*").
const FALLBACK_FISSE = {
  avanzamento: "L'avanzamento te lo manda Mario come sempre il LUN-MER-VEN, insieme agli eventuali KO o NON FIRMATI."
};

// Cache in memoria per istanza serverless calda, una voce per brand.
const TTL = 60 * 1000;
const cache = { proc: new Map(), off: new Map(), cont: new Map() };
const fresca = (m, k) => m.has(k) && (Date.now() - m.get(k).t < TTL);
const metti = (m, k, v) => { m.set(k, { t: Date.now(), v }); return v; };

function rowToProcedura(r) {
  const tipo = ['link', 'supporto', 'blocchi'].includes(r.tipo) ? r.tipo : 'text';
  return {
    id: r.id,
    brand: r.brand || '',
    label: r.titolo || '',
    sottotitolo: r.sottotitolo || '',
    etichetta: r.etichetta || '',
    type: tipo,
    answer: r.risposta || '',
    url: r.url || '',
    blocchi: Array.isArray(r.blocchi) ? r.blocchi : [],
    keywords: (r.keywords || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  };
}

export async function getProcedure(brand = '') {
  const k = brand || '*';
  if (fresca(cache.proc, k)) return cache.proc.get(k).v;
  try {
    const rows = brand
      ? await sql`SELECT id, brand, titolo, sottotitolo, etichetta, keywords, tipo, risposta, url, blocchi
                  FROM procedura WHERE attiva = TRUE AND brand = ${brand} ORDER BY sort_order, id`
      : await sql`SELECT id, brand, titolo, sottotitolo, etichetta, keywords, tipo, risposta, url, blocchi
                  FROM procedura WHERE attiva = TRUE ORDER BY sort_order, id`;
    return metti(cache.proc, k, (rows || []).map(rowToProcedura));
  } catch (e) {
    console.error('KB procedure DB error:', e.message);
    return [];
  }
}

export async function getOfferte(brand = '') {
  const k = brand || '*';
  if (fresca(cache.off, k)) return cache.off.get(k).v;
  try {
    const rows = brand
      ? await sql`SELECT nome, tipo, scadenza, durata, luce, gas, comm, segmento
                  FROM offerta WHERE attiva = TRUE AND brand = ${brand} ORDER BY sort_order, id`
      : await sql`SELECT nome, tipo, scadenza, durata, luce, gas, comm, segmento
                  FROM offerta WHERE attiva = TRUE ORDER BY sort_order, id`;
    return metti(cache.off, k, rows || []);
  } catch (e) {
    console.error('KB offerte DB error:', e.message);
    return [];
  }
}

// Contatti del brand: sostituiscono il Dealer Support ACEA e i codici SIS/SUB.
export async function getContatti(brand = '') {
  const k = brand || '*';
  if (fresca(cache.cont, k)) return cache.cont.get(k).v;
  try {
    const rows = brand
      ? await sql`SELECT id, brand, area, ufficio, richieste, tel, email, orari, link, nota
                  FROM contatto WHERE attivo = TRUE AND brand = ${brand} ORDER BY sort_order, id`
      : await sql`SELECT id, brand, area, ufficio, richieste, tel, email, orari, link, nota
                  FROM contatto WHERE attivo = TRUE ORDER BY sort_order, id`;
    return metti(cache.cont, k, rows || []);
  } catch (e) {
    console.error('KB contatti DB error:', e.message);
    return [];
  }
}

// Svuota la cache: dopo una modifica dal pannello Contenuti o dopo un sync.
export function invalidaCache() { cache.proc.clear(); cache.off.clear(); cache.cont.clear(); }

export async function getProceduraById(id) {
  if (!id) return null;
  try {
    const [r] = await sql`SELECT id, brand, titolo, sottotitolo, etichetta, keywords, tipo, risposta, url, blocchi
                          FROM procedura WHERE id = ${id} AND attiva = TRUE`;
    return r ? rowToProcedura(r) : null;
  } catch (e) {
    console.error('KB procedura by id error:', e.message);
    return null;
  }
}

// Testi fissi (es. avanzamento): procedure con id "fissa-<chiave>".
export async function rispostaFissa(key) {
  const p = await getProceduraById('fissa-' + key);
  return (p && p.answer) ? p.answer : (FALLBACK_FISSE[key] || '');
}

export async function filtraOfferte(q, brand = '') {
  const all = await getOfferte(brand);
  const t = (q || '').toLowerCase();
  let items = all.slice();
  if (/business|p\.?\s?iva|azienda|impresa/.test(t)) {
    const f = items.filter(o => (o.segmento || '') === 'business');
    if (f.length) items = f;
  } else if (/domestic|casa|privat|residenzial/.test(t)) {
    const f = items.filter(o => (o.segmento || '') === 'domestico');
    if (f.length) items = f;
  }
  // se il dealer nomina una famiglia di offerta, tengo solo quelle
  const perNome = items.filter(o => {
    const n = (o.nome || '').toLowerCase();
    return n && n.split(/\s+/).some(w => w.length >= 4 && t.includes(w));
  });
  return perNome.length ? perNome : items;
}

// Trova la PRIMA procedura del brand che combacia con le parole chiave.
export async function matchProcedura(msg, brand = '') {
  const t = (msg || '').toLowerCase();
  const list = await getProcedure(brand);
  for (const p of list) {
    if (p.id && p.id.includes('fissa-')) continue;
    if ((p.keywords || []).some(k => t.includes(k))) return p;
  }
  return null;
}

// Tutte le procedure del brand che combaciano (per disambiguare piu' argomenti).
export async function matchProcedure(msg, brand = '') {
  const t = (msg || '').toLowerCase();
  const list = await getProcedure(brand);
  const out = [];
  for (const p of list) {
    if (p.id && p.id.includes('fissa-')) continue;
    if ((p.keywords || []).some(k => t.includes(k))) out.push(p);
  }
  return out;
}
