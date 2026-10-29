const prisma = require('../db');
const v = require('../validar');
const { desdeLocal } = require('./tiempo');

const TIPOS = ['PRUEBA', 'EXAMEN', 'TRABAJO', 'OTRO'];
const ANIMOS = ['BIEN', 'MAS_O_MENOS', 'NECESITA_ORACION'];
const DIA_MS = 24 * 60 * 60 * 1000;

// Valida { tipo, ramo, fecha, hora } (fecha y hora en hora de Chile).
function leerDatos(body) {
  const tipo = v.opcion(body.tipo, TIPOS, 'tipo');
  const ramo = v.texto(body.ramo, { nombre: 'la asignatura o ramo', min: 2, max: 60 });
  // Con "Otro" se puede escribir de qué se trata (opcional), por ejemplo "Disertación".
  const otro = tipo === 'OTRO' ? String(body.tipoOtro ?? '').trim().replace(/\s+/g, ' ') : '';
  if (otro.length > 40) throw new v.ErrorValidacion('El tipo de evaluación es demasiado largo (máximo 40 caracteres).');
  const tipoOtro = otro || null;
  const fechaHora = desdeLocal(body.fecha, body.hora);
  if (!fechaHora) throw new v.ErrorValidacion('Revisa la fecha y la hora.');
  const diff = fechaHora.getTime() - Date.now();
  if (diff < -DIA_MS) throw new v.ErrorValidacion('Esa fecha ya pasó.');
  if (diff > 366 * DIA_MS) throw new v.ErrorValidacion('La fecha está muy lejos; anótala más adelante.');
  return { tipo, tipoOtro, ramo, fechaHora };
}

async function crear(userId, body) {
  return prisma.evaluation.create({ data: { userId, ...leerDatos(body) } });
}

// Actualiza solo si la evaluación es del usuario. Devuelve null si no existe o no es suya.
async function actualizar(userId, id, body) {
  const actual = await prisma.evaluation.findFirst({ where: { id, userId } });
  if (!actual) return null;
  const datos = leerDatos(body);
  const cambioFecha = datos.fechaHora.getTime() !== actual.fechaHora.getTime();
  return prisma.$transaction(async (tx) => {
    if (cambioFecha) {
      // Nueva hora → los avisos deben volver a salir según la nueva fecha.
      await tx.notificationLog.deleteMany({ where: { evaluationId: id } });
      Object.assign(datos, { estado: 'PENDIENTE', resultadoAnimo: null });
    }
    return tx.evaluation.update({ where: { id }, data: datos });
  });
}

async function borrar(userId, id) {
  const r = await prisma.evaluation.deleteMany({ where: { id, userId } });
  return r.count > 0;
}

async function registrarAnimo(evaluationId, animo, userId) {
  v.opcion(animo, ANIMOS, 'ánimo');
  const where = { id: evaluationId, fechaHora: { lte: new Date() } };
  if (userId) where.userId = userId;
  const r = await prisma.evaluation.updateMany({ where, data: { resultadoAnimo: animo, estado: 'REALIZADA' } });
  return r.count > 0;
}

// Nombre completo ("Camila Pérez"): sin abreviar, para que el grupo sepa bien quién es.
function nombreVisible(user) {
  return [user.nombre, user.apellido].filter(Boolean).join(' ');
}

function aJson(e) {
  return {
    id: e.id,
    tipo: e.tipo,
    tipoOtro: e.tipoOtro,
    ramo: e.ramo,
    fechaHora: e.fechaHora.toISOString(),
    estado: e.estado,
    resultadoAnimo: e.resultadoAnimo
  };
}

module.exports = { TIPOS, ANIMOS, leerDatos, crear, actualizar, borrar, registrarAnimo, nombreVisible, aJson };
