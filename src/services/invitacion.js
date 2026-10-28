// Enlace de invitación para sumarse a orar: /#/unirse?i=<token>.
// Quien entra por el enlace queda pendiente hasta que alguien con rol líder lo aprueba,
// así que un enlace filtrado no da acceso a la agenda.
const prisma = require('../db');
const config = require('../config');
const { tokenAleatorio } = require('./tokens');

function enlace(code) {
  return `${config.appUrl}/#/unirse?i=${encodeURIComponent(code)}`;
}

async function codigoActivo() {
  return prisma.inviteCode.findFirst({ where: { activo: true }, orderBy: { createdAt: 'desc' } });
}

async function esCodigoValido(codigo) {
  const c = String(codigo || '').trim();
  if (!c || c.length > 100) return false;
  const fila = await prisma.inviteCode.findUnique({ where: { code: c } });
  return !!fila?.activo;
}

// Desactiva el enlace anterior y crea uno nuevo.
async function regenerar(creadoPorId) {
  return prisma.$transaction(async (tx) => {
    await tx.inviteCode.updateMany({ where: { activo: true }, data: { activo: false } });
    return tx.inviteCode.create({ data: { code: tokenAleatorio(16), createdById: creadoPorId || null } });
  });
}

module.exports = { codigoActivo, esCodigoValido, regenerar, enlace };
