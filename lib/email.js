// Invio email tramite Resend (https://resend.com), via API HTTP.
// Env: RESEND_API_KEY, MAIL_FROM (mittente), MAIL_ADMIN, MAIL_SIMONE.
//
// NOTA SUL SETUP ATTUALE (senza dominio verificato):
// Resend col mittente di prova `onboarding@resend.dev` consegna SOLO all'indirizzo
// dell'account Resend (Mario). Per questo MAIL_SIMONE è impostata sull'indirizzo di
// Mario e una regola di inoltro nella sua casella gira le email "Intervento richiesto"
// a Simone. Quando il dominio sarà verificato, basterà rimettere in MAIL_SIMONE
// l'indirizzo vero di Simone: il codice non cambia.

export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || 'Supporto Dealer <onboarding@resend.dev>';
  if (!apiKey) {
    console.warn('RESEND_API_KEY mancante: email non inviata');
    return { ok: false, skipped: true };
  }
  const toList = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!toList.length) return { ok: false, skipped: true };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: toList, subject, html })
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

function stessoIndirizzo(a, b) {
  return String(a || '').toLowerCase().trim() === String(b || '').toLowerCase().trim();
}

// Notifica al collega Simone: richiesta da controllare a portale.
// È questa l'email che la regola di inoltro deve girare a Simone.
export async function notificaSimone(ticket) {
  const to = process.env.MAIL_SIMONE;
  if (!to) return { ok: false, skipped: true };
  const subject = `[Supporto Dealer] Intervento richiesto — ${ticket.codice} (${ticket.negozio})`;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#12211e;line-height:1.6">
      <h2 style="color:#00a99d;margin:0 0 12px">Intervento richiesto — ${ticket.codice}</h2>
      <p>Un dealer ha bisogno di un controllo che l'assistente non ha potuto risolvere.</p>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0"><b>Negozio</b></td><td>${esc(ticket.negozio)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><b>SIS-SUB / Agenzia</b></td><td>${esc(ticket.sis_sub)} / ${esc(ticket.agenzia)}</td></tr>
        ${ticket.cf_cliente ? `<tr><td style="padding:4px 12px 4px 0"><b>Codice fiscale</b></td><td>${esc(ticket.cf_cliente)}</td></tr>` : ''}
        ${ticket.num_opportunity ? `<tr><td style="padding:4px 12px 4px 0"><b>N. opportunity</b></td><td>${esc(ticket.num_opportunity)}</td></tr>` : ''}
      </table>
      <p style="margin-top:12px"><b>Messaggio del dealer:</b><br>${esc(ticket.messaggio)}</p>
      ${ticket.nota_controllo ? `<p><b>Dettagli:</b><br>${esc(ticket.nota_controllo)}</p>` : ''}
      <p style="color:#4d6864;font-size:12px;margin-top:16px">Ticket ${ticket.codice} · Supporto Dealer On Line</p>
    </div>`;
  return sendEmail({ to, subject, html });
}

// Copia "per conoscenza" a Mario quando una richiesta viene inoltrata a Simone.
// Se MAIL_SIMONE punta già alla casella di Mario (setup con regola di inoltro),
// la mail sopra è di fatto la sua copia: evitiamo di mandarne due identiche.
export async function notificaAdminEscalation(ticket) {
  const to = process.env.MAIL_ADMIN;
  if (!to) return { ok: false, skipped: true };
  if (stessoIndirizzo(to, process.env.MAIL_SIMONE)) return { ok: true, skipped: true };
  const subject = `[Supporto Dealer] Per conoscenza — inoltrata a Simone — ${ticket.codice} (${ticket.negozio})`;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#12211e;line-height:1.6">
      <h2 style="color:#a8791f;margin:0 0 12px">Richiesta inoltrata a Simone — ${ticket.codice}</h2>
      <p>Ti mando questa copia per conoscenza: una richiesta è stata girata a Simone.</p>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0"><b>Negozio</b></td><td>${esc(ticket.negozio)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><b>SIS-SUB / Agenzia</b></td><td>${esc(ticket.sis_sub)} / ${esc(ticket.agenzia)}</td></tr>
        ${ticket.cf_cliente ? `<tr><td style="padding:4px 12px 4px 0"><b>Codice fiscale</b></td><td>${esc(ticket.cf_cliente)}</td></tr>` : ''}
        ${ticket.num_opportunity ? `<tr><td style="padding:4px 12px 4px 0"><b>N. opportunity</b></td><td>${esc(ticket.num_opportunity)}</td></tr>` : ''}
      </table>
      <p style="margin-top:12px"><b>Messaggio del dealer:</b><br>${esc(ticket.messaggio)}</p>
      ${ticket.nota_controllo ? `<p><b>Dettagli:</b><br>${esc(ticket.nota_controllo)}</p>` : ''}
      <p style="color:#4d6864;font-size:12px;margin-top:16px">Ticket ${ticket.codice} · Supporto Dealer On Line</p>
    </div>`;
  return sendEmail({ to, subject, html });
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
