const express = require('express');
const prisma = require('../db');
const { requiereSesion } = require('../middleware/auth');
const { usuarioPublico } = require('../services/usuarios');

const router = express.Router();

// GET /api/yo — datos de la sesión actual.
router.get('/', (req, res) => {
  res.json({ user: req.user ? usuarioPublico(req.user) : null });
});

// POST /api/yo/salir-de-todos — invalida las sesiones en todos los dispositivos.
router.post('/salir-de-todos', requiereSesion, async (req, res, next) => {
  try {
    await prisma.user.update({ where: { id: req.user.id }, data: { sessionVersion: { increment: 1 } } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
