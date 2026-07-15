# Supporto Dealer On Line

Assistente AI per i dealer ACEA, raggiungibile via link (anche da WhatsApp Business).
Il dealer scrive in linguaggio naturale, l'assistente risponde dalla knowledge base;
se serve un controllo pratica, la richiesta viene inoltrata via email al collega **Simone**.
Mario (admin) e Simone vedono tutte le richieste nella **dashboard protetta**.

Stack: **Vercel** (frontend statico + funzioni serverless) · **Neon Postgres** · **Gemini** (interpretazione) · **Gmail SMTP** (email).
Stessa impostazione del progetto *Pannello Segnalazioni*.

---

## Struttura

```
SUPPORTO DEALER/
├── index.html            frontend: vista Dealer + vista Admin
├── assets/montserrat.woff2
├── api/                  funzioni serverless (Vercel Edge)
│   ├── ask.js            interpreta il messaggio + salva il ticket
│   ├── escalate.js       invia a Simone (email) + aggiorna il ticket
│   ├── feedback.js       registra se la risposta è bastata
│   ├── tickets.js        dashboard (protetta) + validazione risposte
│   ├── login.js / logout.js / session.js
├── lib/
│   ├── kb.js             procedure ACEA + offerte (il "cervello")
│   ├── negozi.js         elenco negozi + match nomi abbreviati
│   ├── gemini.js / email.js / db.js / auth.js
├── schema.sql            tabella `ticket`
├── package.json
└── .env.local.example
```

Per aggiornare **offerte/prezzi** o **procedure**: modifica `lib/kb.js`.
Per aggiornare l'**elenco negozi**: `lib/negozi.js`.

---

## Messa online (una volta sola)

### 1) Database Neon
1. Vai su https://console.neon.tech → **New Project** → nome `supporto-dealer`, region *Europe (Frankfurt)*.
2. Apri **SQL Editor**, incolla e lancia il contenuto di [`schema.sql`](./schema.sql).
3. In **Connection Details** copia la **Connection string** (`postgresql://…?sslmode=require`).

### 2) Chiave Gemini (gratuita)
- Vai su https://aistudio.google.com/apikey → **Create API key** → copiala.

### 3) Email (Gmail via SMTP — affidabile, no DNS)
Le email partono da un account Gmail: Google le firma correttamente, quindi arrivano
in posta in arrivo (non spam). Il mittente mostrato sarà l'indirizzo Gmail con nome "Supporto Dealer".
1. Usa un account Gmail (il tuo o uno dedicato, es. `supportodealer.e2k@gmail.com`).
2. Attiva la **Verifica in due passaggi**: https://myaccount.google.com/security
3. Crea una **Password per le app**: https://myaccount.google.com/apppasswords → scegli "Mail" → copia la password di 16 caratteri.
4. Userai `GMAIL_USER` (l'indirizzo) e `GMAIL_APP_PASSWORD` (i 16 caratteri) nelle variabili Vercel.

### 4) Deploy su Vercel
```bash
cd "HTML MARIO/SUPPORTO DEALER"
git init && git add . && git commit -m "Supporto Dealer MVP"
# crea un repo vuoto su GitHub e collega:
git branch -M main
git remote add origin <URL_REPO>
git push -u origin main
```
Poi su https://vercel.com → **Add New → Project** → importa il repo.
In **Settings → Domains** imposta `supportoacea.vercel.app`.

### 5) Variabili d'ambiente (Vercel → Settings → Environment Variables)
Aggiungi per **Production, Preview e Development** (vedi `.env.local.example`):

| Nome | Valore |
|---|---|
| `DATABASE_URL` | connection string Neon (passo 1) |
| `AUTH_EMAIL` | `mario.isernia@e2kdistribution.com` |
| `AUTH_PASSWORD` | password admin a tua scelta |
| `AUTH_EMAIL_SIMONE` | `simone.censi@e2kdistribution.com` |
| `AUTH_PASSWORD_SIMONE` | password per Simone |
| `SESSION_SECRET` | random ≥32 char (`openssl rand -base64 48`) |
| `GEMINI_API_KEY` | chiave Gemini (passo 2) |
| `GMAIL_USER` | l'indirizzo Gmail mittente (passo 3) |
| `GMAIL_APP_PASSWORD` | la Password per le app di 16 caratteri (passo 3) |
| `MAIL_FROM_NAME` | `Supporto Dealer` |
| `MAIL_ADMIN` | `mario.isernia@e2kdistribution.com` |
| `MAIL_SIMONE` | `simone.censi@e2kdistribution.com` |

Dopo aver salvato le variabili → **Redeploy** l'ultimo deployment.

---

## Uso

- **Link dealer** (pubblico): `https://supportoacea.vercel.app/` — da mettere su WhatsApp Business.
- **Dashboard**: stessa URL → in alto a destra "Vista Admin" → login con email + password.
  Accedono solo Mario e Simone. Simone interviene sulle richieste con stato **Intervento Simone**.

## Come funziona la risposta

1. Il dealer scrive liberamente → `ask.js` chiede a **Gemini** di capire l'intento
   (portale / cliente / offerte). Se Gemini non è disponibile, un fallback a parole-chiave garantisce la risposta.
2. Il **testo** della risposta non è mai inventato dall'AI: viene preso dalla knowledge base (`lib/kb.js`),
   così le risposte restano corrette. Gemini decide solo *quale* risposta serve.
3. Se il dealer insiste (o serve un controllo cliente) → chiede CF + n° opportunity → email a Simone.

## Sviluppo locale (opzionale)
```bash
npm i -g vercel
cp .env.local.example .env.local   # compila i valori
vercel dev                          # http://localhost:3000
```

## Note
- L'elenco negozi è una copia (89 negozi) da Pannello Segnalazioni. In futuro si può leggere
  direttamente dallo stesso DB Neon per avere una fonte unica.
- Categorie/colori attuali: portale=giallo, cliente=rosso, offerte=verde. Affinabili in `api/ask.js`.
