// Negozi -> [SIS-SUB, Agenzia].
// FONTE PRIMARIA = database del Pannello Segnalazioni (tabella `negozi`), così i
// negozi si gestiscono da lì (con l'import Excel) e valgono subito anche qui: nessun deploy.
// Serve la env SEGNALAZIONI_DATABASE_URL. L'elenco statico è solo un fallback.
import { neon } from '@neondatabase/serverless';

const segnalazioniSql = process.env.SEGNALAZIONI_DATABASE_URL
  ? neon(process.env.SEGNALAZIONI_DATABASE_URL)
  : null;

const FALLBACK_NEGOZI = {
  "CARAMORI SRL": ["SIS005SUB438", "SIS005_520"],
"LO TURCO": ["SIS005SUB186", "SIS005_209"],
  "SONIA CAPITANIO": ["SIS005SUB", "SIS005_"],
  "DIMENSIONE ELETTRONICA": ["SIS005SUB192", "SIS005_215"],
  "CEM DI MASELLA": ["SIS005SUB182", "SIS005_205"],
  "ANDREA D'ERRICO RIVOLI": ["SIS005SUB191", "SIS005_214"],
  "ANDREA D'ERRICO": ["SIS005SUB190", "SIS005_213"],
  "GIERRE SRL VERBANIA": ["SIS005SUB53", "SIS005_053"],
  "GIERRE SRL BORGOSESIA": ["SIS005SUB53", "SIS005_139"],
  "ANTONINO LO PRESTI": ["SIS005SUB166", "SIS005_189"],
  "SANTORO - JENIO BESOZZO": ["SIS005SUB92", "SIS005_100"],
  "PASQUALE RIZZO": ["SIS005SUB43", "SIS005_043"],
  "PAOLO BONASSI": ["SIS005SUB102", "SIS005_110"],
  "CRISTIAN BIAVA": ["SIS005SUB128", "SIS005_146"],
  "CELLULARMAGIA SRL": ["SIS005SUB199", "SIS005_222"],
  "CALLULARSTORE DI UMBACA": ["SIS005SUB176", "SIS005_199"],
  "AF TECHNOLOGY": ["SIS005SUB212", "SIS005_236"],
  "OASI DI COMINO": ["SIS005SUB185", "SIS005_208"],
  "L'IDEA SNC": ["SIS005SUB196", "SIS005_219"],
  "TMS DI CUSUMANO TOMMASO": ["SIS005SUB184", "SIS005_207"],
  "PALE BLUE": ["SIS005SUB203", "SIS005_227"],
  "CENTROSERVIZIPUNTO7": ["SIS005SUB213", "SIS005_237"],
  "LAMPON SRL": ["SIS005SUB195", "SIS005_218"],
  "OBERDAN SRL": ["SIS005SUB197", "SIS005_220"],
  "ROXHOTEL SRL": ["SIS005SUB216", "SIS005_245"],
  "LM DI LUCA MANCUSO": ["SIS005SUB210", "SIS005_234"],
  "HD INFORMATICA": ["SIS005SUB174", "SIS005_197"],
  "FSC SERVICE": ["SIS005SUB201", "SIS005_225"],
  "DIFF SRL": ["SIS005SUB173", "SIS005_196"],
  "SMARTECH DI LUCREZIA GRAZIANO": ["SIS005SUB231", "SIS005_267"],
  "ELECTRONIC SRL": ["SIS005SUB233", "SIS005_270"],
  "DIGITAL CENTER DI GODIO": ["SIS005SUB232", "SIS005_268"],
  "SODIRI SRL": ["SIS005SUB238", "SIS005_276"],
  "LC TRADE SRL": ["SIS005SUB126", "SIS005_138"],
  "CENTRO MULTISERVIZI/PRINK": ["SIS005SUB205", "SIS005_229"],
  "ETA BETA ELETTRONICA": ["SIS005SUB206", "SIS005_230"],
  "PEGASO CONSULTING": ["SIS005SUB188", "SIS005_211"],
  "ADA DI ANZALONE MARIA": ["SIS005SUB125", "SIS005_137"],
  "HELLO! TELEFONIA": ["SIS005SUB124", "SIS005_136"],
  "TECH LINE DI SANDRO LABAGNARA": ["SIS005SUB234", "SIS005_271"],
  "CONNACTIVE DI SARACCO": ["SIS005SUB271", "SIS005_318"],
  "MARCELLA LOMBARDI": ["SIS005SUB262", "SIS005_309"],
  "MERCATINO DEL CELLULARE - G&G": ["SIS005SUB237", "SIS005_275"],
  "DVD PROJECT": ["SIS005SUB283", "SIS005_331"],
  "TELERITZ SOLUTION": ["SIS005SUB281", "SIS005_331"],
  "SPA COMPUTER": ["SIS005SUB305", "SIS005_358"],
  "PUNTO4 - GIORGIA PETROLI": ["SIS005SUB312", "SIS005_365"],
  "SERVICE POINT SRL": ["SIS005SUB315", "SIS005_370"],
  "WSR SERVIZI - WILLIAM": ["SIS005SUB313", "SIS005_366"],
  "PTS DI POMARICO DANIELE": ["SIS005SUB317", "SIS005_372"],
  "LUIGI TANCREDI": ["SIS005SUB316", "SIS005_371"],
  "SASSANO SRL": ["SIS005SUB325", "SIS005_"],
  "SYS POINT": ["SIS005SUB339", "SIS005_394"],
  "APP TELEFONIA": ["SIS005SUB333", "SIS005_388"],
  "POSEIDON SAS": ["SIS005SUB336", "SIS005_391"],
  "TECNI 360 INFORMATICA": ["SIS005SUB335", "SIS005_390"],
  "MARIO ISERNIA": ["SIS005", "SIS005_249"],
  "SMART ON SOLUTION": ["SIS005SUB346", "SIS005_401"],
  "DAMA SNC DI SANDRI DAVIDE E VALASSINA MATTIA": ["SIS005SUB350", "SIS005_406"],
  "MATTEO RUFFO": ["SIS005SUB334", "SIS005_389"],
  "SUPERPHONIA DI GIOANNINI PAOLO": ["SIS005SUB355", "SIS005_411"],
  "ORBASSANO ON LINE": ["SIS005SUB376", "SIS005_442"],
  "SIGMATEL DI LUCCISANO ALESSIO": ["SIS005SUB375", "SIS005_441"],
  "DE VITA SRL": ["SIS005SUB363", "SIS005_420"],
  "DIGITEL STORE": ["SIS005SUB377", "SIS005_443"],
  "MYA SRLS": ["SIS005SUB358", "SIS005_415"],
  "NEW TIMMEL": ["SIS005SUB387", "SIS005_455"],
  "MEDIACREATION": ["SIS005SUB383", "SIS005_449"],
  "TEL&FONY": ["SIS005SUB388", "SIS005_456"],
  "NEXTO ENERGIA": ["SIS005SUB406", "SIS005_475"],
  "DIGITAL POINT DI MAZZIA STEFANIA": ["SIS005SUB390", "SIS005_458"],
  "GSP DI GASTALDI ANDREA": ["SIS005SUB359", "SIS005_416"],
  "DM SERVICE SRL": ["SIS005SUB395", "SIS005_463"],
  "SMART VARAZZE": ["SIS005SUB403", "SIS005_472"],
  "DISTREL": ["SIS005SUB", "SIS005_"],
  "TOTOX": ["SIS005SUB404", "SIS005_473"],
  "ELETTRONICA GALLI": ["SIS005SUB", "SIS005_"],
  "N.PAZ SRL": ["SIS005SUB", "SIS005_"],
  "TOP TEAM SRL": ["SIS005SUB", "SIS005_"],
  "CLERICO MATTEO": ["SIS005SUB410", "SIS005_479"],
  "GIL RODRIGUEZ": ["", ""],
  "FE.MA": ["SIS005SUB66", "SIS005_066"],
  "EURO TEAM DI MECCOLA": ["", ""],
  "NOVATEL": ["", ""],
  "D&W DOSIO": ["", ""],
  "GILL&MON": ["", ""],
  "MT TECHNOLOGY": ["", ""],
  "INFO LOGIC": ["", ""],
  "CVD BALDACCI": ["", ""],
  "ANDREA CIAIOLO": ["", ""]
};

