// Rutas públicas del joven (sin inicio de sesión). Solo permiten ver y modificar lo propio.
const express = require('express');
const prisma = require('../db');
const v = require('../validar');
const ev = require('../services/evaluaciones');
const { limitarPorIp } = require('../middleware/rateLimit');
const { cargarJoven, requiereJoven, recordarDispositivo, olvidarDispositivo } = require('../middleware/joven');
const { prefsPorDefecto } = require('../services/usuarios');

const router = express.Router();
router.use(cargarJoven);

const DIA_MS = 24 * 60 * 60 * 1000;

// GET /api/joven — quién es este dispositivo y sus evaluaciones
router.get('/', async (req, res, next) => {
  try {
    if (!req.joven) return res.json({ joven: null });
    const evaluaciones = await prisma.evaluation.findMany({
      where: { userId: req.joven.id, fechaHora: { gte: new Date(Date.now() - 14 * DIA_MS) } },
      orderBy: { fechaHora: 'asc' },
      include: { _count: { select: { oraciones: true } } }
    });
    res.json({
      joven: { nombre: req.joven.nombre, apellido: req.joven.apellido },
      evaluaciones: evaluaciones.map((e) => ({ ...ev.aJson(e), oraciones: e._count.oraciones }))
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/joven/perfil — { nombre, apellido, telefono }
router.post('/perfil', limitarPorIp('joven-perfil', 100, 60 * 60), async (req, res, next) => {
  try {
    const nombre = v.texto(req.body.nombre, { nombre: 'tu nombre', min: 2, max: 40 });
    const apellido = v.texto(req.body.apellido, { nombre: 'tu apellido', min: 2, max: 40 });
    const telefono = v.telefono(req.body.telefono);

    const ahora = new Date();
    const existente = await prisma.user.findUnique({ where: { telefono } });
    if (existente && existente.rol !== 'JOVEN') {
      throw new v.ErrorValidacion('Ese número ya está registrado en el grupo como orante. Usa otro número.');
    }
    // Mismo número = mismo joven (por ejemplo, si cambió de celular).
    const joven = existente
      ? await prisma.user.update({ where: { id: existente.id }, data: { nombre, apellido } })
      : await prisma.user.create({
          data: { nombre, apellido, telefono, rol: 'JOVEN', aprobadoAt: ahora, prefs: { create: prefsPorDefecto('JOVEN') } }
        });

    await olvidarDispositivo(req, res);
    await recordarDispositivo(res, joven.id);
    res.json({ ok: true, joven: { nombre: joven.nombre, apellido: joven.apellido } });
  } catch (err) {
    next(err);
  }
});

// POST /api/joven/olvidar — "No soy yo": este dispositivo deja de recordarlo
router.post('/olvidar', async (req, res, next) => {
  try {
    await olvidarDispositivo(req, res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const limiteEscritura = limitarPorIp('joven-evaluaciones', 400, 60 * 60);

router.post('/evaluaciones', limiteEscritura, requiereJoven, async (req, res, next) => {
  try {
    const nueva = await ev.crear(req.joven.id, req.body);
    res.status(201).json({ evaluacion: ev.aJson(nueva) });
  } catch (err) {
    next(err);
  }
});

router.put('/evaluaciones/:id', limiteEscritura, requiereJoven, async (req, res, next) => {
  try {
    const actualizada = await ev.actualizar(req.joven.id, req.params.id, req.body);
    if (!actualizada) return res.status(404).json({ error: 'No encontramos esa evaluación.' });
    res.json({ evaluacion: ev.aJson(actualizada) });
  } catch (err) {
    next(err);
  }
});

router.delete('/evaluaciones/:id', limiteEscritura, requiereJoven, async (req, res, next) => {
  try {
    if (!(await ev.borrar(req.joven.id, req.params.id))) return res.status(404).json({ error: 'No encontramos esa evaluación.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/joven/evaluaciones/:id/animo — { animo } "¿Cómo te fue?" respondido en la app
router.post('/evaluaciones/:id/animo', limiteEscritura, requiereJoven, async (req, res, next) => {
  try {
    if (!(await ev.registrarAnimo(req.params.id, req.body.animo, req.joven.id))) {
      return res.status(404).json({ error: 'No encontramos esa evaluación.' });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
