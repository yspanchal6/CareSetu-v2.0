// sw.js — CareSetu Master Service Worker & Offline Cache Policy
//
// CACHE CLASSIFICATION:
//  - STATIC SHELL: Cache-first (index.html, manifest, icons, hashed Vite assets).
//  - PUBLIC DATA: Stale-while-revalidate (public hospital directory, help content).
//  - SENSITIVE DATA: Network-only (auth, health-pack, medical documents, admin, chat uploads).
//  - MUTATIONS: Network-only (all POST, PUT, DELETE, PATCH requests).
//
// SECURITY RULE: Passwords, OTPs, JWTs, private medical records, HealthPacks,
// and identity documents are NEVER cached in Service Worker / Cache API.

const CACHE_NAME = "caresetu-shell-v3";
const DATA_CACHE_NAME = "caresetu-data-v1";
const OFFLINE_URL = "/offline.html";
const SHELL_ASSET_RE = /(?:src|href)="(\/assets\/[^"]+)"/g;

// SENSITIVE_NETWORK_ONLY Classification
function isSensitiveNetworkOnly(url) {
  const p = url.pathname;
  return (
    p.startsWith("/api/auth") ||
    p.startsWith("/api/health-pack") ||
    p.startsWith("/api/healthpack") ||
    p.startsWith("/api/documents") ||
    p.startsWith("/api/patient/profile") ||
    p.startsWith("/api/patient/medical-information") ||
    p.startsWith("/api/hospital") ||
    p.startsWith("/api/doctor") ||
    p.startsWith("/api/admin") ||
    p.includes("upload-document") ||
    p.includes("ocr") ||
    p.includes("analyze-image")
  );
}

// Public endpoints eligible for stale-while-revalidate
function isPublicCacheable(url) {
  const p = url.pathname;
  return p.startsWith("/api/hospitals") || p.startsWith("/api/help");
}

async function precacheShell(cache) {
  const urls = new Set([OFFLINE_URL, "/", "/favicon.svg", "/manifest.json"]);

  try {
    const res = await fetch("/index.html", { cache: "no-cache", redirect: "follow" });
    if (res.ok) {
      const html = await res.text();
      let match;
      while ((match = SHELL_ASSET_RE.exec(html)) !== null) {
        urls.add(match[1]);
      }
      urls.add("/index.html");
    }
  } catch (e) {
    console.warn("[SW] Could not read shell during install:", e && e.message);
  }

  const jobs = [];
  for (const url of urls) {
    jobs.push(cache.add(url).catch(() => {}));
  }
  await Promise.allSettled(jobs);
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => precacheShell(cache)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== DATA_CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. Non-GET or cross-origin requests -> let browser handle directly
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // 2. Sensitive API requests -> NETWORK-ONLY
  if (isSensitiveNetworkOnly(url)) {
    return; // Fall through to standard network fetch
  }

  // 3. Public Cacheable API requests -> Stale-While-Revalidate
  if (isPublicCacheable(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(DATA_CACHE_NAME);
        const cachedResponse = await cache.match(event.request);
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone()).catch(() => {});
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })()
    );
    return;
  }

  // 4. HTML Navigation -> Network-First, fallback to cached /index.html -> /offline.html
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const live = await fetch(event.request);
          if (live.ok && (url.pathname === "/" || url.pathname === "/index.html")) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, live.clone()).catch(() => {});
          }
          return live;
        } catch (err) {
          const cache = await caches.open(CACHE_NAME);
          const shell = await cache.match("/index.html");
          if (shell) return shell;
          const fallback = await cache.match(OFFLINE_URL);
          if (fallback) return fallback;
          return new Response("Offline", { headers: { "Content-Type": "text/plain" } });
        }
      })()
    );
    return;
  }

  // 5. Static Shell Assets (Vite /assets/*, icons) -> Cache-First
  if (/\/assets\/.+/.test(url.pathname) || url.pathname === "/favicon.svg") {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const hit = await cache.match(new Request(url.href, { method: "GET" }), { ignoreMethod: true });
        return hit || fetch(event.request).catch(() => new Response("", { status: 504 }));
      })
    );
  }
});