const TTL = 60 * 1000;
let cache = null, cacheAt = 0;

async function getNegozi() {
  if (cache && Date.now() - cacheAt < TTL) return cache;
  if (segnalazioniSql) {
    try {
      const rows = await segnalazioniSql`SELECT negozio, sis, agenzia FROM negozi`;
      const map = {};
      for (const r of rows) {
        if (r.negozio && String(r.negozio).trim()) map[String(r.negozio).trim()] = [r.sis || '', r.agenzia || ''];
      }
      if (Object.keys(map).length) { cache = map; cacheAt = Date.now(); return cache; }
    } catch (e) {
      console.error('Negozi DB (Segnalazioni) error:', e.message);
    }
  }
  cache = FALLBACK_NEGOZI; cacheAt = Date.now();
  return cache;
}

function normalizeName(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Quanto un nome scritto dal dealer somiglia a un nome dell'elenco.
function punteggio(q, key) {
  const nk = normalizeName(key);
  const kTokens = nk.split(' ');
  const qTokens = q.split(' ').filter(t => t.length >= 3);
  let score = 0;
  if (nk.startsWith(q) || q.startsWith(nk)) score += 5;
  else if (nk.includes(q)) score += 4;
  for (const qt of qTokens) {
    if (kTokens.some(kt => kt === qt || kt.startsWith(qt) || qt.startsWith(kt))) score += 2;
  }
  if (qTokens.length && kTokens[0] && (kTokens[0] === qTokens[0] || kTokens[0].startsWith(qTokens[0]))) score += 2;
  return score;
}

const MAX_CANDIDATI = 6;

// Cerca il negozio dal nome scritto dal dealer (anche abbreviato).
// Ritorna: { stato: 'trovato' | 'ambiguo' | 'non_trovato', nome, sisSub, agenzia, candidati }
// - 'trovato'  -> un solo negozio plausibile
// - 'ambiguo'  -> piu' negozi somigliano (es. "andrea"): va chiesto quale
export async function cercaNegozio(input) {
  const negozi = await getNegozi();
  const keys = Object.keys(negozi);
  const q = normalizeName(input);
  const vuoto = { stato: 'non_trovato', nome: input || '', sisSub: '', agenzia: '', candidati: [] };
  if (!q) return vuoto;

  const dati = (k) => ({ stato: 'trovato', nome: k, sisSub: negozi[k][0] || '', agenzia: negozi[k][1] || '', candidati: [] });

  // Nome esatto: nessun dubbio
  for (const k of keys) if (normalizeName(k) === q) return dati(k);

  const scored = keys
    .map(k => ({ k, s: punteggio(q, k) }))
    .filter(x => x.s >= 4)
    .sort((a, b) => b.s - a.s || a.k.localeCompare(b.k));
  if (!scored.length) return vuoto;

  // Teniamo i migliori (a pari punteggio o quasi): se sono piu' di uno, chiediamo conferma
  const max = scored[0].s;
  const top = scored.filter(x => x.s >= max - 1).slice(0, MAX_CANDIDATI);
  if (top.length === 1) return dati(top[0].k);
  return { stato: 'ambiguo', nome: input || '', sisSub: '', agenzia: '', candidati: top.map(x => x.k) };
}

// Compatibilita': come prima, ma senza gestire l'ambiguita' (sceglie il migliore).
export async function codiciNegozio(input) {
  const r = await cercaNegozio(input);
  if (r.stato === 'trovato') return { trovato: true, nome: r.nome, sisSub: r.sisSub, agenzia: r.agenzia };
  if (r.stato === 'ambiguo') return { trovato: false, nome: input || '', sisSub: '', agenzia: '' };
  return { trovato: false, nome: input || '', sisSub: '', agenzia: '' };
}
