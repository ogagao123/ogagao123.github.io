"use strict";

const APP_VERSION = "0.9";
const CACHE_NAME = "shakai-navi-v" + APP_VERSION;

const PRECACHE = [
  "./",
  "./index.html",
  "./style.css?v=" + APP_VERSION,
  "./app.js?v=" + APP_VERSION,
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key =>
            key.indexOf("shakai-navi-") === 0 &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function isNavigation(request) {
  return request.mode === "navigate" ||
    (request.headers.get("accept") || "").indexOf("text/html") !== -1;
}

function isAppAsset(request) {
  const url = new URL(request.url);
  return /\/(app\.js|style\.css|manifest\.json)$/.test(url.pathname);
}

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });

    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (isNavigation(request)) {
      const fallback = await caches.match("./index.html");
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const networkPromise = fetch(request, { cache: "no-store" })
    .then(async response => {
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    });

  if (cached) {
    networkPromise.catch(() => {});
    return cached;
  }

  return networkPromise;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  if (isNavigation(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isAppAsset(request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
