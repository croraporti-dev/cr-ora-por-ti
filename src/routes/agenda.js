// Agenda de oración: solo para orantes y líder (con sesión).
const express = require('express');
const prisma = require('../db');
const ev = require('../services/evaluaciones');
const { requiereRol } = require('../middleware/auth');
const { ahoraLocal } = require('../services/tiempo');

const router = express.Router();
router.use(requiereRol('ORANTE', 'LIDER'));

async function idsSeguidos(userId) {
  const prefs = await prisma.notificationPrefs.findUnique({
    where: { userId },
    select: { jovenesSeguidos: { select: { id: true } } }
  });
  return (prefs?.jovenesSeguidos || []).map((j) => j.id);
}

// GET /api/agenda?seguidos=1 — desde hace 2 días en adelante (las pasadas muestran el ánimo).
router.get('/', async (req, res, next) => {
  try {
    const desde = ahoraLocal().startOf('day').minus({ days: 2 }).toJSDate();
    const seguidos = await idsSeguidos(req.user.id);
    const soloSeguidos = req.query.seguidos === '1';

    const evaluaciones = await prisma.evaluation.findMany({
      where: { fechaHora: { gte: desde }, ...(soloSeguidos ? { userId: { in: seguidos } } : {}) },
      orderBy: { fechaHora: 'asc' },
      include: {
        user: { select: { id: true, nombre: true, apellido: true } },
        _count: { select: { oraciones: true } },
        oraciones: { where: { userId: req.user.id }, select: { id: true } }
      }
    });

    res.json({
      evaluaciones: evaluaciones.map((e) => ({
        ...ev.aJson(e),
        joven: { id: e.user.id, nombre: ev.nombreVisible(e.user) },
        oraciones: e._count.oraciones,
        yoOre: e.oraciones.length > 0,
        sigo: seguidos.includes(e.user.id)
      }))
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/agenda/:id/ore — "Ya oré" (repetirlo no suma dos veces)
router.post('/:id/ore', async (req, res, next) => {
  try {
    const existe = await prisma.evaluation.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existe) return res.status(404).json({ error: 'Esa evaluación ya no existe.' });
    await prisma.prayerLog.upsert({
      where: { evaluationId_userId: { evaluationId: existe.id, userId: req.user.id } },
      create: { evaluationId: existe.id, userId: req.user.id },
      update: {}
    });
    const oraciones = await prisma.prayerLog.count({ where: { evaluationId: existe.id } });
    res.json({ ok: true, oraciones, yoOre: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/agenda/:id/ore — deshacer
router.delete('/:id/ore', async (req, res, next) => {
  try {
    await prisma.prayerLog.deleteMany({ where: { evaluationId: req.params.id, userId: req.user.id } });
    const oraciones = await prisma.prayerLog.count({ where: { evaluationId: req.params.id } });
    res.json({ ok: true, oraciones, yoOre: false });
  } catch (err) {
    next(err);
  }
});

// POST/DELETE /api/agenda/seguir/:jovenId — seguir o dejar de seguir a un joven
async function cambiarSeguimiento(req, res, next, seguir) {
  try {
    const joven = await prisma.user.findFirst({ where: { id: req.params.jovenId, rol: 'JOVEN' }, select: { id: true } });
    if (!joven) return res.status(404).json({ error: 'No encontramos a ese joven.' });
    // "disconnect" no es válido al crear, así que solo se crea la fila al seguir.
    await prisma.notificationPrefs.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, ...(seguir ? { jovenesSeguidos: { connect: { id: joven.id } } } : {}) },
      update: { jovenesSeguidos: seguir ? { connect: { id: joven.id } } : { disconnect: { id: joven.id } } }
    });
    res.json({ ok: true, sigo: seguir });
  } catch (err) {
    next(err);
  }
}
router.post('/seguir/:jovenId', (req, res, next) => cambiarSeguimiento(req, res, next, true));
router.delete('/seguir/:jovenId', (req, res, next) => cambiarSeguimiento(req, res, next, false));

module.exports = router;
