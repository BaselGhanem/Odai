const CACHE_PREFIX = `odai-offline`;
const SHELL_CACHE = `${CACHE_PREFIX}-shell-20260723-20`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-20260723-20`;
const SCOPE = self.registration.scope;

const shellUrl = (path) => new URL(path, SCOPE).href;
const CORE_ASSETS = [
  `./`,
  `./index.html`,
  `./styles.css?v=20260723-18`,
  `./app.js?v=20260723-20`,
  `./auth.js?v=20260719-7`,
  `./firebase.js?v=20260719-7`,
  `./favicon.svg`,
  `./manifest.webmanifest`,
  `./pwa.js?v=20260719-2`,
  `./app-icon-192.png`,
  `./app-icon-512.png`,
  `./owner-vault-970e16.html`,
  `./owner-vault.css?v=20260720-3`,
  `./owner-vault.js?v=20260720-3`,
].map(shellUrl);

const OPTIONAL_ASSETS = [
  `https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&display=swap`,
  `https://raw.githubusercontent.com/BaselGhanem/Odai/refs/heads/main/Gemini_Generated_Image_102ux0102ux0102u.png`,
  `https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js`,
  `https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js`,
  `https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js`,
  `https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js`,
  `https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js`,
];

const STATIC_HOSTS = new Set([
  `fonts.googleapis.com`,
  `fonts.gstatic.com`,
  `raw.githubusercontent.com`,
  `cdn.jsdelivr.net`,
  `www.gstatic.com`,
]);

async function put(cacheName, request, response) {
  if (!response || (!response.ok && response.type !== `opaque`))
    return response;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  return response;
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  return put(RUNTIME_CACHE, request, await fetch(request));
}

async function networkFirst(request) {
  const networkRequest = fetch(request).then((response) =>
    put(RUNTIME_CACHE, request, response),
  );
  try {
    return await Promise.race([
      networkRequest,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`network-timeout`)), 3200),
      ),
    ]);
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    return (
      (await caches.match(shellUrl(`./index.html`), {
        ignoreSearch: true,
      })) || new Response(``, { status: 503, statusText: `Offline` })
    );
  }
}

async function warmOptionalAsset(cache, asset) {
  let timer;
  await Promise.race([
    cache.add(new Request(asset)).catch(() => {}),
    new Promise((resolve) => {
      timer = setTimeout(resolve, 4500);
    }),
  ]);
  clearTimeout(timer);
}

self.addEventListener(`install`, (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(CORE_ASSETS);
      const runtime = await caches.open(RUNTIME_CACHE);
      await Promise.allSettled(
        OPTIONAL_ASSETS.map((asset) => warmOptionalAsset(runtime, asset)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener(`activate`, (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith(CACHE_PREFIX) &&
              key !== SHELL_CACHE &&
              key !== RUNTIME_CACHE,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener(`fetch`, (event) => {
  const { request } = event;
  if (request.method !== `GET`) return;
  const url = new URL(request.url);

  if (request.mode === `navigate`) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (STATIC_HOSTS.has(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
});
