// Preferencias de avisos de orantes y líder. Todos reciben avisos de todos los jóvenes.
const express = require('express');
const prisma = require('../db');
const v = require('../validar');
const { requiereRol } = require('../middleware/auth');
const { prefsPorDefecto } = require('../services/usuarios');

const router = express.Router();
router.use(requiereRol('ORANTE', 'LIDER'));

const BOOLEANOS = ['pushAntes', 'pushDespues', 'emailAntes', 'emailDespues', 'tambienCorreo', 'diaAnterior'];
const ANTICIPACIONES = ['TREINTA_MIN', 'UNA_HORA', 'DOS_HORAS', 'TRES_HORAS'];
const HORAS_DIA_ANTERIOR = [17, 18, 19, 20, 21, 22];

async function leer(user) {
  const prefs = await prisma.notificationPrefs.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...prefsPorDefecto(user.rol) },
    update: {}
  });
  const pushActivas = await prisma.pushSubscription.count({ where: { userId: user.id, activa: true } });
  return {
    prefs: {
      ...Object.fromEntries(BOOLEANOS.map((k) => [k, prefs[k]])),
      // El valor antiguo "noche anterior" se muestra como 1 hora (el día anterior ahora es aparte).
      anticipacion: ANTICIPACIONES.includes(prefs.anticipacion) ? prefs.anticipacion : 'UNA_HORA',
      horaDiaAnterior: prefs.horaDiaAnterior
    },
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

// PUT /api/ajustes — { pushAntes, anticipacion, diaAnterior, horaDiaAnterior, pushDespues, ... }
router.put('/', async (req, res, next) => {
  try {
    const datos = {};
    for (const k of BOOLEANOS) if (k in req.body) datos[k] = req.body[k] === true;
    if ('anticipacion' in req.body) datos.anticipacion = v.opcion(req.body.anticipacion, ANTICIPACIONES, 'anticipación');
    if ('horaDiaAnterior' in req.body) datos.horaDiaAnterior = v.opcion(Number(req.body.horaDiaAnterior), HORAS_DIA_ANTERIOR, 'hora del día anterior');
    await leer(req.user); // asegura que exista la fila
    await prisma.notificationPrefs.update({ where: { userId: req.user.id }, data: datos });
    res.json(await leer(req.user));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
