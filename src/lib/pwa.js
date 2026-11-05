'use strict';
// PeerEd - offline PWA pieces for the single file (stage 6). Strings only: the shell serves the
// manifest inline and registers the worker from the source below; this module itself loads nothing,
// registers nothing and reaches no network. The worker is cache-only for the one app file: it never
// calls out, and a cache miss is answered locally instead of going to the network.

function manifestJson(opts) {
  const o = opts || {};
  const name = typeof o.name === 'string' && o.name.trim() !== '' ? o.name : 'PeerEd';
  const icon = 'data:image/svg+xml,%3Csvg xmlns=%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27 viewBox=%270 0 100 100%27%3E%3Crect width=%27100%27 height=%27100%27 fill=%27%230f1117%27/%3E%3Ctext x=%2750%27 y=%2768%27 font-size=%2760%27 text-anchor=%27middle%27 fill=%27%237cc4ff%27%3EP%3C/text%3E%3C/svg%3E';
  return JSON.stringify({
    name: name, short_name: 'PeerEd', start_url: '.', scope: '.', display: 'standalone',
    background_color: '#0f1117', theme_color: '#0f1117',
    icons: [{ src: icon, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
  }, null, 2) + '\n';
}

// Cache-first, offline-only worker for './' and './app.html'. Worded without the worker-registration
// API on purpose: registration belongs to the shell, this is only the worker's own source text.
function swSource(opts) {
  const cache = opts && typeof opts.cacheName === 'string' && /^[a-z0-9-]+$/.test(opts.cacheName) ? opts.cacheName : 'peered-v1';
  return [
    "'use strict';",
    "var CACHE = '" + cache + "';",
    "var FILES = ['./', './app.html'];",
    "self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });",
    "self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return (k === CACHE || k.indexOf('peered-') !== 0) ? null : caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });",
    "self.addEventListener('fetch', function (e) { e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('./app.html', { ignoreSearch: true }); }).then(function (hit) { return hit || new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }); })); });",
    ''
  ].join('\n');
}

module.exports = { manifestJson, swSource };
