// Acceso de orantes y líderes: correo + contraseña. Los jóvenes no inician sesión.
const express = require('express');
const prisma = require('../db');
const v = require('../validar');
const claves = require('../services/claves');
const { consumir, limitarPorIp } = require('../middleware/rateLimit');
const { ponerCookieSesion, borrarCookieSesion } = require('../middleware/auth');
const { esCodigoValido } = require('../services/invitacion');
const { crearUsuario, usuarioPublico } = require('../services/usuarios');
const { avisarNuevaSolicitud } = require('../services/solicitudes');

const router = express.Router();

const ERROR_CREDENCIALES = 'Correo o contraseña incorrectos. Si la olvidaste, pide a quien administra el grupo que te envíe un enlace para crear una nueva.';
const ERROR_ENLACE = 'Este enlace ya se usó o venció. Pide uno nuevo a quien administra el grupo.';

// POST /api/auth/registro — { invitacion, nombre, email, password, aceptaAviso }
// Se suma por el enlace de invitación y queda pendiente hasta que alguien con rol líder lo apruebe.
router.post('/registro', limitarPorIp('auth-registro', 40, 15 * 60), async (req, res, next) => {
  try {
    if (!(await esCodigoValido(req.body.invitacion))) {
      return res.status(400).json({ error: 'Este enlace de invitación ya no es válido. Pide uno nuevo a quien te invitó a orar.' });
    }
    if (req.body.aceptaAviso !== true) throw new v.ErrorValidacion('Para sumarte necesitas aceptar el aviso de privacidad.');
    const nombre = v.texto(req.body.nombre, { nombre: 'tu nombre', min: 2, max: 40 });
    const email = v.email(req.body.email);
    const clave = claves.validarClave(req.body.password);

    if (await prisma.user.findUnique({ where: { email } })) {
      return res.status(400).json({ error: 'Ese correo ya está registrado. Entra con tu contraseña.' });
    }
    const user = await crearUsuario({ email, nombre, rol: 'ORANTE', aprobado: false, passwordHash: await claves.cifrar(clave) });
    avisarNuevaSolicitud(user).catch((err) => console.error('[solicitud]', err.message));
    ponerCookieSesion(res, user);
    res.status(201).json({ ok: true, user: usuarioPublico(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/entrar — { email, password }
router.post('/entrar', limitarPorIp('auth-entrar', 60, 15 * 60), async (req, res, next) => {
  try {
    const email = v.email(req.body.email);
    // Frena a quien pruebe muchas contraseñas para un mismo correo.
    if (!(await consumir(`auth-entrar:email:${email}`, 8, 15 * 60))) {
      return res.status(429).json({ error: 'Demasiados intentos para este correo. Espera unos minutos.' });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    const ok = user?.passwordHash
      ? await claves.verificar(req.body.password, user.passwordHash)
      : await claves.verificarSinCuenta(req.body.password);
    if (!ok) return res.status(400).json({ error: ERROR_CREDENCIALES });
    ponerCookieSesion(res, user);
    res.json({ ok: true, user: usuarioPublico(user) });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/clave?t=... — ¿el enlace para crear contraseña sigue vigente? (no lo consume)
router.get('/clave', limitarPorIp('auth-clave', 60, 15 * 60), async (req, res, next) => {
  try {
    const enlace = await claves.buscarEnlace(req.query.t);
    if (!enlace) return res.status(400).json({ error: ERROR_ENLACE });
    res.json({ ok: true, nombre: enlace.user.nombre, email: enlace.user.email });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/clave — { t, password }: crea o cambia la contraseña con el enlace de un solo uso.
router.post('/clave', limitarPorIp('auth-clave', 60, 15 * 60), async (req, res, next) => {
  try {
    const clave = claves.validarClave(req.body.password);
    const enlace = await claves.buscarEnlace(req.body.t);
    if (!enlace) return res.status(400).json({ error: ERROR_ENLACE });
    // Marca el enlace como usado solo si nadie lo usó antes.
    const marcado = await prisma.enlaceAcceso.updateMany({ where: { id: enlace.id, usedAt: null }, data: { usedAt: new Date() } });
    if (!marcado.count) return res.status(400).json({ error: ERROR_ENLACE });
    // Nueva contraseña: se cierran las sesiones abiertas en otros dispositivos.
    const user = await prisma.user.update({
      where: { id: enlace.userId },
      data: { passwordHash: await claves.cifrar(clave), sessionVersion: { increment: 1 } }
    });
    ponerCookieSesion(res, user);
    res.json({ ok: true, user: usuarioPublico(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/salir', (req, res) => {
  borrarCookieSesion(res);
  res.json({ ok: true });
});

module.exports = router;
