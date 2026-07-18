import { json } from '../lib/auth.js';
import { sql, codiceTicket } from '../lib/db.js';
import { estraiBolletta } from '../lib/gemini.js';
import { cercaNegozio } from '../lib/negozi.js';

export const config = { runtime: 'edge' };

// Il comparatore ACEA (fonte unica delle formule/indici). Il portale NON calcola
// nulla: legge i dati dalla bolletta e apre QUESTO comparatore già compilato.
const COMPARATORE_URL = 'https://comparatore2k.vercel.app/';

// base64 url-safe del payload da mettere nell'hash del comparatore.
function encodePayload(obj) {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  return b64.replace(/\+/g, '-').replace(/\//g, '_');
}

const num = (v) => {
  const n = parseFloat(v);
  return isFinite(n) ? n : 0;
};

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const pdf = (body.pdf || '').toString();
  const mime = (body.mime || 'application/pdf').toString();
  const negozioInput = (body.negozio || '').toString().slice(0, 200);
  const nota = (body.nota || '').toString().slice(0, 500);

  if (!pdf) return json({ error: 'Nessun file' }, 400);
  // Niente OCR: accettiamo solo PDF con testo (le foto/scansioni non sono affidabili).
  if (!/pdf/i.test(mime)) {
    return json({ type: 'no-pdf', error: 'Per l\'analisi serve la bolletta in PDF: carica il PDF originale del fornitore, non una foto.' });
  }

  // 1) Estrazione dati dalla bolletta (Gemini legge il PDF)
  let estr = { dati: null, errore: 'servizio' };
  try { estr = await estraiBolletta(pdf, mime); } catch { /* gestito sotto */ }
  const dati = estr && estr.dati;
  const AVVISO_ORIGINALE = ' Ricorda: dev\'essere il PDF originale scaricato dal sito o dall\'app del fornitore. Una scansione o una foto salvata in PDF non contiene il testo, quindi non riesco a leggere i dati.';

  // Servizio momentaneamente al limite/non disponibile: NON è colpa del file, si riprova
  if (!dati && estr && (estr.errore === 'quota' || estr.errore === 'servizio' || estr.errore === 'config')) {
    return json({ type: 'occupato', error: 'Il servizio di lettura bollette è momentaneamente molto richiesto e ha raggiunto il limite. Non è un problema del tuo file: riprova tra qualche minuto o più tardi.' });
  }
  if (!dati || (!dati.gas && !dati.luce)) {
    return json({ type: 'illeggibile', error: 'Non sono riuscito a leggere i dati dalla bolletta.' + AVVISO_ORIGINALE });
  }
  if (dati.affidabile === false) {
    return json({ type: 'illeggibile', error: (dati.note ? dati.note + ' ' : 'La bolletta non è abbastanza leggibile per un\'analisi affidabile.') + AVVISO_ORIGINALE });
  }

  const mesi = Array.isArray(dati.mesi) ? dati.mesi.map(m => String(m).toLowerCase().trim()).filter(Boolean) : [];
  const g = dati.gas || null;
  const l = dati.luce || null;

  // 2) Payload per il comparatore (stesse chiavi dei campi del comparatore)
  const payload = {
    tipoCliente: dati.tipoCliente === 'business' ? 'business' : 'domestico',
    nomeCliente: (dati.intestatario || '').toString().slice(0, 120),
    mesiLuce: mesi,
    mesiGas: mesi,
    kwhFatturati: l ? num(l.kwhFatturati) : '',
    quotaConsumiLuce: l ? num(l.quotaConsumi) : '',
    quotaFissaLuce: l ? num(l.quotaFissa) : '',
    mcFatturati: g ? num(g.smcFatturati) : '',
    quotaConsumiGas: g ? num(g.quotaConsumi) : '',
    quotaFissaGas: g ? num(g.quotaFissa) : ''
  };
  const url = COMPARATORE_URL + '#b=' + encodePayload(payload);

  // 3) Riepilogo per mostrarlo nel portale prima di aprire il comparatore
  const riepilogo = {
    servizio: dati.servizio || (g && l ? 'entrambi' : g ? 'gas' : 'luce'),
    tipoCliente: payload.tipoCliente,
    intestatario: dati.intestatario || null,
    fornitore: dati.fornitore || null,
    nomeOfferta: dati.nomeOfferta || null,
    mesi,
    consumoAnnuo: dati.consumoAnnuo || null,
    gas: g ? { smc: num(g.smcFatturati), quotaConsumi: num(g.quotaConsumi), quotaFissa: num(g.quotaFissa), costoAttuale: num(g.quotaConsumi) + num(g.quotaFissa) } : null,
    luce: l ? { kwh: num(l.kwhFatturati), quotaConsumi: num(l.quotaConsumi), quotaFissa: num(l.quotaFissa), costoAttuale: num(l.quotaConsumi) + num(l.quotaFissa) } : null
  };

  // 4) Log ticket (best effort: se il DB non c'è, l'analisi funziona lo stesso)
  let ticketId = null, codice = '';
  try {
    const ric = await cercaNegozio(negozioInput);
    const nomeNeg = ric.stato === 'trovato' ? ric.nome : (negozioInput || '—');
    const parti = [];
    if (riepilogo.gas) parti.push(`gas ${riepilogo.gas.smc} Smc, attuale ${riepilogo.gas.costoAttuale.toFixed(2)} €`);
    if (riepilogo.luce) parti.push(`luce ${riepilogo.luce.kwh} kWh, attuale ${riepilogo.luce.costoAttuale.toFixed(2)} €`);
    const riassunto = `Analisi bolletta${riepilogo.fornitore ? ' (' + riepilogo.fornitore + ')' : ''} — ${parti.join('; ')} — periodo ${mesi.join(', ') || 'n/d'}`;
    const [row] = await sql`
      INSERT INTO ticket (negozio, sis_sub, agenzia, categoria, colore, messaggio, risposta_ai, esito)
      VALUES (${nomeNeg}, ${ric.sisSub || ''}, ${ric.agenzia || ''},
              'Analisi bolletta', 'verde', ${nota || riassunto}, ${riassunto}, 'in_attesa')
      RETURNING id`;
    ticketId = Number(row.id);
    codice = codiceTicket(ticketId);
    await sql`UPDATE ticket SET codice = ${codice} WHERE id = ${ticketId}`;
  } catch (err) {
    // il DB non è indispensabile per restituire l'analisi
  }

  return json({ type: 'bolletta', ticketId, codice, riepilogo, url });
}
