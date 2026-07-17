// Interpretazione del messaggio libero del dealer tramite Gemini (REST API).
// Restituisce una classificazione JSON; il testo delle risposte NON viene generato
// dall'AI ma preso dalla nostra knowledge base (risposte sempre vetted e corrette).

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];

function buildPrompt(message, procedure) {
  const elenco = (procedure || [])
    .filter(p => !String(p.id || '').startsWith('fissa-'))
    .map(p => `- ${p.id}: ${p.label}`).join('\n');
  return `Sei l'assistente di un portale di supporto per rivenditori (dealer) di energia ACEA.
Il dealer ha scritto questo messaggio:
"""${message}"""

Devi capire di cosa ha bisogno e rispondere SOLO con un JSON valido, senza testo attorno, in questo formato:
{"intent": "portale" | "cliente" | "offerte" | "disservizio" | "avanzamento" | "otp" | "unclear", "procedureId": "<id o null>", "offerFilter": "<sprint|flex|fix|business|domestico|tutte o null>"}

Regole:
- "portale": chiede COME si fa un'operazione sul portale (procedura). In tal caso metti "procedureId" con l'id più pertinente tra questi:
${elenco}
- "cliente": deve VERIFICARE la pratica/situazione di uno specifico cliente (stato, errore su una pratica, non risulta, controllo). procedureId=null.
- "offerte": chiede prezzi, scadenze o dettagli delle offerte commerciali. Imposta offerFilter se cita un'offerta (sprint/flex/fix) o un segmento (business/domestico), altrimenti "tutte".
- "disservizio": il PORTALE stesso non funziona / è in errore / down / non accessibile (problema tecnico generale, non una singola pratica). procedureId=null.
- "avanzamento": chiede IN GENERALE quando arrivano gli aggiornamenti/avanzamenti delle pratiche (non un cliente specifico). procedureId=null.
- "otp": il cliente NON riceve il codice OTP (via sms/email) per firmare/confermare. Diverso da "portale" (che spiega dove TROVARE il link di firma). procedureId=null.
- "unclear": non si capisce. procedureId=null, offerFilter=null.
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
export async function interpret(message, procedure) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !message) return null;
  const prompt = buildPrompt(message, procedure);
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
- "mesi": elenco dei mesi di calendario coperti dal periodo di fatturazione, nomi in italiano minuscolo (es. periodo 01/05 - 30/06 => ["maggio","giugno"]; "Giugno 2026" => ["giugno"]).
- "quotaConsumi": importo in euro della voce "QUOTA PER CONSUMI" dello scontrino (comprende materia + rete + oneri; è il totale legato ai consumi). NON includere accise e IVA.
- "quotaFissa": importo in euro della voce "QUOTA FISSA" dello scontrino (comprende materia + rete). NON includere accise e IVA.
- "smcFatturati"/"kwhFatturati": la quantità consumata nel periodo (Smc per il gas, kWh per la luce).
- Se la bolletta è solo gas, "luce" = null; se è solo luce, "gas" = null.
- Tutti gli importi come numeri con punto decimale (es. 124.78), senza simbolo euro.
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

// Estrae i dati dalla bolletta PDF. Ritorna l'oggetto JSON oppure null.
export async function estraiBolletta(pdfBase64, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !pdfBase64) return null;
  const prompt = buildPromptBolletta();
  for (const model of MODELS_DOC) {
    try {
      const out = await callModelPdf(model, prompt, pdfBase64, mimeType, apiKey);
      if (out && (out.gas || out.luce)) return out;
    } catch (e) {
      // prova il modello successivo
    }
  }
  return null;
}
