const prisma = require('../db');
const config = require('../config');
const { verificarSesion, firmarSesion, DURACION_SESION_DIAS } = require('../services/tokens');

const COOKIE = 'cr_sesion';

function ponerCookieSesion(res, user) {
  res.cookie(COOKIE, firmarSesion(user), {
    httpOnly: true,
    secure: config.esProduccion,
    sameSite: 'lax',
    path: '/',
    maxAge: DURACION_SESION_DIAS * 24 * 60 * 60 * 1000
  });
}

function borrarCookieSesion(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

// Carga req.user si hay una sesión válida (no obliga a tener sesión).
async function cargarUsuario(req, res, next) {
  const payload = req.cookies?.[COOKIE] && verificarSesion(req.cookies[COOKIE]);
  if (!payload) return next();
  try {
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    // Si el líder quitó al usuario o se invalidaron sus sesiones, la cookie deja de valer.
    if (user && user.sessionVersion === payload.v) req.user = user;
    else borrarCookieSesion(res);
    next();
  } catch (err) {
    next(err);
  }
}

function requiereSesion(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Tu sesión terminó. Vuelve a entrar.' });
  next();
}

function requiereRol(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Tu sesión terminó. Vuelve a entrar.' });
    if (!roles.includes(req.user.rol)) return res.status(403).json({ error: 'No tienes permiso para esto.' });
    next();
  };
}

module.exports = { COOKIE, ponerCookieSesion, borrarCookieSesion, cargarUsuario, requiereSesion, requiereRol };
