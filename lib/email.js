// Invio email tramite Gmail (SMTP) — consegna affidabile in posta in arrivo,
// perché Google firma le proprie email (SPF/DKIM/DMARC). Nessun DNS da configurare.
// Env: GMAIL_USER (indirizzo gmail mittente), GMAIL_APP_PASSWORD (App Password Google),
//      MAIL_FROM_NAME (nome visualizzato), MAIL_ADMIN, MAIL_SIMONE.
// Richiede il runtime Node (non Edge): vedi api/ask.js e api/escalate.js.
import nodemailer from 'nodemailer';

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, ''); // toglie spazi dall'App Password
  if (!user || !pass) return null;
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user, pass }
  });
  return transporter;
}

export async function sendEmail({ to, subject, html }) {
  const t = getTransporter();
  const user = process.env.GMAIL_USER;
  const fromName = process.env.MAIL_FROM_NAME || 'Supporto Dealer';
  if (!t || !user) {
    console.warn('GMAIL_USER / GMAIL_APP_PASSWORD mancante: email non inviata');
    return { ok: false, skipped: true };
  }
  const toList = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!toList.length) return { ok: false, skipped: true };
  try {
    await t.sendMail({ from: `"${fromName}" <${user}>`, to: toList.join(', '), subject, html });
    return { ok: true };
  } catch (e) {
    console.error('Email error', e);
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

// Copia "per conoscenza" a Mario quando una richiesta viene inoltrata a Simone.
export async function notificaAdminEscalation(ticket) {
  const to = process.env.MAIL_ADMIN;
  if (!to) return { ok: false, skipped: true };
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
