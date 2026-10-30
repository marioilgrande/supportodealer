// Correzione di una risposta da parte di Mario (Vista Admin, serve il login).
// Chi fara' la STESSA domanda sullo stesso brand ricevera' questa risposta
// all'istante (memoria delle risposte, senza AI). Con "simili" la risposta
// diventa anche una scheda manuale nei Contenuti: l'AI la trova cosi' anche
// quando la domanda e' scritta con parole diverse.
import { verifyRequest, json } from '../lib/auth.js';
import { sql } from '../lib/db.js';
import { chiaveDomanda, firma } from '../lib/fonti.js';
import { invalidaCache } from '../lib/kb.js';
import { testoBlocchi } from '../lib/brand-sync.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!(await verifyRequest(request))) return json({ error: 'Non autorizzato' }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const id = Number(body.ticketId);
  const testo = String(body.testo || '').trim().slice(0, 3000);
  const simili = body.simili !== false;
  if (!id || testo.length < 3) return json({ error: 'Scrivi la risposta corretta' }, 400);

  try {
    const [t] = await sql`SELECT brand, messaggio FROM ticket WHERE id = ${id}`;
    if (!t || !t.brand) return json({ error: 'Richiesta non trovata' }, 404);
    const chiave = chiaveDomanda(t.messaggio);
    if (!chiave) return json({ error: 'La domanda non contiene parole utili' }, 400);

    // 1) scheda manuale per le domande simili (stesso id se si corregge di nuovo)
    let procId = null;
    if (simili) {
      procId = t.brand + ':verificata-' + firma(t.brand + '|' + chiave);
      const titolo = String(t.messaggio).trim().replace(/\s+/g, ' ').slice(0, 140);
      // keywords vuote: la scheda non deve "rubare" altre domande con le parole
      // chiave; la trova l'AI leggendo titolo e testo.
      await sql`
        INSERT INTO procedura (id, brand, titolo, sottotitolo, etichetta, keywords, tipo, risposta, url, blocchi, origine, attiva, sort_order)
        VALUES (${procId}, ${t.brand}, ${titolo}, '', 'Risposta verificata', '', 'blocchi', '', '',
                ${JSON.stringify([{ tipo: 'info', testo }])}::jsonb, 'manuale', TRUE, 0)
        ON CONFLICT (id) DO UPDATE SET titolo = EXCLUDED.titolo, blocchi = EXCLUDED.blocchi, attiva = TRUE`;
      invalidaCache();
    }

    // 2) memoria: risposta immediata per la stessa domanda
    const payload = {
      manuale: true,
      corpo: { brand: t.brand, type: 'risposta', colore: 'verde', testo,
               fonti: [{ id: procId || 'verificata', tipo: 'verificata', titolo: 'Risposta verificata da Mario' }],
               schede: [], contatti: [], offerte: [] },
      ticket: { categoria: 'Risposta verificata', colore: 'verde', rispostaAi: testo }
    };
    // se c'e' la scheda, la memoria vale finche' la scheda non viene modificata
    // dai Contenuti (poi risponde l'AI leggendo la scheda aggiornata)
    // (stessa impronta che calcola lib/fonti.js per una scheda senza sottotitolo e parole chiave)
    const firme = procId ? { [procId]: firma(testoBlocchi([{ tipo: 'info', testo }])) } : {};
    await sql`CREATE TABLE IF NOT EXISTS risposta_cache (
      brand TEXT NOT NULL, chiave TEXT NOT NULL, payload JSONB NOT NULL,
      firme JSONB NOT NULL DEFAULT '{}'::jsonb, versione TEXT NOT NULL DEFAULT '',
      approvata BOOLEAN NOT NULL DEFAULT FALSE, usi INTEGER NOT NULL DEFAULT 0,
      creato_il TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (brand, chiave))`;
    await sql`
      INSERT INTO risposta_cache (brand, chiave, payload, firme, versione, approvata)
      VALUES (${t.brand}, ${chiave}, ${JSON.stringify(payload)}::jsonb, ${JSON.stringify(firme)}::jsonb, '', TRUE)
      ON CONFLICT (brand, chiave) DO UPDATE SET payload = EXCLUDED.payload, firme = EXCLUDED.firme,
        versione = '', approvata = TRUE, usi = 0, creato_il = now()`;

    // 3) la richiesta risulta corretta
    await sql`ALTER TABLE ticket ADD COLUMN IF NOT EXISTS risposta_corretta TEXT`;
    await sql`UPDATE ticket SET risposta_ok = TRUE, risposta_corretta = ${testo}, updated_at = NOW() WHERE id = ${id}`;
    return json({ ok: true, scheda: procId });
  } catch (e) {
    return json({ error: 'DB: ' + (e.message || 'errore') }, 500);
  }
}
