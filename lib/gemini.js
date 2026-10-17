// Interpretazione del messaggio libero del dealer tramite Gemini (REST API).
// Restituisce una classificazione JSON; il testo delle risposte NON viene generato
// dall'AI ma preso dalla nostra knowledge base (risposte sempre vetted e corrette).

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];

function buildPrompt(message, procedure, nomeBrand) {
  const elenco = (procedure || [])
    .filter(p => !String(p.id || '').includes('fissa-'))
    .map(p => `- ${p.id}: ${p.label}${p.sottotitolo ? ' (' + p.sottotitolo + ')' : ''}`).join('\n');
  return `Sei l'assistente di un portale di supporto per i punti vendita (dealer) che vendono energia del brand ${nomeBrand || ''}.
Il dealer ha scritto questo messaggio:
"""${message}"""

Devi capire di cosa ha bisogno e rispondere SOLO con un JSON valido, senza testo attorno, in questo formato:
{"intent": "portale" | "offerte" | "contatti" | "avanzamento" | "unclear", "procedureId": "<id o null>", "offerFilter": "<testo o null>"}

Regole:
- "portale": chiede COME si fa qualcosa, o informazioni su una procedura/guida/modulo del brand. Metti in "procedureId" l'id piu' pertinente tra questi:
${elenco}
- "offerte": chiede prezzi, scadenze, spread, fee, commercializzazione o dettagli delle OFFERTE COMMERCIALI (il listino da proporre al cliente). In "offerFilter" riporta il testo utile a filtrarle (nome offerta, domestico/business).
- ATTENZIONE: "quanto costa" NON significa sempre offerte. Se la domanda riguarda il costo o i tempi di una OPERAZIONE SUL CONTATORE (voltura, switch con voltura, subentro, aumento o diminuzione di potenza, cambio tensione, verifica o spostamento del contatore, disalimentazione/stacco), allora e' "portale" e vai sulla procedura dei costi delle prestazioni, se presente nell'elenco.
- "contatti": chiede A CHI rivolgersi, un numero di telefono, una email, l'assistenza o il supporto. procedureId=null.
- "avanzamento": chiede IN GENERALE quando arrivano gli aggiornamenti/avanzamenti delle pratiche. procedureId=null.
- "unclear": non si capisce. procedureId=null, offerFilter=null.
Scegli un procedureId SOLO se e' davvero pertinente: se nessuno lo e', usa un altro intent.
Rispondi solo con il JSON.`;
}

async function callModel(model, prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' }
    })
  });
  if (!res.ok) throw new Error('Gemini ' + res.status);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.parse(text);
}

// Ritorna { intent, procedureId, offerFilter } oppure null se l'AI non è disponibile.
// `procedure` è l'elenco letto dal DB (passato da ask.js per non interrogarlo due volte).
export async function interpret(message, procedure, nomeBrand) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !message) return null;
  const prompt = buildPrompt(message, procedure, nomeBrand);
  for (const model of MODELS) {
    try {
      const out = await callModel(model, prompt, apiKey);
      if (out && out.intent) return out;
    } catch (e) {
      // prova il modello successivo
    }
  }
  return null;
}

/* =========================================================
   RISPOSTA DALLE FONTI
   L'AI legge il testo completo del portale info-utili del brand e scrive una
   risposta breve citando le sezioni usate. Il server poi controlla che le
   fonti citate esistano e che ogni numero scritto compaia nelle fonti
   (lib/fonti.js): se il controllo non passa la risposta scritta si scarta.
   ========================================================= */
