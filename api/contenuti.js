import { verifyRequest, json } from '../lib/auth.js';
import { sql } from '../lib/db.js';
import { invalidaCache } from '../lib/kb.js';

export const config = { runtime: 'edge' };

function slug(s) {
  return String(s || '').toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || ('proc-' + Date.now());
}
const S = (v, max = 4000) => String(v == null ? '' : v).slice(0, max);

// Gestione contenuti (procedure + offerte) dal pannello admin. Modifiche immediate, senza deploy.
export default async function handler(request) {
  const session = await verifyRequest(request);
  if (!session) return json({ error: 'Non autorizzato' }, 401);

  try {
    if (request.method === 'GET') {
      const procedure = await sql`SELECT id, titolo, keywords, tipo, risposta, url, attiva, sort_order FROM procedura ORDER BY sort_order, id`;
      const offerte = await sql`SELECT id, nome, tipo, scadenza, durata, luce, gas, comm, attiva, sort_order FROM offerta ORDER BY sort_order, id`;
      return json({ procedure, offerte });
    }

    const body = await request.json();
    const tipo = body.tipo; // 'procedura' | 'offerta'

    if (request.method === 'POST') {
      if (tipo === 'procedura') {
        const id = S(body.id, 40) || slug(body.titolo);
        const [row] = await sql`
          INSERT INTO procedura (id, titolo, keywords, tipo, risposta, url, attiva, sort_order)
          VALUES (${id}, ${S(body.titolo, 200)}, ${S(body.keywords, 500)}, ${body.tipoRisposta === 'link' ? 'link' : 'text'},
                  ${S(body.risposta)}, ${S(body.url, 500)}, TRUE,
                  COALESCE((SELECT MAX(sort_order) + 1 FROM procedura), 0))
          RETURNING id`;
        invalidaCache();
        return json({ ok: true, id: row.id });
      }
      if (tipo === 'offerta') {
        const [row] = await sql`
          INSERT INTO offerta (nome, tipo, scadenza, durata, luce, gas, comm, attiva, sort_order)
          VALUES (${S(body.nome, 200)}, ${S(body.tipoOfferta, 50)}, ${S(body.scadenza, 50)}, ${S(body.durata, 50)},
                  ${S(body.luce, 200)}, ${S(body.gas, 200)}, ${S(body.comm, 200)}, TRUE,
                  COALESCE((SELECT MAX(sort_order) + 1 FROM offerta), 0))
          RETURNING id`;
        invalidaCache();
        return json({ ok: true, id: row.id });
      }
      return json({ error: 'tipo non valido' }, 400);
    }

    if (request.method === 'PUT') {
      if (tipo === 'procedura') {
        if (!body.id) return json({ error: 'id mancante' }, 400);
        await sql`
          UPDATE procedura SET
            titolo = ${S(body.titolo, 200)}, keywords = ${S(body.keywords, 500)},
            tipo = ${body.tipoRisposta === 'link' ? 'link' : 'text'},
            risposta = ${S(body.risposta)}, url = ${S(body.url, 500)},
            attiva = ${body.attiva !== false}, updated_at = NOW()
          WHERE id = ${S(body.id, 40)}`;
        invalidaCache();
        return json({ ok: true });
      }
      if (tipo === 'offerta') {
        const id = Number(body.id);
        if (!id) return json({ error: 'id mancante' }, 400);
        await sql`
          UPDATE offerta SET
            nome = ${S(body.nome, 200)}, tipo = ${S(body.tipoOfferta, 50)}, scadenza = ${S(body.scadenza, 50)},
            durata = ${S(body.durata, 50)}, luce = ${S(body.luce, 200)}, gas = ${S(body.gas, 200)},
            comm = ${S(body.comm, 200)}, attiva = ${body.attiva !== false}, updated_at = NOW()
          WHERE id = ${id}`;
        invalidaCache();
        return json({ ok: true });
      }
      return json({ error: 'tipo non valido' }, 400);
    }

    if (request.method === 'DELETE') {
      if (tipo === 'procedura') {
        await sql`DELETE FROM procedura WHERE id = ${S(body.id, 40)}`;
      } else if (tipo === 'offerta') {
        await sql`DELETE FROM offerta WHERE id = ${Number(body.id)}`;
      } else {
        return json({ error: 'tipo non valido' }, 400);
      }
      invalidaCache();
      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ error: 'DB: ' + (err.message || 'errore') }, 500);
  }
}
