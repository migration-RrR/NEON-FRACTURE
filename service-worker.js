// service-worker.js — NEON FRACTURE PWA
// Стратегия: Cache First — игра работает полностью офлайн после первого запуска.

const CACHE_NAME = "neon-fracture-v1";

// Все файлы, которые нужно закэшировать при установке
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./manifest.json",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-128.png",
  "./icons/icon-144.png",
  "./icons/icon-152.png",
  "./icons/icon-192.png",
  "./icons/icon-384.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

// Аудиофайлы кэшируем отдельно (могут отсутствовать — не ломаем установку)
const AUDIO_ASSETS = [
  "./soundreality-glitch-master-140900.mp3",
  "./179_cyberpunk_city.mp3",
  "./zvuk-padeniya-cheloveka.mp3",
  "./6146059e6a880e7.mp3",
  "./laser-shoot.wav",
  "./explosion.wav"
];

// ── INSTALL: кэшируем статику ──────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Обязательные файлы — кэшируем всё сразу
      await cache.addAll(STATIC_ASSETS);

      // Аудио — пробуем каждый по отдельности, ошибки не блокируют установку
      for (const url of AUDIO_ASSETS) {
        try {
          await cache.add(url);
        } catch (e) {
          console.log("[SW] Audio not cached (file missing):", url);
        }
      }

      console.log("[SW] Install complete — all assets cached");
    })
  );
  // Активируемся немедленно, не ждём закрытия старых вкладок
  self.skipWaiting();
});

// ── ACTIVATE: удаляем старые кэши ─────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      )
    ).then(() => {
      console.log("[SW] Activated — old caches removed");
      return self.clients.claim();  // берём контроль над всеми открытыми вкладками
    })
  );
});

// ── FETCH: Cache First, Network Fallback ──────────────────
self.addEventListener("fetch", event => {
  // Пропускаем не-GET запросы и chrome-extension
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith("http")) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Файл найден в кэше — отдаём немедленно
        return cached;
      }

      // Нет в кэше — пробуем сеть и кэшируем ответ
      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === "opaque") {
            return response;
          }
          // Сохраняем в кэш для следующего раза
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
          return response;
        })
        .catch(() => {
          // Нет сети и нет кэша — возвращаем заглушку для HTML
          if (event.request.headers.get("accept")?.includes("text/html")) {
            return caches.match("./index.html");
          }
        });
    })
  );
});

// ── MESSAGE: принудительное обновление кэша ───────────────
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data === "CLEAR_CACHE") {
    caches.delete(CACHE_NAME).then(() => {
      console.log("[SW] Cache cleared by request");
    });
  }
});