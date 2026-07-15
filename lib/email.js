// Invio email tramite Resend (https://resend.com) — free tier ampio.
// Env: RESEND_API_KEY, MAIL_FROM (mittente verificato), MAIL_ADMIN, MAIL_SIMONE.

export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || 'Supporto Dealer <onboarding@resend.dev>';
  if (!apiKey) {
    console.warn('RESEND_API_KEY mancante: email non inviata');
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html })
    });
    if (!res.ok) {
      const t = await res.text();
      console.error('Resend error', res.status, t);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error('Email fetch error', e);
    return { ok: false };
  }
}

// Notifica al collega Simone: richiesta da controllare a portale.
export async function notificaSimone(ticket) {
  const to = process.env.MAIL_SIMONE;
  if (!to) return { ok: false, skipped: true };
  const subject = `[Supporto Dealer] Intervento richiesto — ${ticket.codice} (${ticket.negozio})`;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#12211e;line-height:1.6">
      <h2 style="color:#00a99d;margin:0 0 12px">Intervento richiesto — ${ticket.codice}</h2>
      <p>Un dealer ha bisogno di un controllo pratica che l'assistente non ha potuto risolvere.</p>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0"><b>Negozio</b></td><td>${esc(ticket.negozio)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><b>SIS-SUB / Agenzia</b></td><td>${esc(ticket.sis_sub)} / ${esc(ticket.agenzia)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><b>Codice fiscale</b></td><td>${esc(ticket.cf_cliente)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><b>N. opportunity</b></td><td>${esc(ticket.num_opportunity)}</td></tr>
      </table>
      <p style="margin-top:12px"><b>Messaggio del dealer:</b><br>${esc(ticket.messaggio)}</p>
      ${ticket.nota_controllo ? `<p><b>Nota per il controllo:</b><br>${esc(ticket.nota_controllo)}</p>` : ''}
      <p style="color:#4d6864;font-size:12px;margin-top:16px">Ticket ${ticket.codice} · Supporto Dealer On Line</p>
    </div>`;
  return sendEmail({ to, subject, html });
}

// Avviso all'admin per una richiesta ROSSA (urgente).
export async function notificaRosso(ticket) {
  const to = process.env.MAIL_ADMIN;
  if (!to) return { ok: false, skipped: true };
  const subject = `[Supporto Dealer] 🔴 Richiesta urgente — ${ticket.codice} (${ticket.negozio})`;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#12211e;line-height:1.6">
      <h2 style="color:#c14f3f;margin:0 0 12px">Richiesta urgente — ${ticket.codice}</h2>
      <p><b>Negozio:</b> ${esc(ticket.negozio)}<br>
         <b>Categoria:</b> ${esc(ticket.categoria)}</p>
      <p><b>Messaggio:</b><br>${esc(ticket.messaggio)}</p>
    </div>`;
  return sendEmail({ to, subject, html });
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
