import { json } from '../lib/auth.js';
import { sql, codiceTicket } from '../lib/db.js';
import { interpret, rispondiDaFonti } from '../lib/gemini.js';
import { getFonti, numeriVerificati } from '../lib/fonti.js';
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

// Mette per primi i contatti che c'entrano con la domanda: chi chiede "il numero
// della check call" deve trovarsi quel riferimento in cima, non in fondo all'elenco.
function ordinaContatti(lista, messaggio) {
  const parole = String(messaggio || '').toLowerCase().split(/[^a-z0-9\u00e0-\u00ff]+/).filter(w => w.length >= 4);
  const punteggio = (c) => {
    const campo = [c.ufficio, c.area, c.richieste, c.nota].join(' ').toLowerCase();
    let p = 0;
    for (const w of parole) if (campo.includes(w)) p += 2;
    for (let i = 0; i < parole.length - 1; i++) if (campo.includes(parole[i] + ' ' + parole[i + 1])) p += 3;
    return p;
  };
  return (lista || []).map(c => ({ c, p: punteggio(c) }))
    .sort((a, b) => b.p - a.p)
    .map(x => x.c);
}


// In anteprima (mai in produzione) le domande di prova non creano richieste nello storico.
let PROVA = false;
// Risposte dalle fonti: attive in anteprima, in produzione dopo il collaudo.
const RISPOSTE_FONTI = process.env.VERCEL_ENV !== 'production';

async function salvaTicket(brand, negozio, categoria, colore, messaggio, rispostaAi) {
  if (PROVA) return { id: 0, codice: 'PROVA' };
  const [row] = await sql`
    INSERT INTO ticket (brand, negozio, sis_sub, agenzia, categoria, colore, messaggio, risposta_ai, esito)
    VALUES (${brand}, ${negozio}, '', '', ${categoria}, ${colore}, ${messaggio}, ${rispostaAi}, 'in_attesa')
    RETURNING id`;
  const id = Number(row.id);
  const codice = codiceTicket(id);
  await sql`UPDATE ticket SET codice = ${codice} WHERE id = ${id}`;
  return { id, codice };
}

/* Risposta scritta dall'AI leggendo le fonti del brand (lib/fonti.js).
   Ritorna la Response da inviare, { intent } per proseguire col flusso classico,
   oppure null se la risposta non supera i controlli (si usa il flusso classico). */
