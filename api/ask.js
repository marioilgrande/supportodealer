import { json as jsonBase } from '../lib/auth.js';
const json = (d, st) => jsonBase(PROVA && DIAG ? Object.assign({ diag: DIAG }, d) : d, st);
import { sql, codiceTicket } from '../lib/db.js';
import { interpret, rispondiDaFonti, ultimaDiagnosi } from '../lib/gemini.js';
import { getFonti, numeriVerificati, testoPertinente, sezioniPertinenti, chiaveDomanda, firma } from '../lib/fonti.js';
import {
  BRANDS, isBrand, getProcedure, getProceduraById, getContatti, getOfferte,
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
let DIAG = null;   // solo in prova: perche' si e' usata o scartata la risposta dalle fonti
// Risposte dalle fonti (memoria -> AI sugli estratti -> sezioni ufficiali). Il
// flusso classico resta come ultima riserva.
const RISPOSTE_FONTI = true;

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

/* ============================================================================
   MEMORIA DELLE RISPOSTE
   Una domanda gia' fatta (stesse parole importanti, in qualsiasi ordine) per lo
   stesso brand riceve la risposta gia' verificata, senza consumare l'AI.
   La risposta salvata vale finche' le sezioni citate restano identiche: se il
   portale info-utili cambia proprio quelle, si rigenera da sola.
   Le risposte segnate "Risposta OK" in Vista Admin diventano approvate.
   ========================================================================== */
// Cambiare questo numero quando si cambiano le regole dell'AI: le risposte
// salvate con le regole vecchie non valgono piu' e si riscrivono.
const REGOLE_RISPOSTE = 2;
let memoriaPronta = false;
async function preparaMemoria() {
  if (memoriaPronta) return;
  await sql`CREATE TABLE IF NOT EXISTS risposta_cache (
    brand     TEXT NOT NULL,
    chiave    TEXT NOT NULL,
    payload   JSONB NOT NULL,
    firme     JSONB NOT NULL DEFAULT '{}'::jsonb,
    versione  TEXT NOT NULL DEFAULT '',
    approvata BOOLEAN NOT NULL DEFAULT FALSE,
    usi       INTEGER NOT NULL DEFAULT 0,
    creato_il TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (brand, chiave)
  )`;
  memoriaPronta = true;
}
async function cercaInMemoria(brand, chiave, fonti) {
  if (!chiave) return null;
  await preparaMemoria();
  const [r] = await sql`SELECT payload, firme, versione FROM risposta_cache WHERE brand = ${brand} AND chiave = ${chiave}`;
  if (!r || !r.payload || r.payload.regole !== REGOLE_RISPOSTE) return null;
  const firme = r.firme || {};
  const ids = Object.keys(firme);
  const valida = ids.length
    ? ids.every(id => fonti.perId.has(id) && firma(fonti.perId.get(id).testo) === firme[id])
    : r.versione === fonti.versione;               // domande di chiarimento: tutto il portale
  if (!valida) return null;
  await sql`UPDATE risposta_cache SET usi = usi + 1 WHERE brand = ${brand} AND chiave = ${chiave}`;
  return r.payload;
}
async function salvaInMemoria(brand, chiave, payload, firme, versione) {
  if (!chiave) return;
  await preparaMemoria();
  await sql`INSERT INTO risposta_cache (brand, chiave, payload, firme, versione)
            VALUES (${brand}, ${chiave}, ${JSON.stringify(payload)}::jsonb, ${JSON.stringify(firme || {})}::jsonb, ${versione || ''})
            ON CONFLICT (brand, chiave) DO UPDATE SET payload = EXCLUDED.payload, firme = EXCLUDED.firme,
              versione = EXCLUDED.versione, approvata = FALSE, usi = 0, creato_il = now()`;
}

/* Corpo della risposta con le sezioni citate: schede apribili, contatti, offerte. */
async function corpoConFonti(brand, citate, testo) {
  const [procedure, contattiTutti] = await Promise.all([getProcedure(brand), getContatti(brand)]);
  const schede = citate.filter(s => s.tipo === 'scheda')
    .map(s => procedure.find(p => p.id === s.id)).filter(Boolean).slice(0, 3);
  const idContatti = new Set(citate.filter(s => s.tipo === 'contatto').map(s => s.id.slice('contatto:'.length)));
  const nomiCitati = new Set(citate.filter(s => s.nome).map(s => s.nome.toLowerCase()));
  const visti = new Set();
  const offerte = nomiCitati.size ? (await getOfferte(brand)).filter(o => {
    const k = [o.nome, o.luce, o.gas, o.comm].join('|');
    if (!nomiCitati.has(String(o.nome || '').toLowerCase()) || visti.has(k)) return false;
    visti.add(k); return true;
  }).slice(0, 8) : [];
  return {
    brand, type: 'risposta', testo,
    fonti: citate.map(s => ({ id: s.id, tipo: s.tipo, titolo: s.titolo })),
    schede: schede.map(p => ({ id: p.id, titolo: p.label, sottotitolo: p.sottotitolo, etichetta: p.etichetta,
                               blocchi: p.type === 'blocchi' ? p.blocchi : [{ tipo: 'info', testo: p.answer || '' }] })),
    contatti: contattiTutti.filter(c => idContatti.has(String(c.id))),
    offerte
  };
}
function classifica(citate, contatti) {
  const conOfferte = citate.some(s => s.tipo === 'offerta');
  return contatti ? { categoria: 'Chi contattare', colore: 'rosso' }
       : conOfferte ? { categoria: 'Info offerte', colore: 'verde' }
       : { categoria: 'Procedura', colore: 'giallo' };
}

/* Risposta scritta dall'AI leggendo le fonti del brand (lib/fonti.js).
   Ritorna { corpo, ticket, memoria } da inviare, { intent } per proseguire col
   flusso classico, oppure null se la risposta non supera i controlli. */
async function daFonti(ai, fonti, ctx) {
  const { brand, messaggio, nomeBrand } = ctx;

  if (ai.esito === 'avanzamento') return { intent: 'avanzamento' };

  if (ai.esito === 'chiarimento') {
    const opzioni = (ai.opzioni || []).map(x => String(x).trim()).filter(Boolean).slice(0, 4);
    if (opzioni.length >= 2 && ai.domanda) {
      return { corpo: { brand, colore: 'giallo', type: 'chiarimento', domanda: String(ai.domanda), opzioni },
               memoria: { firme: {}, versione: fonti.versione } };
    }
    return null;
  }

  if (ai.esito === 'non_trovato') {
    // L'AI ha letto solo gli estratti piu' pertinenti: se le parole chiave di una
    // scheda agganciano la domanda, meglio mostrare quella col metodo classico.
    if ((await matchProcedure(messaggio, brand)).length) return null;
    const testo = String(ai.risposta || '').trim() || ('Nelle informazioni ' + nomeBrand + ' non trovo questo dato.');
    return { corpo: { brand, colore: 'rosso', type: 'non-trovato', testo, contatti: ordinaContatti(await getContatti(brand), messaggio) },
             ticket: { categoria: 'Non trovato nelle fonti', colore: 'rosso', rispostaAi: testo } };
  }

  // esito risposta / contatti: le fonti citate devono esistere davvero
  // l'AI a volte scrive "ID: offerta:19" o "[ID: offerta:19]": tengo solo l'id
  const pulito = (x) => String(x).replace(/^[\s\[]*(ID\s*:\s*)?/i, '').replace(/[\]\s]+$/, '');
  const ids = [...new Set((ai.fonti || []).map(pulito))].filter(id => fonti.perId.has(id)).slice(0, 10);
  if (!ids.length) return null;
  const citate = ids.map(id => fonti.perId.get(id));
  const testo = String(ai.risposta || '').trim();

  // Anti-invenzione: un numero che non sta nelle fonti fa scartare il testo scritto
  // dall'AI. Restano le sezioni ufficiali citate, da leggere direttamente.
  const verifica = numeriVerificati(testo, fonti.testo);
  if (DIAG) DIAG.numeriMancanti = verifica.mancanti;
  const corpo = await corpoConFonti(brand, citate, testo && verifica.ok ? testo : '');
  const cl = classifica(citate, ai.esito === 'contatti');
  corpo.colore = cl.colore;
  const firme = Object.fromEntries(citate.map(s => [s.id, firma(s.testo)]));
  return {
    corpo,
    ticket: { ...cl, rispostaAi: ((corpo.testo || 'Sezioni: ') + '\n[fonti: ' + citate.map(s => s.titolo).join(' | ') + ']').slice(0, 4000) },
    memoria: corpo.testo ? { firme, versione: fonti.versione } : null
  };
}

/* Quando l'AI non e' disponibile (quota finita, servizio lento): niente testo
   scritto, ma le sezioni ufficiali piu' pertinenti alla domanda. */
async function daEstratti(fonti, ctx) {
  const { brand, messaggio } = ctx;
  const classificate = sezioniPertinenti(fonti, messaggio);
  if (!classificate.length || classificate[0].p < 4) return null;
  const vuoleContatto = /numer|telefon|chiam|mail|contatt|rivolg|assistenz|help|ufficio/i.test(messaggio);
  // solo le sezioni forti: almeno meta' del punteggio della migliore
  // (fino a 5 se sono offerte: chi chiede le offerte vuole vederle tutte)
  let citate = classificate.filter(x => x.p >= classificate[0].p / 2).slice(0, classificate[0].s.tipo === 'offerta' ? 5 : 3).map(x => x.s);
  if (vuoleContatto) {
    const c = classificate.filter(x => x.s.tipo === 'contatto').slice(0, 3).map(x => x.s);
    if (c.length) citate = c;
  }
  const corpo = await corpoConFonti(brand, citate, '');
  const cl = classifica(citate, vuoleContatto && citate[0].tipo === 'contatto');
  corpo.colore = cl.colore;
  return { corpo, ticket: { ...cl, rispostaAi: 'Sezioni piu’ pertinenti: ' + citate.map(s => s.titolo).join(' | ') } };
}

async function invia(out, ctx, chiave) {
  const { brand, negozio, messaggio } = ctx;
  let extra = { ticketId: null };
  if (out.ticket) {
    const t = await salvaTicket(brand, negozio, out.ticket.categoria, out.ticket.colore, messaggio, out.ticket.rispostaAi);
    extra = { ticketId: t.id, codice: t.codice };
  }
  if (out.memoria) {
    try { await salvaInMemoria(brand, chiave, { regole: REGOLE_RISPOSTE, corpo: out.corpo, ticket: out.ticket || null }, out.memoria.firme, out.memoria.versione); }
    catch { /* la memoria e' un di piu' */ }
  }
  return json(Object.assign({}, out.corpo, extra));
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
  DIAG = null;

  // 1) Interpreta la richiesta (sempre dentro il brand scelto).
  const forcedId = (body.proceduraId || '').toString().slice(0, 80);
  let intp;
  let aiAssente = false;   // l'AI ha appena fallito: inutile richiamarla nel flusso classico
  if (forcedId) {
    intp = { intent: 'portale', procedureId: forcedId, offerFilter: null };
  } else {
    // 1a) Risposta scritta leggendo tutte le fonti del brand, con citazioni e
    //     controllo dei numeri. Se l'AI non c'e' o il controllo non passa, si
    //     prosegue col metodo classico (scelta della scheda + parole chiave).
    if (RISPOSTE_FONTI) try {
      const fonti = await getFonti(brand);
      if (fonti.sezioni.length) {
        const ctx = { brand, negozio, messaggio, nomeBrand };
        const chiave = chiaveDomanda(messaggio);
        // 1) gia' risposta? (zero AI)
        let salvata = null;
        try { salvata = await cercaInMemoria(brand, chiave, fonti); } catch { /* si va avanti */ }
        if (salvata) {
          if (DIAG === null && PROVA) DIAG = { memoria: true };
          return await invia({ corpo: Object.assign({}, salvata.corpo, { memoria: true }), ticket: salvata.ticket }, ctx, chiave);
        }
        // 2) risposta scritta dall'AI sugli estratti pertinenti
        const ai = await rispondiDaFonti(messaggio, testoPertinente(fonti, messaggio, 22000), nomeBrand);
        DIAG = ai ? { ai: ai._diag, esito: ai.esito, fonti: ai.fonti, risposta: ai.risposta } : { ai: ultimaDiagnosi };
        if (ai) {
          const r = await daFonti(ai, fonti, ctx);
          if (r && r.corpo) return await invia(r, ctx, chiave);
          if (r && r.intent) intp = { intent: r.intent, procedureId: null, offerFilter: null };
        } else {
          // 3) AI non disponibile: le sezioni ufficiali piu' pertinenti
          aiAssente = true;
          const r = await daEstratti(fonti, ctx);
          if (r) return await invia(r, ctx, null);
        }
      }
    } catch (e) { if (DIAG) DIAG.errore = String(e && e.message || e); }
  }
  if (!intp) {
    const procedure = await getProcedure(brand);
    intp = null;
    if (!aiAssente) try { intp = await interpret(messaggio, procedure, nomeBrand); } catch { /* fallback */ }
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
