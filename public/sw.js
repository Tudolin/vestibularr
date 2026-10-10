/* Service worker do Vestibularr.
 * - Arquivos estáticos do Next (/_next/static, ícones): cache-first (têm hash no nome).
 * - Páginas: network-first; as de prova/redação/estudo visitadas ficam em cache para abrir offline.
 * - Dados (Supabase, server actions, RSC): sempre rede — a fila offline do app cuida das respostas.
 * - Ao sair da conta, o app pede para apagar as páginas em cache (mensagem "clear-pages").
 */
const VERSION = "v3";
const STATIC = `vr-static-${VERSION}`;
const PAGES = `vr-pages-${VERSION}`;
const OFFLINE = "/offline.html";
const CACHEABLE_PAGE = /^\/(inicio|estudar|prova|redacao|desempenho|dicas|guia|perfil|tripulacao)(\/|$)/;
const MAX_PAGES = 80;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png", "/icons/icon-512.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("vr-") && k !== STATIC && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGES));
  // "Baixar para estudar sem internet": guarda as páginas pedidas e os arquivos de que cada uma precisa
  if (event.data && event.data.type === "cache-urls") event.waitUntil(precache(event.data.urls || [], event.data.quiet ? null : event.source));
});

/** Baixa cada página (com a sessão do aluno) e os JS/CSS que ela usa; avisa o progresso para a tela. */
async function precache(urls, client) {
  const pages = await caches.open(PAGES);
  const stat = await caches.open(STATIC);
  let done = 0, ok = 0;
  for (const u of urls) {
    try {
      const url = new URL(u, self.location.origin);
      if (url.origin !== self.location.origin || !CACHEABLE_PAGE.test(url.pathname)) continue;
      const res = await fetch(url.href, { credentials: "same-origin", headers: { accept: "text/html" } });
      if (res.ok && !res.redirected) {
        const html = await res.clone().text();
        await pages.put(new Request(url.href), res);
        const assets = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]);
        await Promise.all([...new Set(assets)].map(async (a) => {
          if (await stat.match(a)) return;
          const r = await fetch(a).catch(() => null);
          if (r && r.ok) await stat.put(a, r);
        }));
        ok++;
      }
    } catch { /* uma página falhar não para as outras */ }
    done++;
    if (client) client.postMessage({ type: "cache-progress", done, ok, total: urls.length });
  }
  await trim(PAGES, MAX_PAGES);
  if (client) client.postMessage({ type: "cache-done", ok, total: urls.length });
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase/Gemini: nunca em cache
  if (url.pathname.startsWith("/api/")) return;

  // estáticos versionados
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) caches.open(STATIC).then((c) => c.put(req, res.clone()));
        return res;
      })),
    );
    return;
  }

  // RSC (navegação client-side): rede. Offline, o Next cai para navegação completa, atendida abaixo.
  if (req.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected && CACHEABLE_PAGE.test(url.pathname)) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy)).then(() => trim(PAGES, MAX_PAGES));
          }
          return res;
        })
        .catch(async () => (await caches.match(req, { cacheName: PAGES })) || (await caches.match(OFFLINE))),
    );
  }
});

// ------------------------------------------------------------------ notificações (push)
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Vestibularr", body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || "Vestibularr", {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || "/inicio" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/inicio", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin && "focus" in w) { await w.focus(); if ("navigate" in w) await w.navigate(url); return; }
    }
    await self.clients.openWindow(url);
  })());
});
