/* ============================================================================
   SYNC CONTENUTI DAI PORTALI INFO-UTILI  ->  import-brand.sql
   Legge PLENITUDE INFO, SORGENIA INFO, ALPERIA INFO e genera lo script SQL
   da incollare nel SQL Editor di Neon.

       node strumenti/sync-brand.js

   Regole:
   - riscrive SOLO le righe con origine='sync': quello che aggiungi dal
     pannello (origine='manuale') non viene mai toccato;
   - i contatti con riservato:true NON vengono esportati (sono riservati agli
     AM dietro password nei portali di origine; qui il portale e' senza login);
   - lo script e' in ASCII puro: i caratteri speciali diventano codici Unicode
     U&'...\20AC...', cosi' il copia-incolla non li corrompe.
   ========================================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm');
const BASE = path.resolve(__dirname, '../..');          // cartella "HTML MARIO"
const USCITA = path.resolve(__dirname, '../import-brand.sql');

const BRANDS = {
  plenitude: { dir: 'PLENITUDE INFO', nome: 'Plenitude' },
  sorgenia:  { dir: 'SORGENIA INFO',  nome: 'Sorgenia'  },
  alperia:   { dir: 'ALPERIA INFO',   nome: 'Alperia'   }
};

/* ---------- lettura dei file dati (moduli CommonJS o const globali) -------- */
function carica(dir, file) {
  const p = path.join(BASE, dir, file);
  if (!fs.existsSync(p)) return {};
  try { const m = require(p); if (m && Object.keys(m).length) return m; } catch (e) {}
  const ctx = {}; vm.createContext(ctx);
  let src = fs.readFileSync(p, 'utf8')
    .replace(/^(const|let|var)\s+([A-Z_][A-Za-z0-9_]*)\s*=/gm, 'globalThis.$2 =');
  try { vm.runInContext(src, ctx, { filename: p }); } catch (e) { console.error('  ! ' + file + ': ' + e.message); }
  return ctx;
}
function datiBrand(dir) {
  const out = {};
  for (const f of ['procedure.js', 'contenuti.js', 'offerte.js', 'moduli.js']) Object.assign(out, carica(dir, f));
  return out;
}

/* ---------- letterali SQL in ASCII puro ---------------------------------- */
function lit(s) {
  s = String(s == null ? '' : s);
  if (/^[\x20-\x7E\n\t]*$/.test(s)) return "'" + s.replace(/'/g, "''") + "'";
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === '\\') out += '\\\\';
    else if (ch === "'") out += "''";
    else if (c >= 0x20 && c <= 0x7e) out += ch;
    else if (c <= 0xffff) out += '\\' + c.toString(16).padStart(4, '0');
    else out += '\\+' + c.toString(16).padStart(6, '0');
  }
  return "U&'" + out + "'";
}
const jsonb = (v) => lit(JSON.stringify(v)) + '::jsonb';

/* ---------- parole chiave: servono all'assistente per agganciare ---------- */
const STOP = new Set(('il lo la i gli le un uno una di a da in con su per tra fra e o che non del della dei delle al alla ai alle dal dalla nel nella sul sulla come cosa quando dove quale quali se si ti ci vi mi ne il tuo tua suo sua come quello questa questo sono essere fare puo puoi deve devi va vai ' +
  'plenitude sorgenia alperia').split(/\s+/));
function parole(...testi) {
  const vis = new Set();
  for (const t of testi) {
    for (const w of String(t || '').toLowerCase().replace(/<[^>]*>/g, ' ').replace(/[^a-zà-ù0-9]+/g, ' ').split(/\s+/)) {
      if (w.length >= 4 && !STOP.has(w)) vis.add(w);
    }
  }
  return [...vis].slice(0, 14).join(', ');
}

/* ---------- raccolta delle voci ------------------------------------------ */
const voci = [], contatti = [], offerte = [], tipiPratica = [];
let ord = 0;

function voce(brand, id, titolo, blocchi, extra = {}) {
  if (!blocchi || !blocchi.length) return;
  voci.push({
    id: brand + ':' + id, brand, titolo,
    sottotitolo: extra.sottotitolo || '', etichetta: extra.etichetta || '',
    keywords: extra.keywords || parole(titolo, extra.sottotitolo, extra.etichetta),
    blocchi, sort_order: ord++
  });
}
const bloccoTesto  = (titolo, testo) => ({ tipo: 'info', titolo, testo });
const bloccoLista  = (titolo, voci_) => ({ tipo: 'lista', titolo, voci: voci_ });
const bloccoTab    = (titolo, colonne, righe) => ({ tipo: 'tabella', titolo, colonne, righe });

