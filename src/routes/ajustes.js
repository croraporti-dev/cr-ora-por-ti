// Preferencias de avisos de orantes y líder. Todos reciben avisos de todos los jóvenes.
const express = require('express');
const prisma = require('../db');
const v = require('../validar');
const { requiereRol } = require('../middleware/auth');
const { prefsPorDefecto } = require('../services/usuarios');

const router = express.Router();
router.use(requiereRol('ORANTE', 'LIDER'));

const BOOLEANOS = ['pushAntes', 'pushDespues', 'emailAntes', 'emailDespues', 'tambienCorreo'];

async function leer(user) {
  const prefs = await prisma.notificationPrefs.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...prefsPorDefecto(user.rol) },
    update: {}
  });
  const pushActivas = await prisma.pushSubscription.count({ where: { userId: user.id, activa: true } });
  return {
    prefs: { ...Object.fromEntries(BOOLEANOS.map((k) => [k, prefs[k]])), anticipacion: prefs.anticipacion },
    push: { activas: pushActivas, necesitaReactivar: prefs.pushNecesitaReactivar }
  };
}

router.get('/', async (req, res, next) => {
  try {
    res.json(await leer(req.user));
  } catch (err) {
    next(err);
  }
});

// PUT /api/ajustes — { pushAntes, pushDespues, emailAntes, emailDespues, tambienCorreo, anticipacion }
router.put('/', async (req, res, next) => {
  try {
    const datos = {};
    for (const k of BOOLEANOS) if (k in req.body) datos[k] = req.body[k] === true;
    if ('anticipacion' in req.body) datos.anticipacion = v.opcion(req.body.anticipacion, ['UNA_HORA', 'TRES_HORAS', 'NOCHE_ANTERIOR_20H'], 'anticipación');
    await leer(req.user); // asegura que exista la fila
    await prisma.notificationPrefs.update({ where: { userId: req.user.id }, data: datos });
    res.json(await leer(req.user));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