async function daFonti(ai, fonti, ctx) {
  const { brand, negozio, messaggio, nomeBrand } = ctx;

  if (ai.esito === 'avanzamento') return { intent: 'avanzamento' };

  if (ai.esito === 'chiarimento') {
    const opzioni = (ai.opzioni || []).map(x => String(x).trim()).filter(Boolean).slice(0, 4);
    if (opzioni.length >= 2 && ai.domanda) {
      return json({ ticketId: null, type: 'chiarimento', brand, colore: 'giallo', domanda: String(ai.domanda), opzioni });
    }
    return null;
  }

  const contattiTutti = await getContatti(brand);

  if (ai.esito === 'non_trovato') {
    const testo = String(ai.risposta || '').trim() || ('Nelle informazioni ' + nomeBrand + ' non trovo questo dato.');
    const t = await salvaTicket(brand, negozio, 'Non trovato nelle fonti', 'rosso', messaggio, testo);
    return json({ ticketId: t.id, codice: t.codice, brand, colore: 'rosso', type: 'non-trovato',
                  testo, contatti: ordinaContatti(contattiTutti, messaggio) });
  }

  // esito risposta / contatti: le fonti citate devono esistere davvero
  const ids = [...new Set((ai.fonti || []).map(String))].filter(id => fonti.perId.has(id)).slice(0, 6);
  if (!ids.length) return null;
  const citate = ids.map(id => fonti.perId.get(id));
  const testo = String(ai.risposta || '').trim();
  const procedure = await getProcedure(brand);
  const schede = citate.filter(s => s.tipo === 'scheda')
    .map(s => procedure.find(p => p.id === s.id)).filter(Boolean).slice(0, 3);

  // Anti-invenzione: un numero che non sta nelle fonti fa scartare il testo scritto
  // dall'AI. Resta la scheda ufficiale citata, se c'e'.
  if (!testo || !numeriVerificati(testo, fonti.testo).ok) {
    const p = schede.find(x => x.type === 'blocchi');
    if (!p) return null;
    const t = await salvaTicket(brand, negozio, 'Procedura', 'giallo', messaggio, p.label);
    return json({ ticketId: t.id, codice: t.codice, brand, colore: 'giallo', type: 'scheda',
                  scheda: { titolo: p.label, sottotitolo: p.sottotitolo, etichetta: p.etichetta, blocchi: p.blocchi } });
  }

  const idContatti = new Set(citate.filter(s => s.tipo === 'contatto').map(s => s.id.slice('contatto:'.length)));
  const contatti = contattiTutti.filter(c => idContatti.has(String(c.id)));
  const conOfferte = citate.some(s => s.tipo === 'offerta');
  const categoria = ai.esito === 'contatti' ? 'Chi contattare' : (conOfferte ? 'Info offerte' : 'Procedura');
  const colore    = ai.esito === 'contatti' ? 'rosso' : (conOfferte ? 'verde' : 'giallo');

  const t = await salvaTicket(brand, negozio, categoria, colore, messaggio,
    (testo + '\n[fonti: ' + citate.map(s => s.titolo).join(' | ') + ']').slice(0, 4000));
  return json({
    ticketId: t.id, codice: t.codice, brand, colore, type: 'risposta',
    testo,
    fonti: citate.map(s => ({ id: s.id, tipo: s.tipo, titolo: s.titolo })),
    schede: schede.map(p => ({ id: p.id, titolo: p.label, sottotitolo: p.sottotitolo, etichetta: p.etichetta,
                               blocchi: p.type === 'blocchi' ? p.blocchi : [{ tipo: 'info', testo: p.answer || '' }] })),
    contatti
  });
}

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
  PROVA = process.env.VERCEL_ENV !== 'production' && body.prova === true;

  // 1) Interpreta la richiesta (sempre dentro il brand scelto).
  const forcedId = (body.proceduraId || '').toString().slice(0, 80);
  let intp;
  if (forcedId) {
    intp = { intent: 'portale', procedureId: forcedId, offerFilter: null };
  } else {
    // 1a) Risposta scritta leggendo tutte le fonti del brand, con citazioni e
    //     controllo dei numeri. Se l'AI non c'e' o il controllo non passa, si
    //     prosegue col metodo classico (scelta della scheda + parole chiave).
    if (RISPOSTE_FONTI) try {
      const fonti = await getFonti(brand);
      if (fonti.sezioni.length) {
        const ai = await rispondiDaFonti(messaggio, fonti.testo, nomeBrand);
        if (ai) {
          const r = await daFonti(ai, fonti, { brand, negozio, messaggio, nomeBrand });
          if (r instanceof Response) return r;
          if (r && r.intent) intp = { intent: r.intent, procedureId: null, offerFilter: null };
        }
      }
    } catch (e) { /* flusso classico */ }
  }
  if (!intp) {
    const procedure = await getProcedure(brand);
    intp = null;
    try { intp = await interpret(messaggio, procedure, nomeBrand); } catch { /* fallback */ }
    if (!intp || !intp.intent) intp = await localInterpret(messaggio, brand);

    // Le parole chiave hanno la meglio: l'AI non le vede (riceve solo titolo+id).
    // NOTA: se il dealer chiede un contatto (un numero, una mail) NON si dirotta
    // su una procedura, altrimenti chiedendo "il numero della check call" si
    // finisce sulla procedura della check call invece che sul contatto.
    const matches = await matchProcedure(messaggio, brand);
    const senzaProcedura = intp.intent === 'portale' && !intp.procedureId;

    // Costo/tempi di un intervento sul contatore: l'AI tende a leggerlo come una
    // domanda sulle offerte commerciali. Le keyword della scheda prestazioni sono
    // solo nomi di operazioni, quindi se combacia la domanda parla davvero di quelle.
    const prestazioni = matches.find(p => /(^|:)costi-prestazioni$/.test(p.id));
    const chiedeCosto = /cost|quanto|prezz|tariff|spes|tempi/i.test(messaggio);

    if (intp.intent === 'offerte' && prestazioni && chiedeCosto) {
      intp = { intent: 'portale', procedureId: prestazioni.id, offerFilter: null };
    } else if (senzaProcedura || intp.intent === 'unclear') {
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
      payload = { type: 'contatti', contatti: ordinaContatti(await getContatti(brand), messaggio) };
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
    payload = { type: 'contatti', contatti: ordinaContatti(await getContatti(brand), messaggio) };
    rispostaAi = 'Contatti ' + nomeBrand;
  } else {
    // Non si capisce ancora: nessun ticket finche' non e' chiaro cosa serve.
    return json({ ticketId: null, type: 'clarify', brand, colore });
  }

  // 3) Salva il ticket
  let id = 0, codice = '';
  try {
    ({ id, codice } = await salvaTicket(brand, negozio, categoria, colore, messaggio, rispostaAi));
  } catch (err) {
    return json({ error: 'DB: ' + (err.message || 'errore') }, 500);
  }

  return json({ ticketId: id, codice, brand, colore, ...payload });
}
