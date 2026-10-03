import { verifyRequest, json } from '../lib/auth.js';
import { sql } from '../lib/db.js';
import { invalidaCache, isBrand } from '../lib/kb.js';

export const config = { runtime: 'edge' };

const S = (v, max = 4000) => String(v == null ? '' : v).slice(0, max);
const B = (v) => (isBrand(v) ? v : '');
function blocchiOk(v) {
  if (Array.isArray(v)) return JSON.stringify(v);
  if (typeof v === 'string' && v.trim()) {
    try { const x = JSON.parse(v); if (Array.isArray(x)) return JSON.stringify(x); } catch {}
  }
  return '[]';
}
const tipoRisposta = (v) => (['link', 'contatti', 'blocchi'].includes(v) ? v : 'text');

// Gestione contenuti (procedure, offerte, contatti) dal pannello admin.
// Tutto cio' che si crea qui nasce con origine='manuale': il sync dai portali
// info-utili riscrive solo le righe con origine='sync' e non lo tocca.
export default async function handler(request) {
  const session = await verifyRequest(request);
  if (!session) return json({ error: 'Non autorizzato' }, 401);

  try {
    if (request.method === 'GET') {
      const brand = B(new URL(request.url).searchParams.get('brand'));
      const procedure = brand
        ? await sql`SELECT id, brand, titolo, sottotitolo, etichetta, keywords, tipo, risposta, url, blocchi, origine, attiva, sort_order
                    FROM procedura WHERE brand = ${brand} ORDER BY sort_order, id`
        : await sql`SELECT id, brand, titolo, sottotitolo, etichetta, keywords, tipo, risposta, url, blocchi, origine, attiva, sort_order
                    FROM procedura ORDER BY brand, sort_order, id`;
      const offerte = brand
        ? await sql`SELECT id, brand, nome, tipo, scadenza, durata, luce, gas, comm, segmento, origine, attiva, sort_order
                    FROM offerta WHERE brand = ${brand} ORDER BY sort_order, id`
        : await sql`SELECT id, brand, nome, tipo, scadenza, durata, luce, gas, comm, segmento, origine, attiva, sort_order
                    FROM offerta ORDER BY brand, sort_order, id`;
      const contatti = brand
        ? await sql`SELECT id, brand, area, ufficio, richieste, tel, email, orari, link, nota, origine, attivo, sort_order
                    FROM contatto WHERE brand = ${brand} ORDER BY sort_order, id`
        : await sql`SELECT id, brand, area, ufficio, richieste, tel, email, orari, link, nota, origine, attivo, sort_order
                    FROM contatto ORDER BY brand, sort_order, id`;
      return json({ procedure, offerte, contatti });
    }

    const body = await request.json();
    const tipo = body.tipo; // 'procedura' | 'offerta' | 'contatto'
    const brand = B(body.brand);

    if (request.method === 'POST') {
      if (!brand) return json({ error: 'brand mancante' }, 400);
      if (tipo === 'procedura') {
        const id = S(body.id, 80) || (brand + ':m' + Date.now());
        const [row] = await sql`
          INSERT INTO procedura (id, brand, titolo, sottotitolo, etichetta, keywords, tipo, risposta, url, blocchi, origine, attiva, sort_order)
          VALUES (${id}, ${brand}, ${S(body.titolo, 200)}, ${S(body.sottotitolo, 300)}, ${S(body.etichetta, 60)},
                  ${S(body.keywords, 500)}, ${tipoRisposta(body.tipoRisposta)}, ${S(body.risposta)}, ${S(body.url, 500)},
                  ${blocchiOk(body.blocchi)}::jsonb, 'manuale', TRUE,
                  COALESCE((SELECT MAX(sort_order) + 1 FROM procedura WHERE brand = ${brand}), 0))
          RETURNING id`;
        invalidaCache();
        return json({ ok: true, id: row.id });
      }
      if (tipo === 'offerta') {
        const [row] = await sql`
          INSERT INTO offerta (brand, nome, tipo, scadenza, durata, luce, gas, comm, segmento, origine, attiva, sort_order)
          VALUES (${brand}, ${S(body.nome, 200)}, ${S(body.tipoOfferta, 50)}, ${S(body.scadenza, 50)}, ${S(body.durata, 50)},
                  ${S(body.luce, 200)}, ${S(body.gas, 200)}, ${S(body.comm, 200)}, ${S(body.segmento, 20)}, 'manuale', TRUE,
                  COALESCE((SELECT MAX(sort_order) + 1 FROM offerta WHERE brand = ${brand}), 0))
          RETURNING id`;
        invalidaCache();
        return json({ ok: true, id: row.id });
      }
      if (tipo === 'contatto') {
        const id = S(body.id, 80) || (brand + ':c' + Date.now());
        const [row] = await sql`
          INSERT INTO contatto (id, brand, area, ufficio, richieste, tel, email, orari, link, nota, origine, attivo, sort_order)
          VALUES (${id}, ${brand}, ${S(body.area, 120)}, ${S(body.ufficio, 200)}, ${S(body.richieste, 500)},
                  ${S(body.tel, 80)}, ${S(body.email, 200)}, ${S(body.orari, 200)}, ${S(body.link, 500)}, ${S(body.nota, 500)},
                  'manuale', TRUE, COALESCE((SELECT MAX(sort_order) + 1 FROM contatto WHERE brand = ${brand}), 0))
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
            titolo = ${S(body.titolo, 200)}, sottotitolo = ${S(body.sottotitolo, 300)},
            etichetta = ${S(body.etichetta, 60)}, keywords = ${S(body.keywords, 500)},
            tipo = ${tipoRisposta(body.tipoRisposta)}, risposta = ${S(body.risposta)}, url = ${S(body.url, 500)},
            blocchi = ${blocchiOk(body.blocchi)}::jsonb,
            attiva = ${body.attiva !== false}, updated_at = NOW()
          WHERE id = ${S(body.id, 80)}`;
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
            comm = ${S(body.comm, 200)}, segmento = ${S(body.segmento, 20)},
            attiva = ${body.attiva !== false}, updated_at = NOW()
          WHERE id = ${id}`;
        invalidaCache();
        return json({ ok: true });
      }
      if (tipo === 'contatto') {
        if (!body.id) return json({ error: 'id mancante' }, 400);
        await sql`
          UPDATE contatto SET
            area = ${S(body.area, 120)}, ufficio = ${S(body.ufficio, 200)}, richieste = ${S(body.richieste, 500)},
            tel = ${S(body.tel, 80)}, email = ${S(body.email, 200)}, orari = ${S(body.orari, 200)},
            link = ${S(body.link, 500)}, nota = ${S(body.nota, 500)},
            attivo = ${body.attiva !== false}, updated_at = NOW()
          WHERE id = ${S(body.id, 80)}`;
        invalidaCache();
        return json({ ok: true });
      }
      return json({ error: 'tipo non valido' }, 400);
    }

    if (request.method === 'DELETE') {
      if (tipo === 'procedura')      await sql`DELETE FROM procedura WHERE id = ${S(body.id, 80)}`;
      else if (tipo === 'offerta')   await sql`DELETE FROM offerta   WHERE id = ${Number(body.id)}`;
      else if (tipo === 'contatto')  await sql`DELETE FROM contatto  WHERE id = ${S(body.id, 80)}`;
      else return json({ error: 'tipo non valido' }, 400);
      invalidaCache();
      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ error: 'DB: ' + (err.message || 'errore') }, 500);
  }
}
