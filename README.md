# Supporto Dealer On Line

Assistente AI per i dealer ACEA, raggiungibile via link (anche da WhatsApp Business).
Il dealer scrive in linguaggio naturale, l'assistente risponde dalla knowledge base;
se serve un controllo pratica, la richiesta viene inoltrata via email al collega **Simone**.
Mario (admin) e Simone vedono tutte le richieste nella **dashboard protetta**.

Stack: **Vercel** (frontend statico + funzioni serverless) · **Neon Postgres** · **Gemini** (interpretazione) · **Resend** (email).
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

## Aggiornare i contenuti — SENZA deploy

| Cosa | Dove si aggiorna | Effetto |
|---|---|---|
| **Procedure e risposte** (testi, parole chiave, guide) | Dashboard → **Contenuti** | immediato |
| **Offerte** (prezzi, scadenze, commercializzazione) | Dashboard → **Contenuti** | immediato |
| **Negozi** (nomi, SIS/SUB) | **Pannello Segnalazioni** (come già fai oggi, anche con l'import Excel) | entro 1 minuto |

I file `lib/kb.js` e `lib/negozi.js` restano solo come **fallback di emergenza**: vengono usati
unicamente se il database non risponde, così l'assistente continua a rispondere comunque.

---

## Messa online (una volta sola)

### 1) Database Neon
1. Vai su https://console.neon.tech → **New Project** → nome `supporto-dealer`, region *Europe (Frankfurt)*.
2. Apri **SQL Editor**, incolla e lancia il contenuto di [`schema.sql`](./schema.sql) (tabella dei ticket).
3. Sempre nel SQL Editor, lancia anche [`schema-contenuti.sql`](./schema-contenuti.sql): crea le tabelle
   `procedura` e `offerta` **già riempite** con i contenuti attuali. Da lì in poi si modificano dal
   pannello **Contenuti** della dashboard, senza deploy.
4. In **Connection Details** copia la **Connection string** (`postgresql://…?sslmode=require`).
5. *(consigliato)* Apri anche il progetto Neon di **Segnalazioni** e copia la sua connection string:
   serve per leggere i negozi (SIS/SUB) da lì, così li gestisci in un posto solo.

### 2) Chiave Gemini (gratuita)
- Vai su https://aistudio.google.com/apikey → **Create API key** → copiala.

### 3) Email (Resend + regola di inoltro)
1. Registrati su https://resend.com **con l'email di Mario** → **API Keys** → crea una chiave (`re_…`).
2. Senza dominio verificato, Resend usa il mittente di prova `onboarding@resend.dev` e consegna
   **solo all'indirizzo dell'account Resend** (Mario). Per questo:
   - `MAIL_ADMIN` = email di Mario
   - `MAIL_SIMONE` = **email di Mario** (non di Simone)
3. Nella casella di Mario crea una **regola di inoltro automatico**: le email con oggetto che
   contiene **"Intervento richiesto"** vengono inoltrate a `simone.censi@e2kdistribution.com`.
   Così Simone riceve le richieste e Mario le vede comunque (è la sua copia per conoscenza).

> Il codice riconosce questo setup: se `MAIL_ADMIN` e `MAIL_SIMONE` sono uguali, **non** invia
> la copia "per conoscenza" separata, per non mandarti due email identiche.

**Quando il dominio sarà verificato** (Resend → Domains, serve accesso DNS): rimetti in
`MAIL_SIMONE` l'indirizzo vero di Simone e togli la regola. Nessuna modifica al codice.

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
| `DATABASE_URL` | connection string Neon di `supporto-dealer` (passo 1) |
| `SEGNALAZIONI_DATABASE_URL` | connection string Neon di *Segnalazioni* (per i negozi). Se omessa, usa l'elenco statico |
| `AUTH_EMAIL` | `mario.isernia@e2kdistribution.com` |
| `AUTH_PASSWORD` | password admin a tua scelta |
| `AUTH_EMAIL_SIMONE` | `simone.censi@e2kdistribution.com` |
| `AUTH_PASSWORD_SIMONE` | password per Simone |
| `SESSION_SECRET` | random ≥32 char (`openssl rand -base64 48`) |
| `GEMINI_API_KEY` | chiave Gemini (passo 2) |
| `RESEND_API_KEY` | chiave Resend (passo 3) |
| `MAIL_FROM` | `Supporto Dealer <onboarding@resend.dev>` |
| `MAIL_ADMIN` | `mario.isernia@e2kdistribution.com` |
| `MAIL_SIMONE` | `mario.isernia@e2kdistribution.com` ← Mario, poi la regola inoltra a Simone |

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
