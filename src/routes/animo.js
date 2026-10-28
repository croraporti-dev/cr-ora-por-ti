// POST /api/animo — { t, animo }. Público y sin sesión: el token firmado solo permite
// registrar el ánimo de UNA evaluación (lo usan los botones de la notificación "¿Cómo te fue?").
const express = require('express');
const { verificarEnlace } = require('../services/tokens');
const { registrarAnimo } = require('../services/evaluaciones');
const { limitarPorIp } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/', limitarPorIp('animo', 30, 60 * 60), async (req, res, next) => {
  try {
    const payload = verificarEnlace(req.body.t, 'animo');
    if (!payload?.e) return res.status(400).json({ error: 'Este enlace venció. Puedes responder desde la app.' });
    if (!(await registrarAnimo(payload.e, req.body.animo))) return res.status(404).json({ error: 'Esa evaluación ya no existe.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
