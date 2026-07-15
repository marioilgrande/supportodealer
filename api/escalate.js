import { json } from '../lib/auth.js';
import { sql } from '../lib/db.js';
import { notificaSimone, notificaAdminEscalation } from '../lib/email.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const id = Number(body.ticketId);
  const kind = body.kind === 'altro' ? 'altro' : 'pratica';
  if (!id) return json({ error: 'ticketId mancante' }, 400);

  let cf = '', opportunity = '', nota = '';
  if (kind === 'pratica') {
    cf = (body.cf || '').toString().slice(0, 40).trim();
    opportunity = (body.opportunity || '').toString().slice(0, 60).trim();
    nota = (body.nota || '').toString().slice(0, 2000);
    if (!cf || !opportunity) return json({ error: 'Codice fiscale e numero opportunity obbligatori' }, 400);
  } else {
    // Richiesta di contatto: il dealer lascia i riferimenti per essere richiamato
    const referente = (body.referente || '').toString().slice(0, 120).trim();
    const contatto = (body.contatto || '').toString().slice(0, 120).trim();
    const descr = (body.nota || '').toString().slice(0, 2000).trim();
    if (!referente || !contatto) return json({ error: 'Nome e un recapito (telefono o email) obbligatori' }, 400);
    nota = `RICHIESTA DI CONTATTO — Referente: ${referente} · Recapito: ${contatto}${descr ? ' · ' + descr : ''}`;
  }

  let ticket;
  try {
    const [row] = await sql`
      UPDATE ticket SET
        cf_cliente = ${cf}, num_opportunity = ${opportunity}, nota_controllo = ${nota},
        esito = 'intervento_simone', updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, codice, negozio, sis_sub, agenzia, messaggio, cf_cliente, num_opportunity, nota_controllo
    `;
    ticket = row;
  } catch (err) {
    return json({ error: 'DB: ' + (err.message || 'errore') }, 500);
  }
  if (!ticket) return json({ error: 'Ticket non trovato' }, 404);

  try { await notificaSimone(ticket); } catch {}
  try { await notificaAdminEscalation(ticket); } catch {}

  return json({ ok: true, sisSub: ticket.sis_sub, agenzia: ticket.agenzia, nome: ticket.negozio });
}
