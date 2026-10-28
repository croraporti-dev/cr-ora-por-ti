const prisma = require('../db');

// Contador en Postgres: en Vercel la memoria no se comparte entre instancias.
async function consumir(clave, maximo, ventanaSegundos) {
  const filas = await prisma.$queryRaw`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${clave}, 1, now() + make_interval(secs => ${ventanaSegundos}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN now() + make_interval(secs => ${ventanaSegundos}) ELSE "RateLimit"."resetAt" END
    RETURNING "count"`;
  return filas[0].count <= maximo;
}

// Middleware por IP. `nombre` separa los contadores de cada endpoint.
function limitarPorIp(nombre, maximo, ventanaSegundos) {
  return async (req, res, next) => {
    try {
      if (await consumir(`${nombre}:ip:${req.ip}`, maximo, ventanaSegundos)) return next();
      res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' });
    } catch (err) {
      next(err);
    }
  };
}

async function limpiarVencidos() {
  await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
}

module.exports = { consumir, limitarPorIp, limpiarVencidos };
