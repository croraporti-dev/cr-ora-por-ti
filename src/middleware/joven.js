// El joven no inicia sesión: su celular queda recordado con una cookie de larga duración.
const prisma = require('../db');
const config = require('../config');
const { hmac, tokenAleatorio } = require('../services/tokens');

const COOKIE = 'cr_joven';
const DURACION_DIAS = 365;

async function recordarDispositivo(res, userId) {
  const token = tokenAleatorio();
  await prisma.deviceToken.create({ data: { userId, tokenHash: hmac(token, 'dispositivo') } });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: config.esProduccion,
    sameSite: 'lax',
    path: '/',
    maxAge: DURACION_DIAS * 24 * 60 * 60 * 1000
  });
}

async function olvidarDispositivo(req, res) {
  const token = req.cookies?.[COOKIE];
  if (token) await prisma.deviceToken.deleteMany({ where: { tokenHash: hmac(token, 'dispositivo') } });
  res.clearCookie(COOKIE, { path: '/' });
}

// Carga req.joven si la cookie corresponde a un joven existente.
async function cargarJoven(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return next();
  try {
    const dispositivo = await prisma.deviceToken.findUnique({
      where: { tokenHash: hmac(token, 'dispositivo') },
      include: { user: true }
    });
    if (dispositivo?.user?.rol === 'JOVEN') {
      req.joven = dispositivo.user;
      // Actualiza "último uso" como máximo una vez al día.
      if (Date.now() - dispositivo.lastUsedAt.getTime() > 24 * 60 * 60 * 1000) {
        await prisma.deviceToken.update({ where: { id: dispositivo.id }, data: { lastUsedAt: new Date() } });
      }
    } else {
      res.clearCookie(COOKIE, { path: '/' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requiereJoven(req, res, next) {
  if (!req.joven) return res.status(401).json({ error: 'Primero cuéntanos quién eres.', necesitaPerfil: true });
  next();
}

module.exports = { recordarDispositivo, olvidarDispositivo, cargarJoven, requiereJoven };
