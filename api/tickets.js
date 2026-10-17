import { verifyRequest, json } from '../lib/auth.js';
import { sql } from '../lib/db.js';
import { chiaveDomanda } from '../lib/fonti.js';

export const config = { runtime: 'edge' };

// Dashboard admin (protetta): elenco ticket + validazione risposta.
export default async function handler(request) {
  const session = await verifyRequest(request);
  if (!session) return json({ error: 'Non autorizzato' }, 401);

  try {
    if (request.method === 'GET') {
      const rows = await sql`
        SELECT id, codice, brand, negozio, sis_sub, agenzia, categoria, colore,
               messaggio, esito, cf_cliente, num_opportunity, nota_controllo,
               tipo_pratica, risposta_ok, created_at
        FROM ticket
        ORDER BY created_at DESC
        LIMIT 200
      `;
      const [stats] = await sql`
        SELECT
          COUNT(*) FILTER (WHERE colore='rosso'  AND esito NOT IN ('bastata'))  AS rosse,
          COUNT(*) FILTER (WHERE colore='giallo' AND esito NOT IN ('bastata'))  AS gialle,
          COUNT(*) FILTER (WHERE colore='verde'  AND esito NOT IN ('bastata'))  AS verdi,
          COUNT(*) FILTER (WHERE risposta_ok IS TRUE)  AS ok,
          COUNT(*) FILTER (WHERE risposta_ok IS NOT NULL) AS validati
        FROM ticket
      `;
      return json({ tickets: rows, stats });
    }

    // Validazione admin: risposta AI corretta o da migliorare
    if (request.method === 'PUT') {
      const body = await request.json();
      const id = Number(body.id);
      if (!id) return json({ error: 'id mancante' }, 400);
      await sql`UPDATE ticket SET risposta_ok = ${body.rispostaOk === true}, updated_at = NOW() WHERE id = ${id}`;
      // Memoria delle risposte: "Risposta OK" la approva, "Da migliorare" la cancella
      // (la prossima volta che qualcuno fa la stessa domanda si rigenera).
      try {
        const [t] = await sql`SELECT brand, messaggio FROM ticket WHERE id = ${id}`;
        const chiave = t && t.brand ? chiaveDomanda(t.messaggio) : '';
        if (chiave) {
          if (body.rispostaOk === true) await sql`UPDATE risposta_cache SET approvata = TRUE WHERE brand = ${t.brand} AND chiave = ${chiave}`;
          else await sql`DELETE FROM risposta_cache WHERE brand = ${t.brand} AND chiave = ${chiave}`;
        }
      } catch { /* memoria non ancora creata */ }
      return json({ ok: true });
    }

    // Elimina una richiesta (utile per ripulire le prove)
    if (request.method === 'DELETE') {
      const url = new URL(request.url);
      const id = Number(url.searchParams.get('id'));
      if (!id) return json({ error: 'id mancante' }, 400);
      await sql`DELETE FROM ticket WHERE id = ${id}`;
      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ error: 'DB: ' + (err.message || 'errore') }, 500);
  }
}
