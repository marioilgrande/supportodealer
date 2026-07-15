// Knowledge base: procedure ACEA (testo pronto da "PROCEDURE PORTALE ACEA.docx")
// + guide-link (Canva). Ogni voce ha id, keywords, tipo (testo|link), risposta/url.
export const PROCEDURE = [
  {
    "label": "Link firma OTP / conferma (PDC o Subentro)",
    "type": "text",
    "answer": "Per risalire al link di firma/conferma (PDC o Subentro):\n1. Apri “Altre Prestazioni”\n2. Clicca su “Search for Consumer”\n3. Inserisci i dati fiscali del cliente\n4. Seleziona l’anagrafica\n5. Clicca sul nome del cliente (in blu)\n6. Vai nella scheda “Documenti”\n7. Guarda la sezione “Touch Point”\n8. Clicca sul codice “FM…” corrispondente all’offertazione\n9. Clicca sul link per procedere con l’accettazione, oppure invialo al cliente.",
    "id": "link-firma-otp-conferma",
    "keywords": [
      "otp",
      "firma",
      "link firma",
      "conferma",
      "touch point",
      "accettazione"
    ]
  },
  {
    "label": "Inserire offerta a carrello (associazione punti prodotti)",
    "type": "text",
    "answer": "Per inserire l’offerta a carrello (associazione punti prodotti):\n1. CONFIGURA\n2. Clicca su CHIAVE\n3. SELEZIONA → ASSOCIAZIONE PUNTI PRODOTTI\n4. Inserisci offerta luce e gas cliccando sul pallino corrispondente\n5. SALVA\n6. Clicca sulla chiave inglese\n7. Clicca sul pallino prezzo MONORARIO\n8. SALVA (x3)\n9. TORNA A OPPORTUNITY → AVANTI",
    "id": "inserire-offerta-a-carrello",
    "keywords": [
      "carrello",
      "associazione punti",
      "monorario",
      "offerta a carrello"
    ]
  },
  {
    "label": "Controllo stato / processi pratica",
    "type": "text",
    "answer": "Per controllare lo stato di una pratica:\n1. Apri “Altre Prestazioni” → “Search for Consumer”\n2. Inserisci i dati fiscali del cliente e seleziona l’anagrafica\n3. Clicca sul nome del cliente (in blu)\n4. Vai nella sezione PROCESSI\n5. Nel blocco CASES in alto seleziona il numero di CASE della pratica (SUBENTRO, SWITCHING, VOLTURA…)\n6. Vai su scheda CORRELATO → blocco integrato in case → seleziona IC-xxxxxxx per entrare nell’ordine\n\nA sinistra vedi subito se la pratica è OK, in lavorazione o in KO. A destra hai tutta la cronologia (clicca “visualizza tutto”) per capire eventuali KO o l’appuntamento gas per le attivazioni.",
    "id": "controllo-stato-processi-pratica",
    "keywords": [
      "stato pratica",
      "processi",
      "case",
      "a che punto",
      "ko",
      "in lavorazione"
    ]
  },
  {
    "label": "Modifica anagrafica (mail, telefono, indirizzo)",
    "type": "text",
    "answer": "Per modificare i dati anagrafici del cliente (mail, telefono, indirizzo):\n1. Dal portale ACEA apri ALTRE PRESTAZIONI\n2. Cerca il cliente per codice fiscale\n3. Seleziona l’anagrafica\n4. Clicca su INTERLOCUTOR CONTACT\n5. In alto a destra clicca COMPLETA CONTATTO\n6. Fai le modifiche permesse\n7. SALVA",
    "id": "modifica-anagrafica",
    "keywords": [
      "anagrafica",
      "recapito",
      "cambia mail",
      "cambio telefono",
      "cambio indirizzo"
    ]
  },
  {
    "label": "Primo accesso al portale ACEA",
    "type": "text",
    "answer": "Primo accesso al portale ACEA (appena ricevute le credenziali):\n1. Clicca sul link ricevuto via mail\n2. Inserisci username (è la mail su cui hai ricevuto la comunicazione)\n3. Fai “Forgot password”: così potrai completare la procedura di primo accesso\n4. Imposta la password\n5. Una volta entrato, esci e rientra per collegare l’app Authenticator di Google\n6. Inserisci il codice OTP generato dall’app: hai finito.",
    "id": "primo-accesso-al-portale-acea",
    "keywords": [
      "primo accesso",
      "credenziali",
      "password",
      "authenticator"
    ]
  },
  {
    "label": "Fare una voltura",
    "type": "text",
    "answer": "Per fare una voltura:\n1. Apri “Altre Prestazioni” → “Search for Consumer”\n2. Inserisci i dati fiscali del cliente che deve intestarsi l’utenza\n3. Seleziona l’anagrafica (se non c’è, creala)\n4. Clicca sul nome del cliente (in blu)\n5. Sulla destra clicca GESTIONE OFFERTA\n6. Aperta l’OP, vai avanti nel primo blocco, effettua il controllo SCIPAFI e inserisci POD o PDR per fare la voltura.",
    "id": "fare-una-voltura",
    "keywords": [
      "voltura"
    ]
  },
  {
    "label": "Fare un subentro",
    "type": "text",
    "answer": "Per fare un subentro:\n1. Apri “Altre Prestazioni” → “Search for Consumer”\n2. Inserisci i dati fiscali del cliente che deve intestarsi l’utenza\n3. Seleziona l’anagrafica (se non c’è, creala)\n4. Clicca sul nome del cliente (in blu)\n5. Sulla destra clicca GESTIONE OFFERTA\n6. Aperta l’OP, vai avanti nel primo blocco, effettua il controllo SCIPAFI e inserisci POD o PDR\n7. Seleziona la prestazione SUBENTRO o ATTIVAZIONE GAS\n\nRicorda di inserire i dati del titolo occupazionale (proprietario o locatario); se non li hai puoi metterli fittizi.",
    "id": "fare-un-subentro",
    "keywords": [
      "subentro",
      "contatore spento",
      "attivazione gas"
    ]
  },
  {
    "label": "Visionare fatture / controllare debiti cliente",
    "type": "text",
    "answer": "Per visionare le fatture del cliente:\n1. Apri “Altre Prestazioni” → “Search for Consumer”\n2. Inserisci i dati fiscali del cliente e seleziona l’anagrafica\n3. Clicca sul nome del cliente (in blu)\n4. Clicca sulla sezione FATTURE\n\nDa qui vedi le fatture e controlli i debiti. Per reinviare una fattura o un documento al cliente usa GESTIONE DUPLICATI.",
    "id": "visionare-fatture-controllare-debiti-cli",
    "keywords": [
      "fattura",
      "fatture",
      "debito",
      "duplicato"
    ]
  },
  {
    "label": "Controllare utenze / aumento potenza / letture",
    "type": "text",
    "answer": "Per controllare le utenze del cliente:\n1. Apri “Altre Prestazioni” → “Search for Consumer”\n2. Inserisci i dati fiscali del cliente e seleziona l’anagrafica\n3. Clicca sul nome del cliente (in blu)\n4. Vai nella sezione GESTIONE UTENZE\n\nDa qui controlli le utenze attive, fai aumento di potenza, cambio residente/non residente, inserimento lettura gas e controlli i contratti attivi o cessati (anche Wind3 luce e gas).",
    "id": "controllare-utenze-aumento-potenza-lettu",
    "keywords": [
      "utenz",
      "aumento potenza",
      "lettura",
      "residente",
      "contratti attivi"
    ]
  },
  {
    "label": "Voltura interna (guida)",
    "type": "link",
    "url": "https://www.canva.com/design/DAHCIhSLzJs/TJp0nuJxjPUv9by7n8P4mw/view",
    "id": "voltura-interna",
    "keywords": [
      "voltura interna"
    ]
  },
  {
    "label": "Cambio prodotto / switch da PDC (guida)",
    "type": "link",
    "url": "https://sellf.acea.it/cambio-prodotto-gestione-modalita-operativa-acea-energia-point/",
    "id": "cambio-prodotto-switch-da-pdc",
    "keywords": [
      "cambio prodotto",
      "cambio offerta",
      "switch"
    ]
  },
  {
    "label": "Duplicato fattura (guida)",
    "type": "link",
    "url": "https://www.canva.com/design/DAHCJSIbzL4/ecxZnKlbkI1BengT8RX0_g/view",
    "id": "duplicato-fattura",
    "keywords": [
      "duplicato fattura"
    ]
  },
  {
    "label": "Aumento potenza (guida)",
    "type": "link",
    "url": "https://www.canva.com/design/DAHCI7cFuLw/6eFHyRD2EFDGWNqF6ne7hA/view",
    "id": "aumento-potenza",
    "keywords": [
      "aumento potenza"
    ]
  },
  {
    "label": "Autolettura gas (guida)",
    "type": "link",
    "url": "https://www.canva.com/design/DAHCJdRap9E/YTeNbcSeRhED2QCfaPoIIQ/view",
    "id": "autolettura-gas",
    "keywords": [
      "autolettura"
    ]
  },
  {
    "label": "Cambio residenza (guida)",
    "type": "link",
    "url": "https://www.canva.com/design/DAHCJQVvk2o/x2bnSxPTE3Sq6S_u2BzHQA/view",
    "id": "cambio-residenza",
    "keywords": [
      "cambio residenza",
      "residenza"
    ]
  },
  {
    "label": "Cambio metodo di pagamento (guida)",
    "type": "link",
    "url": "https://www.canva.com/design/DAHCJuFcgdU/wkpRUW4VMVGAK2SWWNtigw/view",
    "id": "cambio-metodo-di-pagamento",
    "keywords": [
      "pagamento",
      "rid",
      "bollettino",
      "domiciliazione"
    ]
  }
];

