const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

const DURACION_SESION_DIAS = 30;

function hmac(valor, proposito) {
  return crypto.createHmac('sha256', `${config.sessionSecret}:${proposito}`).update(valor).digest('hex');
}

function igualesSeguro(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function codigoSeisDigitos() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function tokenAleatorio(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function firmarSesion(user) {
  return jwt.sign({ sub: user.id, v: user.sessionVersion }, config.sessionSecret, {
    expiresIn: `${DURACION_SESION_DIAS}d`
  });
}

function verificarSesion(token) {
  try {
    return jwt.verify(token, config.sessionSecret);
  } catch {
    return null;
  }
}

// Token compacto firmado con propósito y expiración: base64url(payload).firma
function firmarEnlace(payload, proposito, segundos) {
  const datos = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + segundos })).toString('base64url');
  return `${datos}.${hmac(datos, proposito).slice(0, 32)}`;
}

function verificarEnlace(token, proposito) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [datos, firma] = token.split('.');
  if (!igualesSeguro(firma, hmac(datos, proposito).slice(0, 32))) return null;
  try {
    const payload = JSON.parse(Buffer.from(datos, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  DURACION_SESION_DIAS,
  hmac,
  igualesSeguro,
  codigoSeisDigitos,
  tokenAleatorio,
  firmarSesion,
  verificarSesion,
  firmarEnlace,
  verificarEnlace
};
