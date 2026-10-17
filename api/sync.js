/* ============================================================================
   ALLINEAMENTO AUTOMATICO CON I PORTALI INFO-UTILI
   Legge online i file dati dei tre portali (procedure.js, contenuti.js,
   offerte.js...) e riscrive nel database le voci con origine='sync'.
   Quello che Mario aggiunge dal pannello (origine='manuale') non si tocca.

   Quando gira:
   - GET  /api/sync          -> controllo automatico. Lo lancia la pagina del
                                dealer all'apertura e il cron di Vercel ogni
                                mattina; se l'ultimo controllo e' di meno di
                                10 minuti fa non fa nulla.
   - GET  /api/sync?stato=1  -> solo lo stato (per il pannello admin)
   - POST /api/sync          -> "Aggiorna ora" dal pannello admin (serve login):
                                riscrive tutto anche se nulla e' cambiato.

   Un brand si riscrive solo se i suoi file sono cambiati (impronta SHA-256)
   e solo se la lettura e' andata bene: se un portale non risponde o restituisce
   la pagina di accesso, i contenuti gia' presenti restano dove sono.
   Plenitude e Alperia sono protetti da password: la lettura passa grazie
   all'intestazione x-supporto-token (variabile SUPPORTO_TOKEN su Vercel).
   ========================================================================== */
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { sql } from '../lib/db.js';
import { verifyRequest, json } from '../lib/auth.js';
import { invalidaCache } from '../lib/kb.js';
import { FONTI, FILE_DATI, VERSIONE_REGOLE, costruisciBrand, eseguiFileDati, dettagliBrand } from '../lib/brand-sync.js';

const PAUSA_MS = 10 * 60 * 1000;   // tra un controllo automatico e l'altro