for (const [brand, info] of Object.entries(BRANDS)) {
  const d = datiBrand(info.dir);
  console.log('\n== ' + info.nome + ' ==');

  /* procedure e guide: hanno gia' il formato a blocchi */
  for (const p of [].concat(d.PROCEDURE || [], d.GUIDE || [])) {
    voce(brand, p.id || p.titolo.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30), p.titolo, p.blocchi, {
      sottotitolo: p.sottotitolo, etichetta: p.etichetta,
      keywords: parole(p.titolo, p.sottotitolo, p.etichetta, (p.blocchi || []).map(b => b.titolo).join(' '))
    });
  }
  console.log('  procedure/guide: ' + (((d.PROCEDURE || []).length) + ((d.GUIDE || []).length)));

  /* schede operative Alperia: voltura, subentro, attivazione, allaccio... */
  let nSchede = 0;
  for (const [k, m] of Object.entries(d.MODULI_INFO || {})) {
    const bl = [bloccoTesto(m.titolo, m.testo)];
    if (m.dettaglio) bl.push(bloccoLista('Nel dettaglio', [].concat(m.dettaglio)));
    voce(brand, 'scheda-' + k, m.titolo, bl, { etichetta: 'Operazioni' });
    nSchede++;
  }
  if (nSchede) console.log('  schede operative: ' + nSchede);

  /* script della check call (Alperia) */
  if (d.SCRIPT_IQC && d.SCRIPT_IQC.titolo) {
    const s = d.SCRIPT_IQC, bl = [];
    if (s.intro) bl.push(bloccoTesto('In sintesi', s.intro));
    if (s.numeri) bl.push(bloccoLista('Numeri da cui chiama', [].concat(s.numeri)));
    if (s.prima) bl.push(bloccoLista('Prima della chiamata', [].concat(s.prima)));
    if (s.domande) bl.push(bloccoLista('Cosa chiedono al cliente', [].concat(s.domande)));
    if (s.attenzione) bl.push({ tipo: 'nota', testo: [].concat(s.attenzione).join(' ') });
    voce(brand, 'script-checkcall', s.titolo, bl, { etichetta: 'Check call' });
    console.log('  script check call: 1');
  }

  /* "come leggere": una voce unica per brand, sono spiegazioni brevi */
  if ((d.COME_LEGGERE || []).length) {
    voce(brand, 'come-leggere', 'Come leggere le offerte ' + info.nome,
      (d.COME_LEGGERE).map(x => bloccoTesto(x.titolo, x.testo || (x.voci || []).join(' · '))),
      { etichetta: 'Offerte', keywords: parole('come leggere offerta prezzo spread commercializzazione sconto', (d.COME_LEGGERE).map(x => x.titolo).join(' ')) });
    console.log('  come leggere: ' + d.COME_LEGGERE.length + ' voci -> 1 scheda');
  }

  /* portali e strumenti del brand */
  if ((d.STRUMENTI || []).length) {
    voce(brand, 'portali', 'Portali e strumenti ' + info.nome,
      (d.STRUMENTI).map(s => ({ tipo: 'link', titolo: s.titolo, testo: s.testo || '', href: s.link || s.url || s.href || ((s.links || [])[0] || {}).href || '' })),
      { etichetta: 'Accessi', keywords: parole('portale accesso link strumenti comparatore inserimento', (d.STRUMENTI).map(s => s.titolo).join(' ')) });
    console.log('  portali/strumenti: ' + d.STRUMENTI.length);
  }

  /* modulistica scaricabile (Alperia) */
  if ((d.MODULI || []).length) {
    const perCat = {};
    for (const m of d.MODULI) (perCat[m.cat || 'moduli'] = perCat[m.cat || 'moduli'] || []).push(m);
    const bl = Object.entries(perCat).map(([cat, lista]) =>
      bloccoTab(cat.charAt(0).toUpperCase() + cat.slice(1), ['Modulo', 'Per', 'Formato'],
        lista.map(m => [m.titolo, [m.c, m.cliente].filter(Boolean).join(' · ') || 'tutti', m.formato || ''])));
    voce(brand, 'modulistica', 'Modulistica ' + info.nome, bl,
      { etichetta: 'Moduli', keywords: parole('modulo moduli modulistica allegato allegati stampare firmare documento') });
    console.log('  modulistica: ' + d.MODULI.length + ' file');
  }

  /* contatti pubblici (i riservati agli AM restano fuori) */
  let nc = 0;
  for (const c of (d.RUBRICA || [])) {
    if (c.riservato) continue;
    contatti.push({ id: brand + ':' + c.id, brand, area: c.area || '', ufficio: c.ufficio || '',
      richieste: c.richieste || '', tel: c.tel || '', email: c.email || '',
      orari: c.orari || '', link: c.link || '', nota: c.nota || '', sort_order: nc });
    nc++;
  }
  if ((d.RUBRICA || []).length) console.log('  contatti: ' + nc + ' pubblici (' + ((d.RUBRICA).length - nc) + ' riservati esclusi)');

  /* tipi di pratica ammessi: ogni brand dichiara le operazioni in un posto diverso.
     Servono a non proporre al dealer cose che il suo brand non puo' lavorare. */
  const tp = [];
  if (brand === 'plenitude') {
    // tabella "Operazioni ammesse": tengo solo le righe con almeno un si'
    for (const p of (d.PROCEDURE || [])) for (const b of (p.blocchi || [])) {
      if (b.tipo !== 'tabella' || !/operazion/i.test(b.titolo || '')) continue;
      for (const r of (b.righe || [])) {
        const okL = /\u2705/.test(r[1] || ''), okG = /\u2705/.test(r[2] || '');
        if (!okL && !okG) continue;
        tp.push({ nome: String(r[0] || '').replace(/\s*\(.*?\)\s*$/, '').trim(),
                  nota: (okL && okG) ? '' : (okL ? 'solo luce' : 'solo gas') });
      }
    }
  } else if (brand === 'sorgenia') {
    // colonne della tabella del credit check residenziale
    for (const p of (d.PROCEDURE || [])) for (const b of (p.blocchi || [])) {
      if (b.tipo !== 'tabella' || !/credit check/i.test(b.titolo || '')) continue;
      for (const c of (b.colonne || []).slice(1)) tp.push({ nome: String(c).trim(), nota: '' });
    }
  } else if (brand === 'alperia') {
    // usi dichiarati dalle offerte + la voltura dalle schede operative
    const set = new Set();
    for (const o of (d.OFFERTE || [])) for (const u of (((o.usi || {}).si) || [])) set.add(String(u).trim());
    if ((d.MODULI_INFO || {}).voltura) set.add('Voltura');
    for (const n of set) tp.push({ nome: n, nota: '' });
  }
  let nt = 0;
  for (const t of tp) {
    if (!t.nome) continue;
    tipiPratica.push({ id: brand + ':tp-' + t.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
                       brand, nome: t.nome, nota: t.nota, sort_order: nt++ });
  }
  console.log('  tipi di pratica: ' + nt + ' -> ' + tp.map(x => x.nome).join(', '));

  /* offerte: ogni brand ha campi diversi -> adattatore dedicato */
  const ad = {
    plenitude: (o) => ({ nome: [o.fam, o.variante].filter(Boolean).join(' '), tipo: o.tipo || '', scadenza: o.al || '',
      durata: o.durataPrezzo || '', prezzo: o.prezzo || '', comm: o.quotaAnno || '' }),
    sorgenia:  (o) => ({ nome: [o.fam, o.variante].filter(Boolean).join(' '), tipo: o.tipo || '', scadenza: o.al || '',
      durata: '', prezzo: o.prezzoNetto || o.fee1 || '', comm: o.quotaMese || o.quotaAnno || '' }),
    alperia:   (o) => ({ nome: o.nome || '', tipo: o.tipo || '', scadenza: o.scadenza || '',
      durata: '', prezzo: o.prezzo || '', comm: o.commMese || o.comm || '' })
  }[brand];
  let no = 0;
  for (const o of (d.OFFERTE || [])) {
    const x = ad(o); if (!x.nome) continue;
    const luce = /luce|ee|elettric/i.test(o.c || '') ? x.prezzo : '';
    const gas  = /gas/i.test(o.c || '') ? x.prezzo : '';
    offerte.push({ brand, nome: x.nome, tipo: x.tipo, scadenza: x.scadenza, durata: x.durata,
      luce: luce || (o.c ? '' : x.prezzo), gas, comm: x.comm,
      segmento: /bus|pmi|piva/i.test(o.seg || '') ? 'business' : 'domestico', sort_order: no++ });
  }
  console.log('  offerte: ' + no);
}

