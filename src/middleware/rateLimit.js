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

// Anuncio por redes (13/11/2026): hasta esta fecha los límites por red se multiplican por 10 (mucha gente en el mismo
// Wi-Fi o datos móviles a la vez). Después vuelven solos a lo normal; no hay que acordarse de cambiarlo.
// Los límites por correo (intentos de contraseña) no cambian.
const HOLGURA_HASTA = new Date(process.env.LIMITES_RELAJADOS_HASTA || '2026-11-18T03:00:00Z'); // mié 18/11 00:00 en Chile (vale todo el martes 17/11)
const FACTOR_HOLGURA = 10;

function maximoVigente(maximo) {
  return Date.now() < HOLGURA_HASTA.getTime() ? maximo * FACTOR_HOLGURA : maximo;
}

// Middleware por IP. `nombre` separa los contadores de cada endpoint.
function limitarPorIp(nombre, maximo, ventanaSegundos) {
  return async (req, res, next) => {
    try {
      if (await consumir(`${nombre}:ip:${req.ip}`, maximoVigente(maximo), ventanaSegundos)) return next();
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
