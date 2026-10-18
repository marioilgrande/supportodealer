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
    conta.get(r).push(o);
  }
  // nel titolo anche luce/gas e domestico/business: aiuta a scegliere la sezione giusta
  const genere = (lista) => {
    const c = [...new Set(lista.map(o => o.c).filter(Boolean))].join(' e ');
    const g = [...new Set(lista.map(o => o.seg).filter(Boolean))].join(' e ');
    return [c, g].filter(Boolean).join(' ');
  };
  const comuni = new Map();   // titolo -> [righe]
  for (const [r, lista] of conta) {
    if (lista.length < 3) continue;
    const k = (lista.length === offerte.length ? 'tutte le offerte' : 'le offerte ' + genere(lista) + ': ' + lista.map(o => o.nome).join(', '));
    if (!comuni.has(k)) comuni.set(k, []);
    comuni.get(k).push(r);
  }
  const inComune = new Set([...comuni.values()].flat());
  offerte.forEach((o, i) => {
    const dal = data(o.vendibileDal);
    const righe = o.righe.filter(r => !inComune.has(r));
    if (dal && dal > oggi) righe.unshift('ATTENZIONE: vendibile solo dal ' + o.vendibileDal);
    const tipoOff = genere([o]);
    sezioni.push({ id: 'offerta:' + i, tipo: 'offerta', titolo: 'Offerta ' + o.nome + (tipoOff ? ' (' + tipoOff + ')' : ''), nome: o.nome, testo: righe.join('\n') });
  });
  [...comuni].forEach(([k, righe], i) => {
    sezioni.push({ id: 'comuni:' + i, tipo: 'offerta', titolo: 'Condizioni valide per ' + k, testo: righe.join('\n') });
  });
  // offerte aggiunte a mano dal pannello (non presenti nel portale info-utili)
  // (i nomi si confrontano con TUTTE le offerte del portale, anche scadute: quelle
  // scadute non devono rientrare da qui; e le manuali scadute restano fuori)
  const nomiNoti = new Set((det.offerte || []).map(o => o.nome.toLowerCase()));
  for (const o of offerteDb) {
    if (nomiNoti.has(String(o.nome || '').toLowerCase())) continue;
    const sc = data(o.scadenza);
    if (sc && sc < oggi) continue;
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
  const v = { sezioni, perId: new Map(sezioni.map(s => [s.id, s])), testo, versione: firma(testo), offerteInVendita: offerte.length };
  cache.set(brand, { t: Date.now(), v });
  return v;
}

// Impronta veloce di un testo (FNV-1a): serve a capire se una sezione e' cambiata.
export function firma(t) {
  let h = 0x811c9dc5;
  const s = String(t || '');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
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

/* ---------- scelta delle sezioni pertinenti ----------
   Mandare all'AI tutto il portale a ogni domanda costa troppo (limite di richieste
   del piano gratuito) ed e' lento. Qui si scelgono le sezioni che c'entrano con
   la domanda (parole in comune, pesate per rarita'), fino a un tetto di testo. */
const VUOTE = new Set(('il lo la i gli le un uno una di a da in con su per tra fra e o che non del della dei delle al alla ai alle ' +
  'dal dalla nel nella sul sulla come cosa quando dove quale quali chi se si ti ci vi mi ne mio tuo suo sono essere fare puo posso ' +
  'devo deve va ho ha hai anche ma piu meno molto tutto tutti questo questa quello quella sempre gia per cliente clienti fino ' +
  'plenitude sorgenia alperia').split(/\s+/));
export function radici(testo) {
  return String(testo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !VUOTE.has(w)).map(w => w.slice(0, 6));
}
// Chiave della memoria delle risposte: le parole importanti, senza ordine.
export function chiaveDomanda(msg) {
  return [...new Set(radici(msg))].sort().join(' ').slice(0, 300);
}
const SPINTE = [
  { re: /numer|telefon|chiam|mail|contatt|rivolg|assistenz|help|ufficio|supporto|scriv/i, tipo: 'contatto', peso: 3 },
  { re: /offert|prezz|spread|fiss|variabil|listino|scadenz|promo|scont|quota|vend|costa|cost/i, tipo: 'offerta', peso: 1.5 }
];

export function sezioniPertinenti(fonti, domanda) {
  if (!fonti._indice) {
    fonti._indice = fonti.sezioni.map(s => ({ s, tit: new Set(radici(s.titolo)), txt: new Set(radici(s.titolo + ' ' + s.testo)) }));
    const df = new Map();
    for (const x of fonti._indice) for (const r of x.txt) df.set(r, (df.get(r) || 0) + 1);
    fonti._df = df;
  }
  const N = fonti._indice.length;
  const q = [...new Set(radici(domanda))];
  const spinte = SPINTE.filter(x => x.re.test(domanda));
  const punteggi = fonti._indice.map(x => {
    let p = 0;
    for (const r of q) {
      if (!x.txt.has(r)) continue;
      const idf = Math.log(1 + N / (fonti._df.get(r) || 1));
      p += idf * (x.tit.has(r) ? 3 : 1);
    }
    if (p > 0) for (const sp of spinte) if (x.s.tipo === sp.tipo) p += sp.peso;
    return { s: x.s, p };
  }).filter(x => x.p > 0).sort((a, b) => b.p - a.p);
  return punteggi;
}

export function testoPertinente(fonti, domanda, tetto = 26000) {
  const punteggi = sezioniPertinenti(fonti, domanda);
  const scelte = [];
  let usati = 0;
  for (const { s } of punteggi) {
    const blocco = '[ID: ' + s.id + '] ' + s.titolo + '\n' + s.testo;
    if (usati + blocco.length > tetto && scelte.length >= 4) continue;
    scelte.push(blocco); usati += blocco.length + 2;
  }
  // Nessuna parola in comune: le schede operative sono la base piu' probabile.
  if (!scelte.length) {
    for (const s of fonti.sezioni.filter(x => x.tipo === 'scheda')) {
      const blocco = '[ID: ' + s.id + '] ' + s.titolo + '\n' + s.testo;
      if (usati + blocco.length > tetto) break;
      scelte.push(blocco); usati += blocco.length + 2;
    }
  }
  // Indice di tutto quello che esiste, cosi' l'AI sa cosa c'e' anche se non e' tra gli estratti.
  const indice = 'Argomenti presenti nel portale: ' + fonti.sezioni.filter(s => s.tipo !== 'contatto').map(s => s.titolo).join('; ');
  return indice + '\n\n' + scelte.join('\n\n');
}
