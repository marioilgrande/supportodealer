/* ============================================================================
   CONTENUTI DAI PORTALI INFO-UTILI  ->  righe del database
   Trasforma i file dati di un portale info-utili (procedure.js, contenuti.js,
   offerte.js, moduli.js, prestazioni.js) in voci, contatti, offerte e tipi di
   pratica del Supporto Dealer. Lo usano:
     - api/sync.js            -> allineamento automatico, legge i portali online
     - strumenti/sync-brand.cjs -> allineamento manuale, genera import-brand.sql
   Regole:
   - i contatti con riservato:true NON vengono esportati (sono riservati agli
     AM dietro password nei portali di origine; qui il portale e' senza login);
   - i file del portale di origine (video, copertine, moduli in assets/) passano
     da api/media, perche' due portali su tre sono protetti da password.
   ========================================================================== */

// Cambiare questo numero forza un riallineamento anche se i portali non sono
// cambiati (serve quando si modifica la trasformazione qui sotto).
export const VERSIONE_REGOLE = 3;

export const FONTI = {
  plenitude: { nome: 'Plenitude', url: 'https://infoutiliplenitude.vercel.app/', dir: 'PLENITUDE INFO' },
  sorgenia:  { nome: 'Sorgenia',  url: 'https://infoutilisorgenia.vercel.app/',  dir: 'SORGENIA INFO'  },
  alperia:   { nome: 'Alperia',   url: 'https://infoutilialperia.vercel.app/',   dir: 'ALPERIA INFO'   }
};
export const FILE_DATI = ['procedure.js', 'contenuti.js', 'offerte.js', 'moduli.js', 'prestazioni.js'];

/* Materiali formativi allegati al portale (file in assets/corsi/).
   Non vivono nei portali info-utili: li teniamo qui, dichiarati a mano. */
const ALLEGATI = {
  plenitude: [{
    id: 'formazione-corsi',
    titolo: 'Corsi obbligatori di formazione (APPRENDI)',
    sottotitolo: 'I materiali dei corsi obbligatori Eni Plenitude, con le risposte dei quiz.',
    etichetta: 'Formazione',
    keywords: 'formazione, corso, corsi, apprendi, quiz, test, compliance, codice di condotta, quadro normativo, attestato, obbligatoria',
    blocchi: [
      { tipo: 'info', testo: 'Raccolta dei materiali dei <strong>corsi obbligatori</strong> della piattaforma APPRENDI, organizzati per corso con le schermate dei quiz.' },
      { tipo: 'lista', titolo: 'Corsi inclusi', voci: [
        'Privacy e protezione dei dati &mdash; 14 risposte',
        'Quadro normativo per operatori e partner commerciali &mdash; 18 risposte',
        'Codice di condotta &mdash; 4 risposte',
        'Sicurezza e protezione dei dati &mdash; 6 risposte',
        'Fibra ottica &mdash; 10 risposte'
      ]},
      { tipo: 'file', titolo: 'Scarica la raccolta dei corsi', testo: 'PDF, 27 pagine', href: 'assets/corsi/corsi-formazione-plenitude.pdf' }
    ]
  }],
  sorgenia: [{
    id: 'formazione-privacy',
    titolo: 'Formazione Sorgenia: accesso e test',
    sottotitolo: 'Come entrare nella Sorgenia Suite, seguire il percorso e completare i test.',
    etichetta: 'Formazione',
    keywords: 'formazione, corso, corsi, apprendi, appprendi, suite, quiz, test, compliance, store compliance, privacy, attestato, obbligatoria',
    blocchi: [
      { tipo: 'info', testo: 'Guida operativa E2K alla <strong>formazione obbligatoria Sorgenia</strong>: primo accesso alla Suite, percorso APPprendi e risposte ai test.' },
      { tipo: 'passi', titolo: 'In breve', voci: [
        'Ricevi la mail di iscrizione e usa il link per accedere alla Sorgenia Suite.',
        'Al primo accesso imposta la password dal pulsante ricevuto via mail.',
        'Dalla home apri <strong>APPprendi</strong> &rarr; Formazione &rarr; Catalogo lezioni.',
        'Apri la card <strong>Store Compliance</strong> e completa il percorso.'
      ]},
      { tipo: 'file', titolo: 'Scarica il manuale della formazione', testo: 'PDF, 21 pagine', href: 'assets/corsi/formazione-privacy-sorgenia.pdf' }
    ]
  }],
  alperia: []
};