async function preparaTabella() {
  await sql`CREATE TABLE IF NOT EXISTS sync_stato (
    brand          TEXT PRIMARY KEY,
    impronta       TEXT NOT NULL DEFAULT '',
    controllato_il TIMESTAMPTZ,
    aggiornato_il  TIMESTAMPTZ,
    esito          TEXT NOT NULL DEFAULT '',
    dettaglio      TEXT NOT NULL DEFAULT ''
  )`;  // Testo completo delle fonti (offerte con tutte le condizioni e altre info)
  // che l'assistente legge per rispondere: vedi lib/fonti.js.
  await sql`CREATE TABLE IF NOT EXISTS fonte_brand (
    brand         TEXT PRIMARY KEY,
    dati          JSONB NOT NULL DEFAULT '{}'::jsonb,
    aggiornato_il TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
}

async function leggiStato() {
  const rows = await sql`SELECT brand, impronta, controllato_il, aggiornato_il, esito, dettaglio FROM sync_stato`;
  return Object.fromEntries(rows.map(r => [r.brand, r]));
}

/* Scarica i file dati di un brand. Un 404 vuol dire "file che quel portale non
   ha" (es. prestazioni.js esiste solo su Sorgenia); qualsiasi altro errore, o
   una risposta HTML (= pagina di accesso), blocca il brand. */
async function scaricaBrand(brand) {
  const base = FONTI[brand].url;
  const token = process.env.SUPPORTO_TOKEN || '';
  const testi = {};
  await Promise.all(FILE_DATI.map(async (f) => {
    const r = await fetch(base + f + '?t=' + Date.now(), {
      headers: { 'x-supporto-token': token, 'cache-control': 'no-cache' },
      redirect: 'manual'
    });
    if (r.status === 404) return;
    if (r.status !== 200) throw new Error(f + ': risposta ' + r.status + (r.status === 401 || r.status === 302 || r.status === 307 ? ' (accesso negato)' : ''));
    const t = await r.text();
    if (/^\s*</.test(t)) throw new Error(f + ': il portale ha risposto con una pagina, non con i dati (accesso negato?)');
    testi[f] = t;
  }));
  if (!Object.keys(testi).length) throw new Error('nessun file dati trovato');
  return testi;
}

function impronta(testi) {
  const h = createHash('sha256');
  h.update('regole-' + VERSIONE_REGOLE);
  for (const f of Object.keys(testi).sort()) h.update('\n#' + f + '\n' + testi[f]);
  return h.digest('hex');
}

function righeQuery(brand, r, dettagli) {
  const q = [
    sql`INSERT INTO fonte_brand (brand, dati, aggiornato_il) VALUES (${brand}, ${JSON.stringify(dettagli)}::jsonb, now())
        ON CONFLICT (brand) DO UPDATE SET dati = EXCLUDED.dati, aggiornato_il = now()`,
    sql`DELETE FROM procedura    WHERE brand = ${brand} AND origine = 'sync'`,
    sql`DELETE FROM offerta      WHERE brand = ${brand} AND origine = 'sync'`,
    sql`DELETE FROM contatto     WHERE brand = ${brand} AND origine = 'sync'`,
    sql`DELETE FROM tipo_pratica WHERE brand = ${brand} AND origine = 'sync'`
  ];
  for (const v of r.voci) q.push(sql`
    INSERT INTO procedura (id, brand, titolo, sottotitolo, etichetta, keywords, tipo, risposta, url, blocchi, origine, attiva, sort_order)
    VALUES (${v.id}, ${brand}, ${v.titolo}, ${v.sottotitolo}, ${v.etichetta}, ${v.keywords}, 'blocchi', '', '',
            ${JSON.stringify(v.blocchi)}::jsonb, 'sync', TRUE, ${v.sort_order})`);
  for (const c of r.contatti) q.push(sql`
    INSERT INTO contatto (id, brand, area, ufficio, richieste, tel, email, orari, link, nota, origine, attivo, sort_order)
    VALUES (${c.id}, ${brand}, ${c.area}, ${c.ufficio}, ${c.richieste}, ${c.tel}, ${c.email}, ${c.orari}, ${c.link}, ${c.nota}, 'sync', TRUE, ${c.sort_order})`);
  for (const o of r.offerte) q.push(sql`
    INSERT INTO offerta (brand, nome, tipo, scadenza, durata, luce, gas, comm, segmento, origine, attiva, sort_order)
    VALUES (${brand}, ${o.nome}, ${o.tipo}, ${o.scadenza}, ${o.durata}, ${o.luce}, ${o.gas}, ${o.comm}, ${o.segmento}, 'sync', TRUE, ${o.sort_order})`);
  for (const t of r.tipiPratica) q.push(sql`
    INSERT INTO tipo_pratica (id, brand, nome, nota, origine, attivo, sort_order)
    VALUES (${t.id}, ${brand}, ${t.nome}, ${t.nota}, 'sync', TRUE, ${t.sort_order})`);
  return q;
}

async function segna(brand, campi) {
  await sql`
    INSERT INTO sync_stato (brand, impronta, controllato_il, aggiornato_il, esito, dettaglio)
    VALUES (${brand}, ${campi.impronta || ''}, now(), ${campi.aggiornato ? new Date().toISOString() : null}, ${campi.esito}, ${campi.dettaglio || ''})
    ON CONFLICT (brand) DO UPDATE SET
      impronta       = CASE WHEN ${campi.impronta || ''} = '' THEN sync_stato.impronta ELSE ${campi.impronta || ''} END,
      controllato_il = now(),
      aggiornato_il  = COALESCE(EXCLUDED.aggiornato_il, sync_stato.aggiornato_il),
      esito          = EXCLUDED.esito,
      dettaglio      = EXCLUDED.dettaglio`;
}

async function allineaBrand(brand, statoPrec, forza) {
  let testi;
  try { testi = await scaricaBrand(brand); }
  catch (e) { await segna(brand, { esito: 'errore', dettaglio: e.message }); return { brand, esito: 'errore', dettaglio: e.message }; }

  const imp = impronta(testi);
  if (!forza && statoPrec && statoPrec.impronta === imp) {
    await segna(brand, { impronta: imp, esito: 'invariato' });
    return { brand, esito: 'invariato' };
  }

  const d = {};
  const problemi = [];
  for (const [f, t] of Object.entries(testi)) {
    try { Object.assign(d, eseguiFileDati(vm, t, f)); }
    catch (e) { problemi.push(f + ': ' + e.message); }
  }
  if (problemi.length) {
    const msg = 'file non leggibile — ' + problemi.join('; ');
    await segna(brand, { esito: 'errore', dettaglio: msg });
    return { brand, esito: 'errore', dettaglio: msg };
  }

  const r = costruisciBrand(brand, d);
  // Rete di sicurezza: un portale "vuoto" non deve cancellare quello che c'e'.
  if (r.voci.length < 3 || !r.offerte.length) {
    const msg = 'dati incompleti (' + r.voci.length + ' voci, ' + r.offerte.length + ' offerte): nulla e’ stato cambiato';
    await segna(brand, { esito: 'errore', dettaglio: msg });
    return { brand, esito: 'errore', dettaglio: msg };
  }

  await sql.transaction(righeQuery(brand, r, dettagliBrand(brand, d)));
  const det = r.voci.length + ' risposte, ' + r.offerte.length + ' offerte, ' + r.contatti.length + ' contatti, ' + r.tipiPratica.length + ' tipi di pratica';
  await segna(brand, { impronta: imp, aggiornato: true, esito: 'aggiornato', dettaglio: det });
  return { brand, esito: 'aggiornato', dettaglio: det };
}

async function esegui(forza) {
  await preparaTabella();
  const stato = await leggiStato();

  if (!forza) {
    const ultimo = stato._controllo && stato._controllo.controllato_il;
    if (ultimo && Date.now() - new Date(ultimo).getTime() < PAUSA_MS) return { saltato: true };
  }
  // Segno subito il controllo: se piu' dealer aprono la pagina insieme parte una volta sola.
  await segna('_controllo', { esito: 'in corso' });

  const risultati = [];
  for (const brand of Object.keys(FONTI)) {
    try { risultati.push(await allineaBrand(brand, stato[brand], forza)); }
    catch (e) {
      await segna(brand, { esito: 'errore', dettaglio: 'database: ' + e.message }).catch(() => {});
      risultati.push({ brand, esito: 'errore', dettaglio: 'database: ' + e.message });
    }
  }
  await segna('_controllo', { esito: 'fatto' });
  if (risultati.some(r => r.esito === 'aggiornato')) invalidaCache();
  return { risultati };
}

async function statoPubblico() {
  await preparaTabella();
  const stato = await leggiStato();
  return Object.keys(FONTI).map(b => {
    const s = stato[b] || {};
    return { brand: b, nome: FONTI[b].nome, esito: s.esito || 'mai', dettaglio: s.dettaglio || '',
             controllato_il: s.controllato_il || null, aggiornato_il: s.aggiornato_il || null };
  });
}

export async function GET(request) {
  const u = new URL(request.url);
  try {
    if (u.searchParams.get('stato')) {
      if (!(await verifyRequest(request))) return json({ error: 'Non autorizzato' }, 401);
      return json({ ok: true, stato: await statoPubblico() });
    }
    const r = await esegui(false);
    // al pubblico basta sapere se ha girato: i dettagli li vede solo l'admin
    return json({ ok: true, saltato: !!r.saltato, cambiati: (r.risultati || []).filter(x => x.esito === 'aggiornato').map(x => x.brand) });
  } catch (e) {
    return json({ ok: false, error: 'sync non riuscita' }, 500);
  }
}

export async function POST(request) {
  if (!(await verifyRequest(request))) return json({ error: 'Non autorizzato' }, 401);
  try {
    const r = await esegui(true);
    return json({ ok: true, risultati: r.risultati, stato: await statoPubblico() });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
