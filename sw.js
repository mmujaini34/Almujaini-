/* شجرة عائلة المجيني — عامل الخدمة
   يجعل الموقع يفتح بدون إنترنت. البيانات الحية (الأسماء، الرسائل، الإدارة) لا تُخزَّن هنا:
   الصفحة نفسها تحفظ آخر نسخة من الأسماء في الجهاز. */
const CACHE = "mujaini-tree-v1";
const CORE = [
  "./",
  "emblem.webp",
  "bg-mujaini.jpg",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png"
];
const RUNTIME_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"];
const HOME_PATH = new URL("./", self.location).pathname;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("mujaini-tree-") && key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isHomePage(url) {
  return url.pathname === HOME_PATH || url.pathname === HOME_PATH + "index.html";
}

// الصفحة: الشبكة أولًا حتى يصل كل تحديث فورًا، والنسخة المحفوظة عند انقطاع الإنترنت
async function pageFromNetworkFirst(request, url) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    const type = fresh.headers.get("content-type") || "";
    if (fresh.ok && isHomePage(url) && type.includes("text/html")) cache.put("./", fresh.clone());
    return fresh;
  } catch (error) {
    if (isHomePage(url)) {
      const cached = await cache.match("./");
      if (cached) return cached;
    }
    return Response.error();
  }
}

// الملفات الثابتة: النسخة المحفوظة فورًا مع تحديثها في الخلفية
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(response => {
      if (response && (response.ok || response.type === "opaque")) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

// صور الأشخاص لا تتغير بعد رفعها (اسم جديد لكل صورة)
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    return Response.error();
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === "navigate") {
      event.respondWith(pageFromNetworkFirst(request, url));
      return;
    }
    if (url.pathname.endsWith("/sw.js")) return;
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (url.hostname.endsWith(".supabase.co")) {
    if (url.pathname.startsWith("/storage/v1/object/public/photos/")) event.respondWith(cacheFirst(request));
    return;
  }

  if (RUNTIME_HOSTS.includes(url.hostname)) event.respondWith(staleWhileRevalidate(request));
});