/* I file "assets/..." del portale di origine si leggono tramite api/media. */
export function mediaUrl(brand, percorso) {
  const p = String(percorso || '').replace(/^\.?\//, '');
  if (!/^assets\//.test(p)) return percorso;
  return 'api/media?b=' + brand + '&f=' + encodeURIComponent(p);
}
function rimappaMedia(brand, blocchi) {
  return (blocchi || []).map(b => {
    const x = Object.assign({}, b);
    for (const k of ['href', 'url', 'copertina']) if (typeof x[k] === 'string') x[k] = mediaUrl(brand, x[k]);
    return x;
  });
}

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

const bloccoTesto = (titolo, testo) => ({ tipo: 'info', titolo, testo });
const bloccoLista = (titolo, voci_) => ({ tipo: 'lista', titolo, voci: voci_ });
const bloccoTab   = (titolo, colonne, righe) => ({ tipo: 'tabella', titolo, colonne, righe });

/* d = oggetto con le costanti lette dai file del portale (PROCEDURE, OFFERTE...).
   Ritorna le righe da scrivere per QUEL brand. */
export function costruisciBrand(brand, d, log = () => {}) {
  const info = FONTI[brand];
  const voci = [], contatti = [], offerte = [], tipiPratica = [];
  let ord = 0;

  function voce(id, titolo, blocchi, extra = {}, locale = false) {
    if (!blocchi || !blocchi.length) return;
    voci.push({
      id: brand + ':' + id, brand, titolo,
      sottotitolo: extra.sottotitolo || '', etichetta: extra.etichetta || '',
      keywords: extra.keywords || parole(titolo, extra.sottotitolo, extra.etichetta),
      blocchi: locale ? blocchi : rimappaMedia(brand, blocchi), sort_order: ord++
    });
  }

  /* procedure e guide: hanno gia' il formato a blocchi */
  for (const p of [].concat(d.PROCEDURE || [], d.GUIDE || [])) {
    voce(p.id || p.titolo.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30), p.titolo, p.blocchi, {
      sottotitolo: p.sottotitolo, etichetta: p.etichetta,
      keywords: parole(p.titolo, p.sottotitolo, p.etichetta, (p.blocchi || []).map(b => b.titolo).join(' '))
    });
  }
  log('procedure/guide: ' + (((d.PROCEDURE || []).length) + ((d.GUIDE || []).length)));

  /* schede operative Alperia: voltura, subentro, attivazione, allaccio... */
  let nSchede = 0;
  for (const [k, m] of Object.entries(d.MODULI_INFO || {})) {
    const bl = [bloccoTesto(m.titolo, m.testo)];
    if (m.dettaglio) bl.push(bloccoLista('Nel dettaglio', [].concat(m.dettaglio)));
    voce('scheda-' + k, m.titolo, bl, { etichetta: 'Operazioni' });
    nSchede++;
  }
  if (nSchede) log('schede operative: ' + nSchede);

  /* script della check call (Alperia) */
  if (d.SCRIPT_IQC && d.SCRIPT_IQC.titolo) {
    const s = d.SCRIPT_IQC, bl = [];
    if (s.intro) bl.push(bloccoTesto('In sintesi', s.intro));
    if (s.numeri) bl.push(bloccoLista('Numeri da cui chiama', [].concat(s.numeri)));
    if (s.prima) bl.push(bloccoLista('Prima della chiamata', [].concat(s.prima)));
    if (s.domande) bl.push(bloccoLista('Cosa chiedono al cliente', [].concat(s.domande)));
    if (s.attenzione) bl.push({ tipo: 'nota', testo: [].concat(s.attenzione).join(' ') });
    voce('script-checkcall', s.titolo, bl, { etichetta: 'Check call' });
    log('script check call: 1');
  }

  /* "come leggere": una voce unica per brand, sono spiegazioni brevi */
  if ((d.COME_LEGGERE || []).length) {
    voce('come-leggere', 'Come leggere le offerte ' + info.nome,
      (d.COME_LEGGERE).map(x => bloccoTesto(x.titolo, x.testo || (x.voci || []).join(' · '))),
      { etichetta: 'Offerte', keywords: parole('come leggere offerta prezzo spread commercializzazione sconto', (d.COME_LEGGERE).map(x => x.titolo).join(' ')) });
    log('come leggere: ' + d.COME_LEGGERE.length + ' voci -> 1 scheda');
  }

  /* portali e strumenti del brand */
  if ((d.STRUMENTI || []).length) {
    voce('portali', 'Portali e strumenti ' + info.nome,
      (d.STRUMENTI).map(s => ({ tipo: 'link', titolo: s.titolo, testo: s.testo || '', href: s.link || s.url || s.href || ((s.links || [])[0] || {}).href || '' })),
      { etichetta: 'Accessi', keywords: parole('portale accesso link strumenti comparatore inserimento', (d.STRUMENTI).map(s => s.titolo).join(' ')) });
    log('portali/strumenti: ' + d.STRUMENTI.length);
  }

  /* modulistica scaricabile (Alperia) */
  if ((d.MODULI || []).length) {
    const perCat = {};
    for (const m of d.MODULI) (perCat[m.cat || 'moduli'] = perCat[m.cat || 'moduli'] || []).push(m);
    const bl = Object.entries(perCat).map(([cat, lista]) =>
      bloccoTab(cat.charAt(0).toUpperCase() + cat.slice(1), ['Modulo', 'Per', 'Formato'],
        lista.map(m => [m.titolo, [m.c, m.cliente].filter(Boolean).join(' · ') || 'tutti', m.formato || ''])));
    voce('modulistica', 'Modulistica ' + info.nome, bl,
      { etichetta: 'Moduli', keywords: parole('modulo moduli modulistica allegato allegati stampare firmare documento') });
    log('modulistica: ' + d.MODULI.length + ' file');
  }

  /* video di formazione: inserimento contratti */
  const F = d.FORMAZIONE || {};
  if ((F.video || []).length) {
    const bl = [];
    if (F.intro)  bl.push({ tipo: 'info', testo: F.intro });
    if (F.avviso) bl.push({ tipo: 'nota', testo: F.avviso });
    for (const v of F.video) {
      bl.push({ tipo: 'video', titolo: (v.etichetta ? v.etichetta + ' · ' : '') + v.titolo,
                href: v.file, copertina: v.copertina, durata: v.durata || '',
                capitoli: v.capitoli || [], consigli: v.consigli || [] });
    }
    voce('video-inserimento', 'Video: come inserire i contratti', bl, {
      sottotitolo: 'Guarda la procedura completa, passo per passo.',
      etichetta: 'Formazione',
      keywords: 'video, inserimento, inserire contratto, caricare contratto, come si inserisce, tutorial, guida video, ' +
                (F.video || []).map(v => (v.titolo || '').toLowerCase()).join(', ')
    });
    log('video formativi: ' + F.video.length);
  }

  /* costi e tempi delle prestazioni sul contatore (per ora solo Sorgenia) */
  if ((d.PRESTAZIONI || []).length) {
    const pi = d.PRESTAZIONI_INFO || {};
    const eur = (x) => (typeof x === 'number' ? x.toFixed(2).replace('.', ',') + ' €' : String(x || ''));
    const perC = { luce: [], gas: [] };
    for (const x of d.PRESTAZIONI) {
      const dl = (typeof x.dl === 'number')
        ? (x.dl === 0 ? 'nessuno' : eur(x.dl) + (x.dlPerKw ? ' per kW' : ''))
        : String(x.dl || '');
      const tot = (typeof x.dl === 'number' && typeof x.sorgenia === 'number' && !x.dlPerKw)
        ? eur(x.dl + x.sorgenia) : '—';
      (perC[x.c] || perC.luce).push([
        x.nome,
        x.tempi == null ? '—' : (typeof x.tempi === 'number' ? x.tempi + ' gg lavorativi' : String(x.tempi)),
        dl,
        x.sorgenia == null ? 'nessuno' : eur(x.sorgenia),
        tot
      ]);
    }
    const col = ['Prestazione', 'Tempi', 'Costo distributore', 'Costo ' + info.nome, 'Totale cliente'];
    const bl = [{ tipo: 'info', testo: '<strong>' + (pi.iva || '') + '</strong>. ' + (pi.preventivi || '') + '.' }];
    if (perC.luce.length) bl.push({ tipo: 'tabella', titolo: 'Luce', colonne: col, righe: perC.luce });
    if (perC.gas.length)  bl.push({ tipo: 'tabella', titolo: 'Gas',  colonne: col, righe: perC.gas });
    bl.push({ tipo: 'nota', testo: 'Dove c’è <strong>preventivo</strong> il costo lo stabilisce il distributore caso per caso. L’aumento di potenza si paga <strong>per ogni kW in più</strong>, quindi il totale dipende dai kW richiesti.' });
    voce('costi-prestazioni', 'Costi e tempi delle prestazioni', bl, {
      sottotitolo: 'Interventi sul contatore: quanto costano e quanto durano.',
      etichetta: 'Prestazioni',
      // Solo nomi di operazioni (niente 'costo'/'prezzo' generici): cosi' se queste
      // keyword combaciano la domanda parla davvero di un intervento sul contatore
      // e non del prezzo di un'offerta commerciale.
      keywords: ['prestazione', 'prestazioni']
        .concat(d.PRESTAZIONI.map(x => String(x.nome || '').toLowerCase().trim()))
        .filter((v, i, a) => v && a.indexOf(v) === i).join(', ')
    });
    log('costi prestazioni: ' + d.PRESTAZIONI.length + ' voci');
  }

  /* materiali formativi allegati (file serviti da questo portale, non rimappati) */
  for (const a of (ALLEGATI[brand] || [])) {
    voce(a.id, a.titolo, a.blocchi, { sottotitolo: a.sottotitolo, etichetta: a.etichetta, keywords: a.keywords }, true);
  }
  if ((ALLEGATI[brand] || []).length) log('materiali formativi: ' + ALLEGATI[brand].length);

  /* contatti pubblici (i riservati agli AM restano fuori) */
  let nc = 0;
  for (const c of (d.RUBRICA || [])) {
    if (c.riservato) continue;
    contatti.push({ id: brand + ':' + c.id, brand, area: c.area || '', ufficio: c.ufficio || '',
      richieste: c.richieste || '', tel: c.tel || '', email: c.email || '',
      orari: c.orari || '', link: c.link || '', nota: c.nota || '', sort_order: nc });
    nc++;
  }
  if ((d.RUBRICA || []).length) log('contatti: ' + nc + ' pubblici (' + ((d.RUBRICA).length - nc) + ' riservati esclusi)');

  /* tipi di pratica ammessi: ogni brand dichiara le operazioni in un posto diverso.
     Servono a non proporre al dealer cose che il suo brand non puo' lavorare. */
  const tp = [];
  if (brand === 'plenitude') {
    // tabella "Operazioni ammesse": tengo solo le righe con almeno un si'
    for (const p of (d.PROCEDURE || [])) for (const b of (p.blocchi || [])) {
      if (b.tipo !== 'tabella' || !/operazion/i.test(b.titolo || '')) continue;
      for (const r of (b.righe || [])) {
        const okL = /✅/.test(r[1] || ''), okG = /✅/.test(r[2] || '');
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
  const visti = new Set();
  for (const t of tp) {
    if (!t.nome) continue;
    const id = brand + ':tp-' + t.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    if (visti.has(id)) continue;
    visti.add(id);
    tipiPratica.push({ id, brand, nome: t.nome, nota: t.nota, sort_order: nt++ });
  }
  log('tipi di pratica: ' + nt + ' -> ' + tipiPratica.map(x => x.nome).join(', '));

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
      luce: String(luce || (o.c ? '' : x.prezzo)), gas: String(gas), comm: String(x.comm),
      segmento: /bus|pmi|piva/i.test(o.seg || '') ? 'business' : 'domestico', sort_order: no++ });
  }
  log('offerte: ' + no);

  return { voci, contatti, offerte, tipiPratica };
}

/* Esegue il sorgente di un file dati e ne raccoglie le costanti.
   I file sono di due tipi: moduli CommonJS (module.exports) oppure
   costanti globali (const OFFERTE = ...). `vm` e' il modulo node:vm. */
export function eseguiFileDati(vm, sorgente, nome) {
  const module = { exports: {} };
  const ctx = { module, exports: module.exports, console: { log() {}, warn() {}, error() {} } };
  vm.createContext(ctx);
  const src = String(sorgente)
    .replace(/^(const|let|var)\s+([A-Z_][A-Za-z0-9_]*)\s*=/gm, 'globalThis.$2 =');
  vm.runInContext(src, ctx, { filename: nome, timeout: 2000 });
  const out = {};
  for (const [k, v] of Object.entries(ctx)) if (/^[A-Z_][A-Z0-9_]*$/.test(k)) out[k] = v;
  if (module.exports && typeof module.exports === 'object') {
    for (const [k, v] of Object.entries(module.exports)) if (/^[A-Z_][A-Z0-9_]*$/.test(k)) out[k] = v;
  }
  return out;
}

/* ============================================================================
   TESTO DELLE FONTI PER L'ASSISTENTE
   L'AI risponde leggendo il testo completo del portale info-utili del brand:
   procedure (dalle schede a blocchi), offerte con TUTTE le condizioni, e le
   altre informazioni (fibra, condizioni comuni, operazioni ammesse...).
   ========================================================================== */
export function pulisci(s) {
  return String(s == null ? '' : s)
    .replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&rarr;/g, '->').replace(/&mdash;|&ndash;/g, '-')
    .replace(/&euro;/g, '\u20ac').replace(/&[a-z]+;/g, ' ').replace(/[\u00a0\u2009\u202f]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
const CAMPI_TECNICI = /^(id|pdf|cte|file|copertina|semaforo|evidenza|icona|icon|colore|ordine|sort|href|link|url|img|immagine|ico)$/i;

/* Oggetto qualsiasi -> righe "campo: valore" leggibili. */
export function appiattisci(v, pre = '') {
  if (v == null || v === false || v === '') return [];
  if (typeof v !== 'object') return [(pre ? pre + ': ' : '') + pulisci(v)];
  if (Array.isArray(v)) {
    if (!v.length) return [];
    if (v.every(x => x == null || typeof x !== 'object')) return [(pre ? pre + ': ' : '') + v.map(pulisci).filter(Boolean).join(' \u00b7 ')];
    return v.flatMap(x => appiattisci(x, pre));
  }
  return Object.entries(v).filter(([k]) => !CAMPI_TECNICI.test(k)).flatMap(([k, x]) => appiattisci(x, k));
}

/* Schede a blocchi -> testo (stesso contenuto che vede il dealer). */
export function testoBlocchi(blocchi) {
  const out = [];
  for (const b of (blocchi || [])) {
    const t = b.titolo ? pulisci(b.titolo) + ': ' : '';
    if (b.tipo === 'passi' || b.tipo === 'lista') out.push(t + (b.voci || []).map((x, i) => (b.tipo === 'passi' ? (i + 1) + ') ' : '- ') + pulisci(x)).join(' '));
    else if (b.tipo === 'tabella') {
      const col = (b.colonne || []).map(pulisci);
      out.push((t || 'Tabella: ') + (b.righe || []).map(r => (r || []).map((c, i) => (col[i] ? col[i] + ' = ' : '') + pulisci(c)).join('; ')).join(' | '));
    }
    else if (b.tipo === 'video') out.push('Video ' + t + (b.durata ? '(durata ' + b.durata + ') ' : '') +
      (b.capitoli || []).map(c => pulisci(c[1])).join(' / ') + ((b.consigli || []).length ? ' Consigli: ' + b.consigli.map(pulisci).join(' ') : ''));
    else if (b.tipo === 'link' || b.tipo === 'file') out.push((b.tipo === 'file' ? 'File scaricabile ' : 'Link ') + t + pulisci(b.testo || ''));
    else out.push(t + pulisci(b.testo || ''));
  }
  return out.filter(Boolean).join('\n');
}

/* Dettagli che non stanno nelle schede: le offerte complete e le altre costanti
   del portale. Salvati dal sync nella tabella fonte_brand. */
const GIA_NELLE_SCHEDE = new Set(['OFFERTE', 'PROCEDURE', 'GUIDE', 'RUBRICA', 'STRUMENTI', 'COME_LEGGERE', 'FORMAZIONE',
  'MODULI_INFO', 'SCRIPT_IQC', 'MODULI', 'PRESTAZIONI', 'PRESTAZIONI_INFO', 'CONFIG', 'PANNELLO', 'IN_ARRIVO',
  'OFFERTE_AGGIORNAMENTO', 'OFFERTE_FONTE', 'SEMAFORO_FASCE']);
export function dettagliBrand(brand, d) {
  const offerte = (d.OFFERTE || []).map(o => {
    const nome = brand === 'alperia' ? (o.nome || '') : [o.fam, o.variante].filter(Boolean).join(' ');
    return { nome, c: o.c || '', seg: o.seg || '', dal: o.dal || '', al: o.al || o.scadenza || '',
             vendibileDal: o.vendibileDal || '', righe: appiattisci(o).filter(r => !/^(fam|variante|nome): /.test(r)) };
  }).filter(o => o.nome);
  const extra = Object.entries(d)
    .filter(([k, v]) => !GIA_NELLE_SCHEDE.has(k) && v != null && typeof v !== 'function')
    .map(([k, v]) => ({ chiave: k, testo: appiattisci(v).join('\n').slice(0, 6000) }))
    .filter(x => x.testo);
  return { offerte, extra };
}
