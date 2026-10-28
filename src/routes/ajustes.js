// Preferencias de avisos de orantes y líder.
const express = require('express');
const prisma = require('../db');
const v = require('../validar');
const { requiereRol } = require('../middleware/auth');
const { prefsPorDefecto } = require('../services/usuarios');
const { nombreVisible } = require('../services/evaluaciones');

const router = express.Router();
router.use(requiereRol('ORANTE', 'LIDER'));

const BOOLEANOS = ['pushAntes', 'pushDespues', 'emailAntes', 'emailDespues', 'tambienCorreo'];

async function leer(user) {
  const prefs = await prisma.notificationPrefs.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...prefsPorDefecto(user.rol) },
    update: {},
    include: { jovenesSeguidos: { select: { id: true } } }
  });
  const [jovenes, pushActivas] = await Promise.all([
    prisma.user.findMany({ where: { rol: 'JOVEN' }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true, apellido: true } }),
    prisma.pushSubscription.count({ where: { userId: user.id, activa: true } })
  ]);
  return {
    prefs: {
      ...Object.fromEntries(BOOLEANOS.map((k) => [k, prefs[k]])),
      anticipacion: prefs.anticipacion,
      seguir: prefs.seguir,
      jovenesSeguidos: prefs.jovenesSeguidos.map((j) => j.id)
    },
    jovenes: jovenes.map((j) => ({ id: j.id, nombre: nombreVisible(j) })),
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

// PUT /api/ajustes — { pushAntes, ..., anticipacion, seguir, jovenesSeguidos: [ids] }
router.put('/', async (req, res, next) => {
  try {
    const datos = {};
    for (const k of BOOLEANOS) if (k in req.body) datos[k] = req.body[k] === true;
    if ('anticipacion' in req.body) datos.anticipacion = v.opcion(req.body.anticipacion, ['UNA_HORA', 'TRES_HORAS', 'NOCHE_ANTERIOR_20H'], 'anticipación');
    if ('seguir' in req.body) datos.seguir = v.opcion(req.body.seguir, ['TODOS', 'LISTA'], 'a quién seguir');
    if (Array.isArray(req.body.jovenesSeguidos)) {
      const ids = req.body.jovenesSeguidos.filter((x) => typeof x === 'string').slice(0, 200);
      const validos = await prisma.user.findMany({ where: { id: { in: ids }, rol: 'JOVEN' }, select: { id: true } });
      datos.jovenesSeguidos = { set: validos };
    }
    await leer(req.user); // asegura que exista la fila
    await prisma.notificationPrefs.update({ where: { userId: req.user.id }, data: datos });
    res.json(await leer(req.user));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