const SCHEMA_RISPOSTA = {
  type: 'OBJECT',
  properties: {
    esito: { type: 'STRING', enum: ['risposta', 'contatti', 'chiarimento', 'avanzamento', 'non_trovato'] },
    risposta: { type: 'STRING' },
    fonti: { type: 'ARRAY', items: { type: 'STRING' } },
    domanda: { type: 'STRING' },
    opzioni: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: ['esito', 'risposta', 'fonti']
};

function buildPromptFonti(fontiTesto, message, nomeBrand) {
  return `Sei l'assistente del Supporto Dealer per i punti vendita che vendono energia ${nomeBrand}.
Le FONTI qui sotto sono il contenuto ufficiale del portale "Info utili" ${nomeBrand}: procedure, offerte in vendita oggi con le loro condizioni, contatti, regole.

===== FONTI ${nomeBrand.toUpperCase()} =====
${fontiTesto}
===== FINE FONTI =====

Regole, da rispettare sempre:
1. Rispondi SOLO con quello che c'e' scritto nelle FONTI. Non usare conoscenze tue, non dedurre regole che non sono scritte, non mescolare con altri brand.
2. Prezzi, importi, telefoni, email, giorni, scadenze e codici vanno copiati ESATTAMENTE come nelle fonti, con la stessa unita' di misura. Non arrotondare e non fare conti, salvo una somma esplicitamente richiesta tra due valori scritti nella stessa fonte.
3. Se le fonti non contengono la risposta, usa esito "non_trovato" e in "risposta" spiega in una riga che nelle informazioni ${nomeBrand} questo dato non c'e'. Mai inventare.
4. Se la domanda puo' riferirsi a cose diverse con risposte diverse (es. luce o gas, domestico o business, due offerte, due operazioni), e dalle parole del dealer non si capisce quale, usa esito "chiarimento": in "domanda" una domanda breve, in "opzioni" da 2 a 4 scelte brevi (massimo 6 parole ciascuna). Se invece la risposta e' corta per tutte le alternative, rispondi direttamente distinguendole.
5. Se il dealer chiede a chi rivolgersi, un numero, una email o l'assistenza: esito "contatti", rispondi col riferimento giusto e cita le sezioni contatto usate.
6. Se chiede IN GENERALE quando arrivano gli aggiornamenti/avanzamenti delle pratiche: esito "avanzamento".
7. "risposta": in italiano, dando del tu, tono professionale e diretto. Prima la risposta precisa in una frase, poi solo i dettagli utili (massimo 6 righe). Puoi usare righe che iniziano con "- " per gli elenchi e **grassetto** per i valori chiave. Niente saluti, niente "secondo le fonti".
8. "fonti": gli ID esatti (quelli tra [ID: ...]) delle sezioni da cui hai preso le informazioni, dal piu' importante. Obbligatorio per "risposta" e "contatti".
9. Se un'offerta o un'operazione NON e' ammessa per ${nomeBrand} e le fonti lo dicono, dillo chiaramente.

Domanda del dealer:
"""${message}"""

Rispondi solo con il JSON.`;
}

async function callModelFonti(model, prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: SCHEMA_RISPOSTA,
          thinkingConfig: { thinkingBudget: model.includes('lite') ? 512 : 1024 }
        }
      })
    });
    if (!res.ok) throw new Error('Gemini ' + res.status);
    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

// Ritorna { esito, risposta, fonti, domanda, opzioni } oppure null se l'AI non risponde.
export async function rispondiDaFonti(message, fontiTesto, nomeBrand) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !message || !fontiTesto) return null;
  const prompt = buildPromptFonti(fontiTesto, message, nomeBrand || '');
  for (const model of ['gemini-2.5-flash', 'gemini-2.5-flash-lite']) {
    try {
      const out = await callModelFonti(model, prompt, apiKey);
      if (out && out.esito) return out;
    } catch (e) {
      // prova il modello successivo
    }
  }
  return null;
}

/* =========================================================
   LETTURA BOLLETTA (PDF) — solo ESTRAZIONE DATI, niente calcoli.
   L'AI legge i numeri dalla bolletta; il confronto/risparmio lo fa
   il comparatore ACEA con le sue formule. Nessun prezzo generato qui.
   Modelli che leggono i PDF (i "-lite" sono meno affidabili sui documenti).
   ========================================================= */
const MODELS_DOC = ['gemini-2.5-flash', 'gemini-flash-latest'];