/* ---------- generazione dello script SQL --------------------------------- */
const L = [];
L.push('-- ============================================================================');
L.push('-- IMPORT CONTENUTI PLENITUDE / SORGENIA / ALPERIA');
L.push('-- Generato da strumenti/sync-brand.js il ' + new Date().toISOString().slice(0, 10) + ' -- non modificare a mano.');
L.push('-- Esegui DOPO migrazione-multibrand.sql, nel SQL Editor di Neon.');
L.push('-- Rimuove i contenuti ACEA e tutto cio che era gia stato importato (origine=sync).');
L.push('-- Le voci aggiunte a mano dal pannello (origine=manuale) NON vengono toccate.');
L.push('-- ============================================================================');
L.push('BEGIN;');
L.push('');
L.push('-- 1) via i contenuti ACEA e il vecchio import');
L.push("DELETE FROM procedura WHERE origine = 'sync' OR brand = '';");
L.push("DELETE FROM offerta   WHERE origine = 'sync' OR brand = '';");
L.push("DELETE FROM contatto  WHERE origine = 'sync';");
L.push('');
L.push('-- 2) procedure e risposte (' + voci.length + ')');
for (const v of voci) {
  L.push('INSERT INTO procedura (id, brand, titolo, sottotitolo, etichetta, keywords, tipo, risposta, url, blocchi, origine, attiva, sort_order) VALUES (');
  L.push('  ' + lit(v.id) + ', ' + lit(v.brand) + ', ' + lit(v.titolo) + ', ' + lit(v.sottotitolo) + ', ' + lit(v.etichetta) + ',');
  L.push('  ' + lit(v.keywords) + ", 'blocchi', '', '', " + jsonb(v.blocchi) + ", 'sync', TRUE, " + v.sort_order + ');');
}
L.push('');
L.push('-- 3) contatti pubblici per brand (' + contatti.length + ')');
for (const c of contatti) {
  L.push('INSERT INTO contatto (id, brand, area, ufficio, richieste, tel, email, orari, link, nota, origine, attivo, sort_order) VALUES (');
  L.push('  ' + lit(c.id) + ', ' + lit(c.brand) + ', ' + lit(c.area) + ', ' + lit(c.ufficio) + ', ' + lit(c.richieste) + ',');
  L.push('  ' + lit(c.tel) + ', ' + lit(c.email) + ', ' + lit(c.orari) + ', ' + lit(c.link) + ', ' + lit(c.nota) + ", 'sync', TRUE, " + c.sort_order + ');');
}
L.push('');
L.push('-- 4) offerte per brand (' + offerte.length + ')');
for (const o of offerte) {
  L.push('INSERT INTO offerta (brand, nome, tipo, scadenza, durata, luce, gas, comm, segmento, origine, attiva, sort_order) VALUES (');
  L.push('  ' + lit(o.brand) + ', ' + lit(o.nome) + ', ' + lit(o.tipo) + ', ' + lit(o.scadenza) + ', ' + lit(o.durata) + ',');
  L.push('  ' + lit(o.luce) + ', ' + lit(o.gas) + ', ' + lit(o.comm) + ', ' + lit(o.segmento) + ", 'sync', TRUE, " + o.sort_order + ');');
}
L.push('');
L.push('-- 5) tipi di pratica ammessi per brand (' + tipiPratica.length + ')');
L.push("DELETE FROM tipo_pratica WHERE origine = 'sync';");
for (const t of tipiPratica) {
  L.push('INSERT INTO tipo_pratica (id, brand, nome, nota, origine, attivo, sort_order) VALUES (');
  L.push('  ' + lit(t.id) + ', ' + lit(t.brand) + ', ' + lit(t.nome) + ', ' + lit(t.nota) + ", 'sync', TRUE, " + t.sort_order + ');');
}
L.push('');
L.push('COMMIT;');

fs.writeFileSync(USCITA, L.join('\n') + '\n', 'utf8');
const nonAscii = L.join('\n').match(/[^\x00-\x7F]/g);
console.log('\n=============================================');
console.log('voci: ' + voci.length + ' | contatti: ' + contatti.length + ' | offerte: ' + offerte.length + ' | tipi pratica: ' + tipiPratica.length);
console.log('scritto ' + path.basename(USCITA) + ' (' + (fs.statSync(USCITA).size / 1024).toFixed(0) + ' KB)');
console.log('caratteri non-ASCII nello script: ' + (nonAscii ? nonAscii.length + ' (ATTENZIONE)' : '0 (ok)'));
