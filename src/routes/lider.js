// Panel del grupo (rol líder): resumen de la semana, enlace de invitación, solicitudes y miembros.
const express = require('express');
const prisma = require('../db');
const { requiereRol } = require('../middleware/auth');
const invitacion = require('../services/invitacion');
const { avisarAprobacion } = require('../services/solicitudes');
const { crearEnlaceAcceso } = require('../services/claves');
const { nombreVisible } = require('../services/evaluaciones');
const { ahoraLocal } = require('../services/tiempo');
const v = require('../validar');

const router = express.Router();
router.use(requiereRol('LIDER'));

// GET /api/lider/resumen — la semana actual (lunes a domingo, hora de Chile)
router.get('/resumen', async (req, res, next) => {
  try {
    const ahora = ahoraLocal();
    const inicio = ahora.startOf('week'); // lunes 00:00
    const fin = inicio.plus({ weeks: 1 });
    const enLaSemana = { gte: inicio.toJSDate(), lt: fin.toJSDate() };

    const [evaluaciones, oraciones, pidieron, avisos, orantes] = await Promise.all([
      prisma.evaluation.findMany({ where: { fechaHora: enLaSemana }, select: { userId: true, fechaHora: true } }),
      prisma.prayerLog.count({ where: { createdAt: enLaSemana } }),
      prisma.evaluation.findMany({
        where: { resultadoAnimo: 'NECESITA_ORACION', fechaHora: { gte: ahora.minus({ days: 7 }).toJSDate() } },
        include: { user: { select: { nombre: true, apellido: true } } },
        orderBy: { fechaHora: 'desc' }
      }),
      prisma.notificationLog.groupBy({ by: ['canal'], where: { estado: 'OK', sentAt: enLaSemana }, _count: true }),
      prisma.user.findMany({
        where: { rol: { in: ['ORANTE', 'LIDER'] }, aprobadoAt: { not: null } },
        select: { _count: { select: { pushSubs: { where: { activa: true } } } } }
      })
    ]);

    const porCanal = Object.fromEntries(avisos.map((a) => [a.canal, a._count]));
    res.json({
      semana: { desde: inicio.toFormat('dd/MM/yyyy'), hasta: fin.minus({ days: 1 }).toFormat('dd/MM/yyyy') },
      evaluaciones: evaluaciones.length,
      evaluacionesPendientes: evaluaciones.filter((e) => e.fechaHora > new Date()).length,
      jovenes: new Set(evaluaciones.map((e) => e.userId)).size,
      oraciones,
      pidieronOracion: [...new Set(pidieron.map((e) => nombreVisible(e.user)))],
      avisosPush: porCanal.PUSH || 0,
      avisosCorreo: porCanal.EMAIL || 0,
      orantes: orantes.length,
      orantesConPush: orantes.filter((o) => o._count.pushSubs > 0).length
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/lider/invitacion — enlace vigente
router.get('/invitacion', async (req, res, next) => {
  try {
    const actual = (await invitacion.codigoActivo()) || (await invitacion.regenerar(req.user.id));
    res.json({ enlace: invitacion.enlace(actual.code), creado: actual.createdAt });
  } catch (err) {
    next(err);
  }
});

// POST /api/lider/invitacion — crea un enlace nuevo y anula el anterior
router.post('/invitacion', async (req, res, next) => {
  try {
    const nuevo = await invitacion.regenerar(req.user.id);
    res.json({ enlace: invitacion.enlace(nuevo.code), creado: nuevo.createdAt });
  } catch (err) {
    next(err);
  }
});

// GET /api/lider/miembros — con cuántas evaluaciones tiene cada joven y si cada orante tiene avisos activos
router.get('/miembros', async (req, res, next) => {
  try {
    const miembros = await prisma.user.findMany({
      orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true, nombre: true, apellido: true, email: true, telefono: true, rol: true, createdAt: true, aprobadoAt: true, passwordHash: true,
        _count: { select: { evaluaciones: true, pushSubs: { where: { activa: true } } } }
      }
    });
    res.json({
      yo: req.user.id,
      miembros: miembros.map(({ _count, aprobadoAt, passwordHash, ...m }) => ({
        ...m,
        pendiente: !aprobadoAt,
        // Solo se informa si tiene contraseña; el hash nunca sale del servidor.
        tieneClave: !!passwordHash,
        evaluaciones: _count.evaluaciones,
        avisosActivos: _count.pushSubs > 0
      }))
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/lider/miembros/:id/acceso — enlace de un solo uso (24 h) para que cree o cambie su contraseña
router.post('/miembros/:id/acceso', async (req, res, next) => {
  try {
    const persona = await prisma.user.findFirst({ where: { id: req.params.id, rol: { in: ['ORANTE', 'LIDER'] } } });
    if (!persona) return res.status(404).json({ error: 'No encontramos a esa persona.' });
    res.json({ enlace: await crearEnlaceAcceso(persona.id, 24), nombre: persona.nombre });
  } catch (err) {
    next(err);
  }
});

// POST /api/lider/miembros/:id/aprobar — acepta una solicitud para sumarse a orar
router.post('/miembros/:id/aprobar', async (req, res, next) => {
  try {
    const r = await prisma.user.updateMany({ where: { id: req.params.id, aprobadoAt: null }, data: { aprobadoAt: new Date() } });
    if (!r.count) return res.status(404).json({ error: 'Esa solicitud ya no está pendiente.' });
    const persona = await prisma.user.findUnique({ where: { id: req.params.id } });
    avisarAprobacion(persona).catch((err) => console.error('[aprobación]', err.message));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/lider/evaluaciones/:id — quien tiene rol líder puede borrar cualquier evaluación (p. ej. una falsa)
router.delete('/evaluaciones/:id', async (req, res, next) => {
  try {
    const r = await prisma.evaluation.deleteMany({ where: { id: req.params.id } });
    if (!r.count) return res.status(404).json({ error: 'Esa evaluación ya no existe.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/lider/miembros/:id — { rol: ORANTE | LIDER }. Los jóvenes se registran solos y no tienen correo,
// así que no se convierten en orantes (ni al revés).
router.patch('/miembros/:id', async (req, res, next) => {
  try {
    const rol = v.opcion(req.body.rol, ['ORANTE', 'LIDER'], 'rol');
    const miembro = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!miembro) return res.status(404).json({ error: 'No encontramos a esa persona.' });
    if (miembro.rol === 'JOVEN') return res.status(400).json({ error: 'Los jóvenes no cambian de rol: para orar, deben sumarse con su correo.' });
    if (miembro.rol === 'LIDER' && rol !== 'LIDER' && (await prisma.user.count({ where: { rol: 'LIDER' } })) <= 1) {
      return res.status(400).json({ error: 'Debe quedar al menos una persona con rol de líder.' });
    }
    const actualizado = await prisma.user.update({ where: { id: miembro.id }, data: { rol } });
    res.json({ ok: true, rol: actualizado.rol });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/lider/miembros/:id — quita al usuario y todos sus datos (evaluaciones, oraciones, avisos)
router.delete('/miembros/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'No puedes quitar tu propia cuenta.' });
    const borrados = await prisma.user.deleteMany({ where: { id: req.params.id } });
    if (!borrados.count) return res.status(404).json({ error: 'No encontramos a esa persona.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
