const express = require('express');
const prisma = require('../db');
const { requiereRol } = require('../middleware/auth');
const invitacion = require('../services/invitacion');
const v = require('../validar');

const router = express.Router();
router.use(requiereRol('LIDER'));

// GET /api/lider/invitacion — código vigente
router.get('/invitacion', async (req, res, next) => {
  try {
    const actual = (await invitacion.codigoActivo()) || (await invitacion.regenerar(req.user.id));
    res.json({ codigo: actual.code, creado: actual.createdAt });
  } catch (err) {
    next(err);
  }
});

// POST /api/lider/invitacion — crea un código nuevo y anula el anterior
router.post('/invitacion', async (req, res, next) => {
  try {
    const nuevo = await invitacion.regenerar(req.user.id);
    res.json({ codigo: nuevo.code, creado: nuevo.createdAt });
  } catch (err) {
    next(err);
  }
});

// GET /api/lider/miembros
router.get('/miembros', async (req, res, next) => {
  try {
    const miembros = await prisma.user.findMany({
      orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, apellido: true, email: true, telefono: true, rol: true, esMenor: true, createdAt: true }
    });
    res.json({ miembros });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/lider/evaluaciones/:id — la líder puede borrar cualquier evaluación (p. ej. una falsa)
router.delete('/evaluaciones/:id', async (req, res, next) => {
  try {
    const r = await prisma.evaluation.deleteMany({ where: { id: req.params.id } });
    if (!r.count) return res.status(404).json({ error: 'Esa evaluación ya no existe.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/lider/miembros/:id — { rol }
router.patch('/miembros/:id', async (req, res, next) => {
  try {
    const rol = v.opcion(req.body.rol, ['JOVEN', 'ORANTE', 'LIDER'], 'rol');
    const miembro = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!miembro) return res.status(404).json({ error: 'No encontramos a esa persona.' });
    if (miembro.rol === 'LIDER' && rol !== 'LIDER' && (await prisma.user.count({ where: { rol: 'LIDER' } })) <= 1) {
      return res.status(400).json({ error: 'Debe quedar al menos una líder en el grupo.' });
    }
    const actualizado = await prisma.user.update({ where: { id: miembro.id }, data: { rol } });
    res.json({ ok: true, rol: actualizado.rol });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/lider/miembros/:id — quita al usuario y todos sus datos
router.delete('/miembros/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'No puedes quitarte a ti misma del grupo.' });
    const borrados = await prisma.user.deleteMany({ where: { id: req.params.id } });
    if (!borrados.count) return res.status(404).json({ error: 'No encontramos a esa persona.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
