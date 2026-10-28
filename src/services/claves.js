// Contraseñas (scrypt, sin dependencias nativas) y enlaces de un solo uso para crearlas o cambiarlas.
const crypto = require('crypto');
const { promisify } = require('util');
const prisma = require('../db');
const config = require('../config');
const v = require('../validar');
const { hmac, tokenAleatorio } = require('./tokens');

const scrypt = promisify(crypto.scrypt);
const PARAMETROS = { N: 16384, r: 8, p: 1 };
const LARGO = 64;

function validarClave(clave) {
  const c = String(clave ?? '');
  if (c.length < 8) throw new v.ErrorValidacion('La contraseña debe tener al menos 8 caracteres.');
  if (c.length > 200) throw new v.ErrorValidacion('La contraseña es demasiado larga.');
  return c;
}

// Formato guardado: scrypt$N$r$p$sal$hash
async function cifrar(clave) {
  const sal = crypto.randomBytes(16);
  const hash = await scrypt(clave, sal, LARGO, PARAMETROS);
  return ['scrypt', PARAMETROS.N, PARAMETROS.r, PARAMETROS.p, sal.toString('base64'), hash.toString('base64')].join('$');
}

async function verificar(clave, guardado) {
  if (!guardado) return false;
  const [tipo, N, r, p, sal, hash] = guardado.split('$');
  if (tipo !== 'scrypt') return false;
  const esperado = Buffer.from(hash, 'base64');
  const calculado = await scrypt(String(clave ?? ''), Buffer.from(sal, 'base64'), esperado.length, { N: +N, r: +r, p: +p });
  return crypto.timingSafeEqual(esperado, calculado);
}

// Hash de relleno: así una cuenta inexistente tarda lo mismo que una contraseña incorrecta.
let relleno;
async function verificarSinCuenta(clave) {
  relleno ||= await cifrar('relleno-para-igualar-tiempos');
  await verificar(clave, relleno);
  return false;
}

// Crea un enlace de un solo uso (#/clave?t=...) para que la persona elija su contraseña.
async function crearEnlaceAcceso(userId, horas = 24) {
  const token = tokenAleatorio();
  await prisma.$transaction([
    // Solo vale el último enlace enviado a esa persona.
    prisma.enlaceAcceso.deleteMany({ where: { userId, usedAt: null } }),
    prisma.enlaceAcceso.create({
      data: { userId, tokenHash: hmac(token, 'acceso'), expiresAt: new Date(Date.now() + horas * 60 * 60 * 1000) }
    })
  ]);
  return `${config.appUrl}/#/clave?t=${encodeURIComponent(token)}`;
}

async function buscarEnlace(token) {
  if (typeof token !== 'string' || !token || token.length > 100) return null;
  const enlace = await prisma.enlaceAcceso.findUnique({ where: { tokenHash: hmac(token, 'acceso') }, include: { user: true } });
  if (!enlace || enlace.usedAt || enlace.expiresAt < new Date()) return null;
  return enlace;
}

module.exports = { validarClave, cifrar, verificar, verificarSinCuenta, crearEnlaceAcceso, buscarEnlace };
