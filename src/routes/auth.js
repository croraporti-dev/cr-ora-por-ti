const express = require('express');
const prisma = require('../db');
const config = require('../config');
const v = require('../validar');
const { hmac, igualesSeguro, codigoSeisDigitos, tokenAleatorio } = require('../services/tokens');
const { consumir, limitarPorIp } = require('../middleware/rateLimit');
const { ponerCookieSesion, borrarCookieSesion } = require('../middleware/auth');
const { enviarCorreo } = require('../services/mailer');
const { correoAcceso } = require('../services/plantillas');
const { esCodigoValido } = require('../services/invitacion');
const { crearUsuario, usuarioPublico } = require('../services/usuarios');

const router = express.Router();

const MINUTOS_VIGENCIA = 15;
const MAX_INTENTOS = 5;
const MENSAJE_ENVIADO = 'Te enviamos un correo con un código de 6 dígitos. Revisa también la carpeta de spam.';

// POST /api/auth/solicitar — pide código + enlace mágico (login o registro).
router.post('/solicitar', limitarPorIp('auth-solicitar', 10, 15 * 60), async (req, res, next) => {
  try {
    const email = v.email(req.body.email);
    const modo = v.opcion(req.body.modo, ['login', 'registro'], 'modo');

    if (!(await consumir(`auth-solicitar:email:${email}`, 4, 15 * 60))) {
      return res.status(429).json({ error: 'Ya pedimos varios códigos para este correo. Espera unos minutos.' });
    }

    const existente = await prisma.user.findUnique({ where: { email } });
    let registro = null;

    if (modo === 'registro' && !existente) {
      if (!(await esCodigoValido(req.body.codigoInvitacion))) {
        return res.status(400).json({ error: 'El código de invitación no es válido. Pídeselo a la líder de jóvenes.' });
      }
      const esMenor = req.body.esMenor === true;
      if (req.body.aceptaAviso !== true) {
        return res.status(400).json({ error: 'Para registrarte necesitas aceptar el aviso de privacidad.' });
      }
      if (esMenor && req.body.apoderado !== true) {
        return res.status(400).json({ error: 'Si eres menor de edad, tu apoderado debe estar en conocimiento.' });
      }
      registro = {
        nombre: v.texto(req.body.nombre, { nombre: 'tu nombre', min: 2, max: 40 }),
        rol: v.opcion(req.body.rol, ['JOVEN', 'ORANTE'], 'rol'),
        esMenor,
        apoderado: esMenor
      };
    }

    // En login con un correo desconocido respondemos lo mismo, para no revelar quién está registrado.
    if (!existente && !registro) return res.json({ ok: true, mensaje: MENSAJE_ENVIADO });

    const codigo = codigoSeisDigitos();
    const enlaceToken = tokenAleatorio();
    await prisma.$transaction([
      prisma.loginToken.deleteMany({ where: { email, usedAt: null } }),
      prisma.loginToken.create({
        data: {
          email,
          codeHash: hmac(codigo, 'codigo'),
          linkHash: hmac(enlaceToken, 'enlace'),
          expiresAt: new Date(Date.now() + MINUTOS_VIGENCIA * 60 * 1000),
          registro
        }
      })
    ]);

    const enlace = `${config.appUrl}/#/entrar?t=${encodeURIComponent(enlaceToken)}`;
    await enviarCorreo({ to: email, ...correoAcceso({ codigo, enlace }) });
    res.json({ ok: true, mensaje: MENSAJE_ENVIADO });
  } catch (err) {
    next(err);
  }
});

async function completarAcceso(token, res) {
  // Marca el token como usado solo si nadie lo usó antes (evita doble uso simultáneo).
  const marcado = await prisma.loginToken.updateMany({ where: { id: token.id, usedAt: null }, data: { usedAt: new Date() } });
  if (!marcado.count) return res.status(400).json({ error: 'Este acceso ya se usó. Pide uno nuevo.' });

  let user = await prisma.user.findUnique({ where: { email: token.email } });
  if (!user && token.registro) user = await crearUsuario({ email: token.email, ...token.registro });
  if (!user) return res.status(400).json({ error: 'No encontramos tu cuenta. Regístrate con el código de invitación.' });
  ponerCookieSesion(res, user);
  res.json({ ok: true, user: usuarioPublico(user) });
}

// POST /api/auth/verificar — { email, codigo }
router.post('/verificar', limitarPorIp('auth-verificar', 20, 15 * 60), async (req, res, next) => {
  try {
    const email = v.email(req.body.email);
    const codigo = String(req.body.codigo || '').replace(/\D/g, '');
    const token = await prisma.loginToken.findFirst({
      where: { email, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' }
    });
    if (!token || token.intentos >= MAX_INTENTOS) {
      return res.status(400).json({ error: 'El código venció o ya se usó. Pide uno nuevo.' });
    }
    if (codigo.length !== 6 || !igualesSeguro(hmac(codigo, 'codigo'), token.codeHash)) {
      await prisma.loginToken.update({ where: { id: token.id }, data: { intentos: { increment: 1 } } });
      return res.status(400).json({ error: 'El código no coincide. Revísalo e inténtalo otra vez.' });
    }
    await completarAcceso(token, res);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/enlace — { t }. El enlace del correo abre la app y ella llama aquí
// (así los antivirus de correo que "visitan" enlaces no consumen el acceso).
router.post('/enlace', limitarPorIp('auth-enlace', 20, 15 * 60), async (req, res, next) => {
  try {
    const t = String(req.body.t || '');
    const token = t && (await prisma.loginToken.findUnique({ where: { linkHash: hmac(t, 'enlace') } }));
    if (!token || token.usedAt || token.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Este enlace venció o ya se usó. Pide uno nuevo.' });
    }
    await completarAcceso(token, res);
  } catch (err) {
    next(err);
  }
});

router.post('/salir', (req, res) => {
  borrarCookieSesion(res);
  res.json({ ok: true });
});

module.exports = router;
