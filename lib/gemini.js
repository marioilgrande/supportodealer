// Interpretazione del messaggio libero del dealer tramite Gemini (REST API).
// Restituisce una classificazione JSON; il testo delle risposte NON viene generato
// dall'AI ma preso dalla nostra knowledge base (risposte sempre vetted e corrette).

import { PROCEDURE } from './kb.js';

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];

function buildPrompt(message) {
  const elenco = PROCEDURE.map(p => `- ${p.id}: ${p.label}`).join('\n');
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
export async function interpret(message) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !message) return null;
  const prompt = buildPrompt(message);
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
