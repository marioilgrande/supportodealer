// FONTI DELL'ASSISTENTE: tutto quello che il portale info-utili del brand dice,
// in sezioni con un id, cosi' l'AI puo' rispondere citando da dove prende ogni cosa.
//   - schede (procedure, guide, video, prestazioni, anche quelle aggiunte a mano)
//   - offerte in vendita con TUTTE le condizioni (le scadute restano fuori)
//   - contatti pubblici
//   - altre informazioni del portale (fibra, condizioni comuni, operazioni...)
import { sql } from './db.js';
import { getProcedure, getContatti, getOfferte } from './kb.js';
import { testoBlocchi, pulisci } from './brand-sync.js';

const TTL = 60 * 1000;
const cache = new Map();

// "dd/mm/yyyy" -> Date (fine giornata), oppure null
function data(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(s || '').trim());
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 23, 59, 59) : null;
}

async function dettagli(brand) {
  try {
    const [r] = await sql`SELECT dati FROM fonte_brand WHERE brand = ${brand}`;
    return (r && r.dati) || {};
  } catch { return {}; }
}

export async function getFonti(brand) {
  const c = cache.get(brand);
  if (c && Date.now() - c.t < TTL) return c.v;

  const [procedure, contatti, offerteDb, det] = await Promise.all([
    getProcedure(brand), getContatti(brand), getOfferte(brand), dettagli(brand)
  ]);
  const oggi = new Date();
  const sezioni = [];

  for (const p of procedure) {
    if (String(p.id).includes('fissa-')) continue;
    const testo = p.type === 'blocchi' ? testoBlocchi(p.blocchi) : pulisci(p.answer || p.url || '');
    if (!testo) continue;
    sezioni.push({ id: p.id, tipo: 'scheda', titolo: p.label,
      testo: [p.sottotitolo && pulisci(p.sottotitolo), testo, p.keywords.length ? 'Parole chiave: ' + p.keywords.join(', ') : '']
        .filter(Boolean).join('\n') });
  }

  // Offerte in vendita oggi (come fanno i portali: le scadute spariscono da sole)
  const offerte = (det.offerte || []).filter(o => { const al = data(o.al); return !al || al >= oggi; });
  // Le righe identiche in molte offerte (condizioni tecniche, oneri...) si scrivono
  // una volta sola, dicendo a quali offerte valgono: il testo resta preciso ma corto.
  const conta = new Map();
  for (const o of offerte) for (const r of new Set(o.righe)) {
    if (r.length < 30) continue;
    if (!conta.has(r)) conta.set(r, []);
    conta.get(r).push(o.nome);
  }
  const comuni = new Map();   // "A, B, C" -> [righe]
  for (const [r, nomi] of conta) {
    if (nomi.length < 3) continue;
    const k = nomi.length === offerte.length ? 'tutte le offerte' : nomi.join(', ');
    if (!comuni.has(k)) comuni.set(k, []);
    comuni.get(k).push(r);
  }
  const inComune = new Set([...comuni.values()].flat());
  offerte.forEach((o, i) => {
    const dal = data(o.vendibileDal);
    const righe = o.righe.filter(r => !inComune.has(r));
    if (dal && dal > oggi) righe.unshift('ATTENZIONE: vendibile solo dal ' + o.vendibileDal);
    sezioni.push({ id: 'offerta:' + i, tipo: 'offerta', titolo: 'Offerta ' + o.nome, nome: o.nome, testo: righe.join('\n') });
  });
  [...comuni].forEach(([k, righe], i) => {
    sezioni.push({ id: 'comuni:' + i, tipo: 'offerta', titolo: 'Condizioni valide per ' + k, testo: righe.join('\n') });
  });
  // offerte aggiunte a mano dal pannello (non presenti nel portale info-utili)
  const nomiNoti = new Set(offerte.map(o => o.nome.toLowerCase()));
  for (const o of offerteDb) {
    if (nomiNoti.has(String(o.nome || '').toLowerCase())) continue;
    sezioni.push({ id: 'offerta-db:' + sezioni.length, tipo: 'offerta', titolo: 'Offerta ' + o.nome, nome: o.nome,
      testo: [o.tipo && 'tipo: ' + o.tipo, o.segmento && 'segmento: ' + o.segmento, o.luce && 'prezzo luce: ' + o.luce,
              o.gas && 'prezzo gas: ' + o.gas, o.comm && 'commercializzazione: ' + o.comm, o.scadenza && 'scadenza: ' + o.scadenza,
              o.durata && 'durata: ' + o.durata].filter(Boolean).join('\n') });
  }

  for (const c of contatti) {
    sezioni.push({ id: 'contatto:' + c.id, tipo: 'contatto', titolo: [c.area, c.ufficio].filter(Boolean).join(' - '),
      testo: [c.richieste && 'per: ' + c.richieste, c.tel && 'telefono: ' + c.tel, c.email && 'email: ' + c.email,
              c.orari && 'orari: ' + c.orari, c.link && 'link: ' + c.link, c.nota && 'nota: ' + c.nota].filter(Boolean).join('\n') });
  }

  for (const x of (det.extra || [])) {
    sezioni.push({ id: 'info:' + x.chiave, tipo: 'info', titolo: 'Informazioni ' + x.chiave.toLowerCase().replace(/_/g, ' '), testo: x.testo });
  }

  const testo = sezioni.map(s => '[ID: ' + s.id + '] ' + s.titolo + '\n' + s.testo).join('\n\n');
  const v = { sezioni, perId: new Map(sezioni.map(s => [s.id, s])), testo, offerteInVendita: offerte.length };
  cache.set(brand, { t: Date.now(), v });
  return v;
}

/* ---------- controllo anti-invenzione ----------
   Ogni numero della risposta (prezzi, telefoni, giorni, date) deve comparire
   nelle fonti. Se ne manca anche uno, la risposta scritta dall'AI non si usa. */
function numeri(s) {
  return (String(s).match(/\d+(?:[.,]\d+)*/g) || []);
}
function valore(tok) {
  const t = tok.includes(',') ? tok.replace(/\./g, '').replace(',', '.') : (/^\d{1,3}(\.\d{3})+$/.test(tok) ? tok.replace(/\./g, '') : tok);
  const n = Number(t);
  return isFinite(n) ? n : null;
}
export function numeriVerificati(risposta, testoFonti) {
  const piatto = String(testoFonti).replace(/[   ]/g, ' ');
  const valori = new Set(numeri(piatto).map(valore).filter(v => v != null));
  const mancanti = numeri(risposta).filter(tok => !piatto.includes(tok) && !valori.has(valore(tok)));
  return { ok: mancanti.length === 0, mancanti };
}
