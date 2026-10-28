// Suscripciones Web Push. Sirve para orantes/líder (sesión) y para jóvenes (celular recordado).
const express = require('express');
const prisma = require('../db');
const config = require('../config');
const push = require('../services/push');
const { cargarJoven } = require('../middleware/joven');
const { limitarPorIp } = require('../middleware/rateLimit');

const router = express.Router();
router.use(cargarJoven);

// Dueño de este dispositivo: la sesión tiene prioridad sobre el joven recordado.
function dueno(req) {
  return req.user || req.joven || null;
}

function requiereDueno(req, res, next) {
  if (!dueno(req)) return res.status(401).json({ error: 'Primero entra a la app.' });
  next();
}

function leerSuscripcion(s) {
  const endpoint = typeof s?.endpoint === 'string' ? s.endpoint : '';
  const p256dh = s?.keys?.p256dh;
  const auth = s?.keys?.auth;
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100) {
    return null;
  }
  return { endpoint, p256dh, auth };
}

// GET /api/push/clave — clave pública VAPID (pública por diseño)
router.get('/clave', (req, res) => {
  res.json({ clave: config.vapid.publicKey || null });
});

// GET /api/push/estado?endpoint=... — ¿este dispositivo está registrado y activo?
router.get('/estado', requiereDueno, async (req, res, next) => {
  try {
    const user = dueno(req);
    const [esteDispositivo, activas, prefs] = await Promise.all([
      req.query.endpoint
        ? prisma.pushSubscription.findFirst({ where: { endpoint: String(req.query.endpoint), userId: user.id }, select: { activa: true, lastSuccessAt: true } })
        : null,
      prisma.pushSubscription.count({ where: { userId: user.id, activa: true } }),
      prisma.notificationPrefs.findUnique({ where: { userId: user.id }, select: { pushNecesitaReactivar: true } })
    ]);
    res.json({
      disponible: push.disponible(),
      esteDispositivo: esteDispositivo ? { activa: esteDispositivo.activa, ultimoExito: esteDispositivo.lastSuccessAt } : null,
      activas,
      necesitaReactivar: !!prefs?.pushNecesitaReactivar
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/push/suscribir — { subscription, anterior? }
router.post('/suscribir', limitarPorIp('push-suscribir', 300, 60 * 60), requiereDueno, async (req, res, next) => {
  try {
    const sub = leerSuscripcion(req.body.subscription);
    if (!sub) return res.status(400).json({ error: 'La suscripción no es válida.' });
    const user = dueno(req);
    const userAgent = String(req.get('user-agent') || '').slice(0, 300);
    if (typeof req.body.anterior === 'string' && req.body.anterior !== sub.endpoint) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: req.body.anterior, userId: user.id } });
    }
    // Un mismo celular puede cambiar de dueño (p. ej. alguien prueba con el celular de otra persona).
    await prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { ...sub, userId: user.id, userAgent },
      update: { ...sub, userId: user.id, userAgent, activa: true, fallosSeguidos: 0 }
    });
    await prisma.notificationPrefs.updateMany({ where: { userId: user.id }, data: { pushNecesitaReactivar: false } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/push/desuscribir — { endpoint }
router.post('/desuscribir', requiereDueno, async (req, res, next) => {
  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: String(req.body.endpoint || ''), userId: dueno(req).id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/push/prueba — envía una notificación de prueba a los dispositivos de esta persona
router.post('/prueba', limitarPorIp('push-prueba', 60, 60 * 60), requiereDueno, async (req, res, next) => {
  try {
    const user = dueno(req);
    if (!push.disponible()) return res.status(503).json({ error: 'El servidor aún no tiene configuradas las claves de avisos (VAPID).' });
    const r = await push.enviarAUsuario(user.id, {
      title: 'CR ora por ti',
      body: `¡Hola, ${user.nombre}! Así se verán tus avisos. Si ves esto, todo funciona.`,
      url: user.rol === 'JOVEN' ? '/#/mis' : '/#/ajustes',
      tag: 'prueba'
    });
    if (r.sinSuscripcion) return res.status(400).json({ error: 'No hay avisos activos en ningún dispositivo. Primero toca "Activar avisos en este dispositivo".' });
    if (!r.ok) return res.status(502).json({ error: 'No pudimos entregar el aviso. Vuelve a activar los avisos en este dispositivo.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
