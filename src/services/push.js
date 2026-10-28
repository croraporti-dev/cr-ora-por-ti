// Web Push con claves VAPID. Lleva el registro de salud de cada suscripción.
const prisma = require('../db');
const config = require('../config');

let transporteDePrueba = null;
let webpush = null;

// Para tests: fn(sub, payload) que resuelve o lanza un error con statusCode.
function usarTransporte(fn) {
  transporteDePrueba = fn;
}

function disponible() {
  return !!transporteDePrueba || !!(config.vapid.publicKey && config.vapid.privateKey);
}

function cliente() {
  if (!webpush) {
    webpush = require('web-push');
    webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
  }
  return webpush;
}

// Envía a una suscripción. Devuelve { ok, vencida, error }.
async function enviarASuscripcion(sub, payload) {
  try {
    if (transporteDePrueba) await transporteDePrueba(sub, payload);
    else {
      await cliente().sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 6 * 60 * 60, urgency: 'high' }
      );
    }
    await prisma.pushSubscription.update({
      where: { id: sub.id },
      data: { lastSuccessAt: new Date(), fallosSeguidos: 0 }
    });
    return { ok: true };
  } catch (err) {
    // 404/410: el navegador anuló la suscripción (app desinstalada, permisos quitados, etc.)
    const vencida = err.statusCode === 404 || err.statusCode === 410;
    await prisma.pushSubscription.update({
      where: { id: sub.id },
      data: { lastErrorAt: new Date(), fallosSeguidos: { increment: 1 }, ...(vencida ? { activa: false } : {}) }
    });
    return { ok: false, vencida, error: err.statusCode ? `push ${err.statusCode}` : 'push sin respuesta' };
  }
}

// Envía a todas las suscripciones activas de un usuario. ok = al menos una llegó.
async function enviarAUsuario(userId, payload) {
  if (!disponible()) return { ok: false, sinSuscripcion: true };
  const subs = await prisma.pushSubscription.findMany({ where: { userId, activa: true } });
  if (!subs.length) return { ok: false, sinSuscripcion: true };
  const resultados = await Promise.all(subs.map((s) => enviarASuscripcion(s, payload)));
  const ok = resultados.some((r) => r.ok);
  await prisma.notificationPrefs.updateMany({ where: { userId }, data: { pushNecesitaReactivar: !ok } });
  return { ok, error: ok ? null : resultados.map((r) => r.error).join(', ') };
}

module.exports = { usarTransporte, disponible, enviarAUsuario, enviarASuscripcion };