function buildPromptBolletta() {
  return `Sei un assistente che legge una bolletta di energia (luce o gas) del mercato italiano allegata come PDF.
Estrai SOLO i dati presenti, senza inventare nulla. Prendi i valori dalla sezione "SCONTRINO DELL'ENERGIA" (standard ARERA), NON dagli "elementi di dettaglio".

Rispondi SOLO con un JSON valido, senza testo attorno, in questo formato:
{
  "servizio": "gas" | "luce" | "entrambi",
  "tipoCliente": "domestico" | "business",
  "intestatario": "<nome e cognome dell'intestatario, o la ragione sociale se business, o null>",
  "fornitore": "<nome fornitore attuale o null>",
  "nomeOfferta": "<nome offerta attuale o null>",
  "mesi": ["gennaio","febbraio",...],
  "consumoAnnuo": <numero o null>,
  "gas": { "smcFatturati": <numero>, "quotaConsumi": <numero>, "quotaFissa": <numero> } | null,
  "luce": { "kwhFatturati": <numero>, "quotaConsumi": <numero>, "quotaFissa": <numero> } | null,
  "affidabile": true | false,
  "note": "<eventuale problema di lettura o null>"
}

Regole importanti:
- "intestatario": il nome e cognome dell'intestatario della fornitura (per un cliente domestico) oppure la ragione sociale (per un cliente business/P.IVA), così come scritto nell'intestazione della bolletta. Se non è leggibile, null.
- "mesi": elenco dei mesi di calendario coperti dal periodo di fatturazione, nomi in italiano minuscolo (es. periodo 01/05 - 30/06 => ["maggio","giugno"]; "Giugno 2026" => ["giugno"]).
- ATTENZIONE agli importi da prendere: NON il totale in grassetto, ma SOLO la sotto-voce "di cui spesa per la vendita" (la parte fissata dal venditore). Lo scontrino, sia sotto "QUOTA PER CONSUMI" sia sotto "QUOTA FISSA", riporta un totale in grassetto e poi due righe "di cui...": una "di cui spesa per la vendita di gas naturale" (per la luce: "di cui spesa per la materia/vendita energia") e una "di cui spesa per la rete e gli oneri generali di sistema".
- "quotaConsumi": prendi il valore della riga "di cui spesa per la vendita di gas naturale" (o, per la luce, "di cui spesa per la materia/vendita energia") che sta SOTTO "QUOTA PER CONSUMI". NON il totale in grassetto. NON la riga "rete e oneri". NON accise/IVA.
- "quotaFissa": prendi il valore della riga "di cui spesa per la vendita di gas naturale" (o materia energia per la luce) che sta SOTTO "QUOTA FISSA". NON il totale in grassetto. NON la riga "rete e oneri". NON accise/IVA.
- Esempio (gas): se sotto QUOTA PER CONSUMI c'è totale 124,78 con "di cui spesa per la vendita di gas naturale 91,46" e "di cui rete e oneri 33,32", allora quotaConsumi = 91.46. Se sotto QUOTA FISSA c'è totale 23,93 con "di cui spesa per la vendita di gas naturale 16,00", allora quotaFissa = 16.00.
- Se una delle due righe "di cui spesa per la vendita" vale 0 o non è presente ma c'è il totale, usa 0 solo se davvero la spesa di vendita è 0; altrimenti usa la sotto-voce di vendita.
- "smcFatturati"/"kwhFatturati": la quantità consumata nel periodo (Smc per il gas, kWh per la luce).
- Se la bolletta è solo gas, "luce" = null; se è solo luce, "gas" = null.
- Tutti gli importi come numeri con punto decimale (es. 91.46), senza simbolo euro.
- "affidabile" = false se il PDF è un'immagine/scansione illeggibile o mancano i dati chiave dello scontrino.
Rispondi solo con il JSON.`;
}

async function callModelPdf(model, prompt, pdfBase64, mimeType, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [
        { inlineData: { mimeType: mimeType || 'application/pdf', data: pdfBase64 } },
        { text: prompt }
      ] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' }
    })
  });
  if (!res.ok) throw new Error('Gemini ' + res.status);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.parse(text);
}

// Estrae i dati dalla bolletta PDF.
// Ritorna { dati, errore } dove errore è:
//   null        -> ok, dati valorizzato
//   'quota'     -> limite di richieste Gemini raggiunto (HTTP 429): riprovare più tardi
//   'servizio'  -> Gemini momentaneamente non disponibile/sovraccarico: riprovare
//   'illeggibile' -> Gemini ha risposto ma non ha trovato i dati (PDF senza testo/immagine)
//   'config'    -> chiave AI non configurata
export async function estraiBolletta(pdfBase64, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !pdfBase64) return { dati: null, errore: 'config' };
  const prompt = buildPromptBolletta();
  let ultimoStatus = 0, haRisposto = false;
  for (const model of MODELS_DOC) {
    try {
      const out = await callModelPdf(model, prompt, pdfBase64, mimeType, apiKey);
      haRisposto = true;
      if (out && (out.gas || out.luce)) return { dati: out, errore: null };
    } catch (e) {
      const m = /Gemini (\d+)/.exec(e && e.message || '');
      if (m) ultimoStatus = parseInt(m[1], 10);
    }
  }
  if (ultimoStatus === 429) return { dati: null, errore: 'quota' };
  if (ultimoStatus === 500 || ultimoStatus === 503) return { dati: null, errore: 'servizio' };
  if (haRisposto) return { dati: null, errore: 'illeggibile' };
  return { dati: null, errore: 'servizio' };
}
