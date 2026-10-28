const prisma = require('../db');

// Contador en Postgres: en Vercel la memoria no se comparte entre instancias.
// Las columnas son TIMESTAMP sin zona en UTC (como las escribe Prisma), por eso now() AT TIME ZONE 'UTC'.
async function consumir(clave, maximo, ventanaSegundos) {
  const filas = await prisma.$queryRaw`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${clave}, 1, (now() AT TIME ZONE 'UTC') + make_interval(secs => ${ventanaSegundos}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" < (now() AT TIME ZONE 'UTC') THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < (now() AT TIME ZONE 'UTC') THEN (now() AT TIME ZONE 'UTC') + make_interval(secs => ${ventanaSegundos}) ELSE "RateLimit"."resetAt" END
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
