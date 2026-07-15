import { json } from '../lib/auth.js';
import { sql, codiceTicket } from '../lib/db.js';
import { interpret } from '../lib/gemini.js';
import { PROCEDURE_BY_ID, filtraOfferte, matchProcedura, RISPOSTE_FISSE } from '../lib/kb.js';
import { codiciNegozio } from '../lib/negozi.js';
import { notificaRosso } from '../lib/email.js';

export const config = { runtime: 'edge' };

const DEALER_SUPPORT = '06 45698346';

// Fallback locale se Gemini non è disponibile: parole-chiave.
function localInterpret(msg) {
  const t = (msg || '').toLowerCase();
  if (/disservizio|portale.*(non funziona|bloccat|down|ko|giù|non va|in errore)|non funziona.*portale|errore 500|non riesco ad accedere|non riesco a caricare/.test(t))
    return { intent: 'disservizio', procedureId: null, offerFilter: null };
  if (/avanzament|non firmati|non firmato|lun.?mer.?ven/.test(t))
    return { intent: 'avanzamento', procedureId: null, offerFilter: null };
  if (/otp/.test(t) && /non arriv|non ricev|non gli arriv|non mi arriv|manca|aspett|non funziona/.test(t))
    return { intent: 'otp', procedureId: null, offerFilter: null };
  const proc = matchProcedura(msg);
  if (proc) return { intent: 'portale', procedureId: proc.id, offerFilter: null };
  if (/offert|promo|sprint|flex|fix|scadenz|prezz|spread|commercializ|tariff/.test(t))
    return { intent: 'offerte', procedureId: null, offerFilter: t };
  if (/cliente|pratica|verific|opportun|a che punto|errore|switch|attivazione|non risulta/.test(t))
    return { intent: 'cliente', procedureId: null, offerFilter: null };
  return { intent: 'unclear', procedureId: null, offerFilter: null };
}

const COLORE = { portale: 'giallo', cliente: 'rosso', offerte: 'verde', disservizio: 'rosso', avanzamento: 'verde', otp: 'giallo', unclear: 'giallo' };
const CATEGORIA = { portale: 'Assistenza portale', cliente: 'Assistenza cliente', offerte: 'Info offerte', disservizio: 'Disservizio portale', avanzamento: 'Richiesta avanzamento', otp: 'OTP non arriva', unclear: 'Da chiarire' };

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const negozioInput = (body.negozio || '').toString().slice(0, 200);
  const messaggio = (body.messaggio || '').toString().slice(0, 2000);
  if (!messaggio.trim()) return json({ error: 'Messaggio vuoto' }, 400);

  // 1) Interpreta (Gemini, con fallback locale)
  let intp = null;
  try { intp = await interpret(messaggio); } catch { /* fallback */ }
  if (!intp || !intp.intent) intp = localInterpret(messaggio);

  const codici = codiciNegozio(negozioInput);
  const codiciOut = { nome: codici.nome || negozioInput, sisSub: codici.sisSub, agenzia: codici.agenzia, trovato: codici.trovato };
  const colore = COLORE[intp.intent] || 'giallo';
  const categoria = CATEGORIA[intp.intent] || 'Da chiarire';

  // 2) Costruisci la risposta dai dati vetted (mai testo generato dall'AI)
  let payload = { type: 'clarify' };
  let rispostaAi = '';

  if (intp.intent === 'portale' && intp.procedureId && PROCEDURE_BY_ID[intp.procedureId]) {
    const p = PROCEDURE_BY_ID[intp.procedureId];
    if (p.type === 'text') {
      payload = { type: 'answer', answer: { kind: 'text', tag: 'Ecco come fare', body: p.answer } };
      rispostaAi = p.answer;
    } else {
      payload = { type: 'answer', answer: { kind: 'link', tag: 'Guida passo-passo', body: 'Ho la guida completa per questa procedura:', url: p.url } };
      rispostaAi = 'Guida: ' + p.url;
    }
  } else if (intp.intent === 'otp') {
    payload = { type: 'answer', answer: { kind: 'text', tag: 'OTP non arriva', body: RISPOSTE_FISSE.otp } };
    rispostaAi = RISPOSTE_FISSE.otp;
  } else if (intp.intent === 'offerte') {
    const offers = filtraOfferte(intp.offerFilter || messaggio);
    payload = { type: 'offers', offers };
    rispostaAi = offers.map(o => `${o.nome}: luce ${o.luce}; gas ${o.gas}; comm ${o.comm}; scad ${o.scadenza}`).join(' | ');
  } else if (intp.intent === 'avanzamento') {
    payload = { type: 'answer', answer: { kind: 'text', tag: 'Avanzamento pratiche', body: RISPOSTE_FISSE.avanzamento } };
    rispostaAi = RISPOSTE_FISSE.avanzamento;
  } else if (intp.intent === 'disservizio') {
    payload = { type: 'support', supportReason: 'disservizio' };
    rispostaAi = `Disservizio portale → Dealer Support ${DEALER_SUPPORT} (SIS-SUB ${codici.sisSub}).`;
  } else if (intp.intent === 'cliente') {
    payload = { type: 'support', supportReason: 'cliente' };
    rispostaAi = `Verifica cliente → Dealer Support ${DEALER_SUPPORT} (SIS-SUB ${codici.sisSub}).`;
  } else {
    // Richiesta ancora da chiarire: non creo un ticket finché non si capisce l'intento
    return json({ ticketId: null, type: 'clarify', colore, codici: codiciOut });
  }

  // 3) Salva il ticket
  let id = 0, codice = '';
  try {
    const [row] = await sql`
      INSERT INTO ticket (negozio, sis_sub, agenzia, categoria, colore, messaggio, risposta_ai, esito)
      VALUES (${codici.nome || negozioInput}, ${codici.sisSub}, ${codici.agenzia},
              ${categoria}, ${colore}, ${messaggio}, ${rispostaAi}, 'in_attesa')
      RETURNING id
    `;
    id = Number(row.id);
    codice = codiceTicket(id);
    await sql`UPDATE ticket SET codice = ${codice} WHERE id = ${id}`;
  } catch (err) {
    return json({ error: 'DB: ' + (err.message || 'errore') }, 500);
  }

  // 4) Notifica immediata per i rossi (non blocca la risposta)
  if (colore === 'rosso') {
    try { await notificaRosso({ codice, negozio: codici.nome || negozioInput, categoria, messaggio }); } catch {}
  }

  return json({ ticketId: id, codice, colore, codici: codiciOut, ...payload });
}
