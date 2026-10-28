const express = require('express');
const prisma = require('../db');
const { requiereSesion } = require('../middleware/auth');
const { usuarioPublico } = require('../services/usuarios');

const router = express.Router();

// GET /api/yo — datos de la sesión actual, con el estado de sus avisos para mostrar el aviso de reactivación.
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return res.json({ user: null });
    const [prefs, pushActivas] = await Promise.all([
      prisma.notificationPrefs.findUnique({ where: { userId: req.user.id }, select: { pushNecesitaReactivar: true, pushAntes: true, pushDespues: true } }),
      prisma.pushSubscription.count({ where: { userId: req.user.id, activa: true } })
    ]);
    res.json({
      user: usuarioPublico(req.user),
      avisos: {
        quierePush: !!(prefs?.pushAntes || prefs?.pushDespues),
        pushActivas,
        necesitaReactivar: !!prefs?.pushNecesitaReactivar
      }
    });
  } catch (err) {
    next(err);
  }
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
