/* Service worker de Bariloche Juntos.
   Dos trabajos: que la app abra sin señal y que se actualice sola.

   Estrategia: la red primero, el cache como red de emergencia.
   Así cada vez que abren la app ven la última versión, y si están
   sin datos en el Tronador igual les abre lo último que vieron. */

var CACHE = 'bariloche-v1';

var ESENCIALES = [
  './',
  './index.html',
  './sync.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(ESENCIALES); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys()
      .then(function(claves){
        return Promise.all(claves.map(function(k){
          if (k !== CACHE) return caches.delete(k);
        }));
      })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  /* lo de Firebase y cualquier otro dominio va directo a la red, sin cache */
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(function(res){
        if (res && res.ok) {
          var copia = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copia); });
        }
        return res;
      })
      .catch(function(){
        return caches.match(req).then(function(hit){
          if (hit) return hit;
          /* si pedían una página y no está, devolvemos la portada */
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', {status: 504, statusText: 'Sin conexión'});
        });
      })
  );
});
