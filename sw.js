/* Service worker del Supporto Dealer: rende il portale installabile come app.
   Strategia "prima la rete": il dealer vede sempre la versione aggiornata;
   la copia salvata serve solo se manca la connessione (si apre comunque la
   pagina, e le richieste mostrano il messaggio "Connessione non disponibile").
   Le chiamate /api/ non passano mai dalla copia: sono sempre dal vivo. */
const CACHE = 'supporto-dealer-v1';
const BASE = ['/', '/manifest.webmanifest', '/assets/icone/icon-192.png', '/assets/icone/icona.svg', '/assets/montserrat.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(chiavi => Promise.all(chiavi.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && res.type === 'basic') {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? '/' : req, copia));
      }
      return res;
    }).catch(() => caches.match(req.mode === 'navigate' ? '/' : req).then(r => r || caches.match('/')))
  );
});
