import { json } from '../lib/auth.js';
import { sql, codiceTicket } from '../lib/db.js';
import { interpret } from '../lib/gemini.js';
import {
  BRANDS, isBrand, getProcedure, getProceduraById, getContatti,
  filtraOfferte, matchProcedure, rispostaFissa
} from '../lib/kb.js';

export const config = { runtime: 'edge' };

// Fallback locale se Gemini non e' disponibile: parole-chiave.
async function localInterpret(msg, brand) {
  const t = (msg || '').toLowerCase();
  if (/avanzament|non firmati|non firmato|lun.?mer.?ven/.test(t))
    return { intent: 'avanzamento', procedureId: null, offerFilter: null };
  if (/chi (devo )?(contatt|chiam|scriv)|a chi mi rivolgo|numero|telefono|email|mail|contatt|assistenza|help desk|supporto/.test(t))
    return { intent: 'contatti', procedureId: null, offerFilter: null };
  if (/offert|promo|prezz|spread|scadenz|commercializ|tariff|fee|listino/.test(t))
    return { intent: 'offerte', procedureId: null, offerFilter: t };
  return { intent: 'unclear', procedureId: null, offerFilter: null };
}

const COLORE    = { portale: 'giallo', contatti: 'rosso', offerte: 'verde', avanzamento: 'verde', unclear: 'giallo' };
const CATEGORIA = { portale: 'Procedura', contatti: 'Chi contattare', offerte: 'Info offerte', avanzamento: 'Richiesta avanzamento', unclear: 'Da chiarire' };

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const brand = isBrand(body.brand) ? body.brand : '';
  if (!brand) return json({ error: 'Scegli prima il brand', type: 'serve-brand', brands: BRANDS }, 400);

  const negozio   = (body.negozio || '').toString().slice(0, 200).trim();
  const messaggio = (body.messaggio || '').toString().slice(0, 2000);
  if (!messaggio.trim()) return json({ error: 'Messaggio vuoto' }, 400);

  const nomeBrand = (BRANDS.find(b => b.id === brand) || {}).nome || brand;

  // 1) Interpreta la richiesta (sempre dentro il brand scelto).
  const forcedId = (body.proceduraId || '').toString().slice(0, 80);
  let intp;
  if (forcedId) {
    intp = { intent: 'portale', procedureId: forcedId, offerFilter: null };
  } else {
    const procedure = await getProcedure(brand);
    intp = null;
    try { intp = await interpret(messaggio, procedure, nomeBrand); } catch { /* fallback */ }
    if (!intp || !intp.intent) intp = await localInterpret(messaggio, brand);

    // Le parole chiave hanno la meglio: l'AI non le vede (riceve solo titolo+id).
    // Una sola procedura -> rispondo con quella; piu' di una -> chiedo quale.
    const senzaProcedura = intp.intent === 'portale' && !intp.procedureId;
    if (senzaProcedura || ['contatti', 'unclear'].includes(intp.intent)) {
      const matches = await matchProcedure(messaggio, brand);
      if (matches.length === 1) {
        intp = { intent: 'portale', procedureId: matches[0].id, offerFilter: null };
      } else if (matches.length >= 2) {
        return json({
          ticketId: null, type: 'scegli-argomento', brand, colore: 'giallo',
          candidati: matches.slice(0, 5).map(p => ({ id: p.id, label: p.label }))
        });
      }
    }
  }

  const colore    = COLORE[intp.intent] || 'giallo';
  const categoria = CATEGORIA[intp.intent] || 'Da chiarire';

  // 2) Risposta costruita sui dati verificati (mai testo generato dall'AI)
  let payload = { type: 'clarify' };
  let rispostaAi = '';

  const proc = intp.intent === 'portale' && intp.procedureId ? await getProceduraById(intp.procedureId) : null;

  if (proc) {
    if (proc.type === 'blocchi') {
      payload = { type: 'scheda', scheda: { titolo: proc.label, sottotitolo: proc.sottotitolo, etichetta: proc.etichetta, blocchi: proc.blocchi } };
      rispostaAi = proc.label;
    } else if (proc.type === 'contatti' || proc.type === 'supporto') {
      payload = { type: 'contatti', contatti: await getContatti(brand) };
      rispostaAi = 'Contatti ' + nomeBrand;
    } else if (proc.type === 'link') {
      payload = { type: 'answer', answer: { kind: 'link', tag: 'Guida passo-passo', body: 'Ho la guida completa per questa procedura:', url: proc.url } };
      rispostaAi = 'Guida: ' + proc.url;
    } else {
      payload = { type: 'answer', answer: { kind: 'text', tag: 'Ecco come fare', body: proc.answer } };
      rispostaAi = proc.answer;
    }
  } else if (intp.intent === 'offerte') {
    const offers = await filtraOfferte(intp.offerFilter || messaggio, brand);
    payload = { type: 'offers', offers };
    rispostaAi = offers.map(o => `${o.nome}: ${o.luce || o.gas || ''} comm ${o.comm}`).join(' | ').slice(0, 2000);
  } else if (intp.intent === 'avanzamento') {
    const testo = await rispostaFissa('avanzamento');
    payload = { type: 'answer', answer: { kind: 'text', tag: 'Avanzamento pratiche', body: testo } };
    rispostaAi = testo;
  } else if (intp.intent === 'contatti') {
    payload = { type: 'contatti', contatti: await getContatti(brand) };
    rispostaAi = 'Contatti ' + nomeBrand;
  } else {
    // Non si capisce ancora: nessun ticket finche' non e' chiaro cosa serve.
    return json({ ticketId: null, type: 'clarify', brand, colore });
  }

  // 3) Salva il ticket
  let id = 0, codice = '';
  try {
    const [row] = await sql`
      INSERT INTO ticket (brand, negozio, sis_sub, agenzia, categoria, colore, messaggio, risposta_ai, esito)
      VALUES (${brand}, ${negozio}, '', '', ${categoria}, ${colore}, ${messaggio}, ${rispostaAi}, 'in_attesa')
      RETURNING id`;
    id = Number(row.id);
    codice = codiceTicket(id);
    await sql`UPDATE ticket SET codice = ${codice} WHERE id = ${id}`;
  } catch (err) {
    return json({ error: 'DB: ' + (err.message || 'errore') }, 500);
  }

  return json({ ticketId: id, codice, brand, colore, ...payload });
}
