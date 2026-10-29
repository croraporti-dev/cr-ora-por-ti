// Service worker de CR ora por ti: recibe los avisos push y deja la app abriendo sin conexión.
const VERSION = 'cr-ora-v3';
const ARCHIVOS = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.webmanifest',
  '/js/app.js',
  '/js/api.js',
  '/js/ui.js',
  '/js/fechas.js',
  '/js/textos.js',
  '/js/push.js',
  '/js/vistas/login.js',
  '/js/vistas/joven.js',
  '/js/vistas/agenda.js',
  '/js/vistas/ajustes.js',
  '/js/vistas/avisos.js',
  '/js/vistas/lider.js',
  '/icons/icon-192.png',
  '/icons/logo-azul.svg',
  '/icons/badge-96.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red primero (para ver siempre lo último) y caché si no hay conexión. La API nunca se cachea.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(VERSION).then((c) => c.put(event.request, copia));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match('/index.html')))
  );
});

// ---------- Avisos push ----------

self.addEventListener('push', (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { body: event.data ? event.data.text() : '' };
  }
  const titulo = datos.title || 'CR ora por ti';
  const opciones = {
    body: datos.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: datos.tag,
    renotify: !!datos.tag,
    lang: 'es-CL',
    data: { url: datos.url || '/', animo: datos.animo || null },
    // Botones (Android y escritorio; en iPhone se ignoran y el toque abre la app).
    actions: Array.isArray(datos.actions) ? datos.actions.slice(0, 3) : []
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

async function abrir(url) {
  const destino = new URL(url, location.origin).href;
  const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const v of ventanas) {
    if (new URL(v.url).origin === location.origin) {
      await v.focus();
      return v.navigate(destino).catch(() => v.postMessage({ tipo: 'navegar', url }));
    }
  }
  return self.clients.openWindow(destino);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url, animo } = event.notification.data || {};
  const accion = event.action;

  // Botones "¿Cómo te fue?": registran el ánimo con el token firmado, sin abrir sesión.
  if (accion && animo?.token) {
    event.waitUntil(
      fetch('/api/animo', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-CR-App': '1' },
        body: JSON.stringify({ t: animo.token, animo: accion })
      })
        .then((r) => {
          if (!r.ok) throw new Error();
          return self.registration.showNotification('¡Gracias por contarnos!', {
            body: 'Seguimos orando por ti.',
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-96.png',
            tag: 'gracias'
          });
        })
        .catch(() => abrir('/#/mis'))
    );
    return;
  }
  event.waitUntil(abrir(url || '/'));
});

// El navegador renovó la suscripción: se la mandamos al servidor (con la cookie de este dispositivo).
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const anterior = event.oldSubscription;
      const nueva = event.newSubscription ||
        (anterior && (await self.registration.pushManager.subscribe(anterior.options)));
      if (!nueva) return;
      await fetch('/api/push/suscribir', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'X-CR-App': '1' },
        body: JSON.stringify({ subscription: nueva.toJSON(), anterior: anterior?.endpoint })
      });
    })()
  );
});