export const PROCEDURE_BY_ID = Object.fromEntries(PROCEDURE.map(p => [p.id, p]));

// Offerte in corso — DA AGGIORNARE quando ACEA cambia spread/scadenze.
export const OFFERTE = [
  { nome: 'ACEA SPRINT (domestico)', tipo: 'Variabile', scadenza: '30/09/2026', durata: '12 mesi',
    luce: 'PUN + spread 0,014 €/kWh', gas: 'PSV + spread 0,075 €/Smc', comm: '10 €/mese' },
  { nome: 'ACEA SPRINT (business)', tipo: 'Variabile', scadenza: '30/09/2026', durata: '12 mesi',
    luce: 'PUN + spread 0,016 €/kWh', gas: 'PSV + spread 0,081 €/Smc', comm: '13 €/mese' },
  { nome: 'ACEA FLEX', tipo: 'Variabile', scadenza: '30/09/2026', durata: '24 mesi',
    luce: 'PUN + spread 0,03 €/kWh', gas: 'PSV + spread 0,148 €/Smc', comm: '9 €/mese' },
  { nome: 'ACEA FIX (domestico)', tipo: 'Fissa', scadenza: '20/07/2026', durata: '12 mesi',
    luce: '0,09 €/kWh', gas: '0,40 €/Smc', comm: '9,25 €/mese' }
];

export function filtraOfferte(q) {
  const t = (q || '').toLowerCase();
  let items = OFFERTE.filter(o => {
    const n = o.nome.toLowerCase();
    return (t.includes('sprint') && n.includes('sprint')) ||
           (t.includes('flex') && n.includes('flex')) ||
           (t.includes('fix') && n.includes('fix'));
  });
  if (!items.length) items = OFFERTE.slice();
  if (t.includes('business')) { const f = items.filter(o => o.nome.toLowerCase().includes('business')); if (f.length) items = f; }
  else if (t.includes('domestic')) { const f = items.filter(o => o.nome.toLowerCase().includes('domestico')); if (f.length) items = f; }
  return items;
}

// Risposte fisse per categorie specifiche (testo pronto deciso da Mario).
export const RISPOSTE_FISSE = {
  avanzamento: "L'avanzamento te lo manda Mario come sempre il LUN-MER-VEN, insieme agli eventuali KO o NON FIRMATI."
};

// Fallback locale (senza AI): trova la procedura dalle keywords.
export function matchProcedura(msg) {
  const t = (msg || '').toLowerCase();
  for (const p of PROCEDURE) {
    if ((p.keywords || []).some(k => t.includes(k))) return p;
  }
  return null;
}
