/* ═══════════════════════════════════════════════════════════════
   SAB · sw.js — Service Worker (offline shell + cache CDN; API = network-only)
   Developer: ครูวิรัตน์ หาดคำ · www.kruwirat.com · v1.0.0
   ═══════════════════════════════════════════════════════════════ */
var CACHE = 'sab-v2';
var SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon.svg'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  var url = e.request.url;
  // API ไป GAS / googleusercontent → ปล่อยให้ browser จัดการเอง (network, ไม่ cache)
  if (url.indexOf('script.google.com') >= 0 || url.indexOf('googleusercontent.com') >= 0) return;
  if (e.request.method !== 'GET') return;

  // เปิดแอป (navigate) → network-first, ออฟไลน์ค่อยใช้ shell
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(function () { return caches.match('./index.html').then(function (r) { return r || caches.match('./'); }); }));
    return;
  }

  // static/CDN (ฟอนต์ ไอคอน ไลบรารี) → cache-first + อัปเดตเบื้องหลัง
  e.respondWith(caches.match(e.request).then(function (cached) {
    var net = fetch(e.request).then(function (res) {
      if (res && res.status === 200) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      return res;
    }).catch(function () { return cached; });
    return cached || net;
  }));
});
