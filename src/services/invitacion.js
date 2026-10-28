const crypto = require('crypto');
const prisma = require('../db');

// Sin letras confusas (0/O, 1/I/L) para dictarlo fácil por WhatsApp.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generarCodigo() {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALFABETO[crypto.randomInt(ALFABETO.length)];
  return `CR-${s}`;
}

function normalizar(codigo) {
  return String(codigo || '').trim().toUpperCase().replace(/\s+/g, '');
}

async function codigoActivo() {
  return prisma.inviteCode.findFirst({ where: { activo: true }, orderBy: { createdAt: 'desc' } });
}

async function esCodigoValido(codigo) {
  const c = normalizar(codigo);
  const conGuion = c.startsWith('CR-') ? c : `CR-${c.replace(/^CR/, '')}`;
  const fila = await prisma.inviteCode.findUnique({ where: { code: conGuion } });
  return !!fila?.activo;
}

// Desactiva el código anterior y crea uno nuevo.
async function regenerar(creadoPorId) {
  return prisma.$transaction(async (tx) => {
    await tx.inviteCode.updateMany({ where: { activo: true }, data: { activo: false } });
    return tx.inviteCode.create({ data: { code: generarCodigo(), createdById: creadoPorId || null } });
  });
}

module.exports = { codigoActivo, esCodigoValido, regenerar, normalizar };
