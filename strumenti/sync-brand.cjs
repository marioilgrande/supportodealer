/* ============================================================================
   SYNC MANUALE DAI PORTALI INFO-UTILI  ->  import-brand.sql
   Di norma NON serve: il portale si allinea da solo (api/sync.js legge i
   portali online). Questo script resta come riserva: legge le cartelle locali
   PLENITUDE INFO, SORGENIA INFO, ALPERIA INFO e genera lo script SQL da
   incollare nel SQL Editor di Neon.

       node strumenti/sync-brand.cjs

   La trasformazione e' la stessa dell'allineamento automatico (lib/brand-sync.js).
   Lo script e' in ASCII puro: i caratteri speciali diventano codici Unicode
   U&'...\20AC...', cosi' il copia-incolla non li corrompe.
   ========================================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm');
const BASE = path.resolve(__dirname, '../..');          // cartella "HTML MARIO"
const USCITA = path.resolve(__dirname, '../import-brand.sql');

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

(async () => {
const { FONTI, FILE_DATI, costruisciBrand, eseguiFileDati } = await import('../lib/brand-sync.js');
const voci = [], contatti = [], offerte = [], tipiPratica = [];
for (const [brand, info] of Object.entries(FONTI)) {
  console.log('\n== ' + info.nome + ' ==');
  const d = {};
  for (const f of FILE_DATI) {
    const p = path.join(BASE, info.dir, f);
    if (!fs.existsSync(p)) continue;
    try { Object.assign(d, eseguiFileDati(vm, fs.readFileSync(p, 'utf8'), p)); }
    catch (e) { console.error('  ! ' + f + ': ' + e.message); }
  }
  const r = costruisciBrand(brand, d, (m) => console.log('  ' + m));
  voci.push(...r.voci); contatti.push(...r.contatti); offerte.push(...r.offerte); tipiPratica.push(...r.tipiPratica);
}

/* ---------- generazione dello script SQL --------------------------------- */
const L = [];
L.push('-- ============================================================================');
L.push('-- IMPORT CONTENUTI PLENITUDE / SORGENIA / ALPERIA');
L.push('-- Generato da strumenti/sync-brand.cjs il ' + new Date().toISOString().slice(0, 10) + ' -- non modificare a mano.');
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
})();
