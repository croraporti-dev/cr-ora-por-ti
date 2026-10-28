// Motor de avisos. Lo ejecuta el cron cada ~10 minutos; cada ejecución envía lo que esté pendiente.
//
// Garantías:
// - NotificationLog tiene índice único (usuario, evaluación, tipo, canal): antes de enviar se "reclama"
//   la fila; si otra ejecución ya la tiene, no se envía. Así nunca sale dos veces el mismo aviso por el mismo canal.
// - Push primero. Si la persona no tiene push activo o el push falla, se envía correo en ese mismo ciclo.
// - Las ventanas son amplias (el aviso "antes" vale hasta la hora de la evaluación, el "después" durante 24 h),
//   así que un cron atrasado por GitHub no pierde avisos.
const prisma = require('../db');
const push = require('./push');
const { enviarCorreo } = require('./mailer');
const plantillas = require('./plantillas');
const { aLocal } = require('./tiempo');
const { nombreVisible } = require('./evaluaciones');
const { prefsPorDefecto } = require('./usuarios');
const { firmarEnlace } = require('./tokens');

const HORA = 60 * 60 * 1000;
const DESPUES_HORAS = 2; // el aviso "después" sale 2 h tras la evaluación
const VENTANA_DESPUES_HORAS = 24; // ...y se puede enviar durante las 24 h siguientes
const MAX_INTENTOS_CORREO = 5;
const ENVIANDO_VENCIDO_MS = 15 * 60 * 1000; // una ejecución que murió a mitad de un envío

// Momento en que corresponde el aviso "antes" según la anticipación elegida.
function momentoAntes(fechaHora, anticipacion) {
  if (anticipacion === 'TRES_HORAS') return new Date(fechaHora.getTime() - 3 * HORA);
  if (anticipacion === 'NOCHE_ANTERIOR_20H') {
    // 20:00 del día anterior en hora de Chile (Luxon respeta el cambio de horario).
    return aLocal(fechaHora).minus({ days: 1 }).set({ hour: 20, minute: 0, second: 0, millisecond: 0 }).toJSDate();
  }
  return new Date(fechaHora.getTime() - HORA);
}

function tocaAntes(ev, prefs, ahora) {
  return momentoAntes(ev.fechaHora, prefs.anticipacion) <= ahora && ahora < ev.fechaHora;
}

function tocaDespues(ev, ahora) {
  const desde = ev.fechaHora.getTime() + DESPUES_HORAS * HORA;
  return desde <= ahora.getTime() && ahora.getTime() < desde + VENTANA_DESPUES_HORAS * HORA;
}

function esDuplicado(err) {
  return err?.code === 'P2002';
}

function enviandoVencido(log, ahora) {
  return log.estado === 'ENVIANDO' && ahora - log.sentAt > ENVIANDO_VENCIDO_MS;
}

// Reclama el envío. Devuelve la fila si esta ejecución debe enviar, o null si no.
// `sentAt` guarda el momento del último intento.
async function reclamar(clave, ahora) {
  try {
    return await prisma.notificationLog.create({ data: { ...clave, sentAt: ahora } });
  } catch (err) {
    if (!esDuplicado(err)) throw err;
  }
  if (clave.canal !== 'EMAIL') return null; // el push fallido no se reintenta: pasa a correo
  const actual = await prisma.notificationLog.findUnique({ where: { userId_evaluationId_tipo_canal: clave } });
  const reintentable = actual && (actual.estado === 'FALLO' || enviandoVencido(actual, ahora)) && actual.intentos < MAX_INTENTOS_CORREO;
  if (!reintentable) return null;
  // Solo una ejecución gana el reintento (compara estado e intentos actuales).
  const r = await prisma.notificationLog.updateMany({
    where: { id: actual.id, estado: actual.estado, intentos: actual.intentos },
    data: { estado: 'ENVIANDO', intentos: { increment: 1 }, sentAt: ahora, error: null }
  });
  return r.count ? actual : null;
}

async function terminar(log, ok, error) {
  return prisma.notificationLog.update({
    where: { id: log.id },
    data: { estado: ok ? 'OK' : 'FALLO', error: ok ? null : String(error || 'error').slice(0, 200) }
  });
}

// Un aviso (antes/después) para un orante o la líder.
async function avisarOrante({ user, prefs, ev, tipo, ahora, stats }) {
  const nombre = nombreVisible(ev.user);
  const mensaje = tipo === 'ANTES' ? plantillas.avisoAntes(ev, nombre, ahora) : plantillas.avisoDespues(ev, nombre, ahora);
  const quierePush = tipo === 'ANTES' ? prefs.pushAntes : prefs.pushDespues;
  const quiereCorreo = (tipo === 'ANTES' ? prefs.emailAntes : prefs.emailDespues) || (quierePush && prefs.tambienCorreo);
  const base = { userId: user.id, evaluationId: ev.id, tipo };

  let pushLog = await prisma.notificationLog.findUnique({ where: { userId_evaluationId_tipo_canal: { ...base, canal: 'PUSH' } } });

  if (quierePush && !pushLog && push.disponible() && user.pushActivas > 0) {
    const log = await reclamar({ ...base, canal: 'PUSH' }, ahora);
    if (log) {
      const r = await push.enviarAUsuario(user.id, mensaje.push);
      pushLog = await terminar(log, r.ok, r.error);
      stats[r.ok ? 'push' : 'pushFallidos']++;
    }
  }

  const pushOk = pushLog?.estado === 'OK';
  const pushEnCurso = pushLog?.estado === 'ENVIANDO' && !enviandoVencido(pushLog, ahora);
  const respaldo = quierePush && !pushOk && !pushEnCurso;
  if (!user.email || !(quiereCorreo || respaldo)) return;

  const log = await reclamar({ ...base, canal: 'EMAIL' }, ahora);
  if (!log) return;
  // Si tenía push y falló (o venció), el correo trae el enlace para reactivarlo.
  const reactivar = quierePush && (pushLog?.estado === 'FALLO' || prefs.pushNecesitaReactivar);
  try {
    await enviarCorreo({ to: user.email, ...plantillas.correoAviso(mensaje, { reactivar }) });
    await terminar(log, true);
    stats.correos++;
  } catch (err) {
    await terminar(log, false, err.message);
    stats.correosFallidos++;
  }
}

// "¿Cómo te fue?" al joven: solo push (no tiene correo). Si no tiene push, lo ve en la app.
async function avisarJoven({ ev, ahora, stats }) {
  if (ev.resultadoAnimo || !push.disponible()) return;
  const activas = await prisma.pushSubscription.count({ where: { userId: ev.userId, activa: true } });
  if (!activas) return;
  const log = await reclamar({ userId: ev.userId, evaluationId: ev.id, tipo: 'DESPUES', canal: 'PUSH' }, ahora);
  if (!log) return;
  const token = firmarEnlace({ e: ev.id }, 'animo', 7 * 24 * 60 * 60);
  const r = await push.enviarAUsuario(ev.userId, plantillas.avisoJoven(ev, token));
  await terminar(log, r.ok, r.error);
  stats[r.ok ? 'push' : 'pushFallidos']++;
}

// Todos los orantes y líderes reciben avisos de todos los jóvenes, sin distinciones.
async function cargarOrantes() {
  const usuarios = await prisma.user.findMany({
    where: { rol: { in: ['ORANTE', 'LIDER'] } },
    include: { prefs: true, _count: { select: { pushSubs: { where: { activa: true } } } } }
  });
  return usuarios.map((u) => ({
    user: { id: u.id, email: u.email, pushActivas: u._count.pushSubs },
    prefs: u.prefs || { ...prefsPorDefecto(u.rol), tambienCorreo: false, pushNecesitaReactivar: false }
  }));
}

// Un ciclo completo. `ahora` se puede inyectar para pruebas.
async function enviarAvisosPendientes({ ahora = new Date() } = {}) {
  const stats = { evaluaciones: 0, push: 0, pushFallidos: 0, correos: 0, correosFallidos: 0 };

  await prisma.evaluation.updateMany({ where: { estado: 'PENDIENTE', fechaHora: { lte: ahora } }, data: { estado: 'REALIZADA' } });

  // La anticipación máxima es "la noche anterior a las 20:00" (hasta ~28 h antes).
  const evaluaciones = await prisma.evaluation.findMany({
    where: {
      fechaHora: {
        gte: new Date(ahora.getTime() - (DESPUES_HORAS + VENTANA_DESPUES_HORAS) * HORA),
        lte: new Date(ahora.getTime() + 30 * HORA)
      }
    },
    include: { user: { select: { id: true, nombre: true, apellido: true } } }
  });
  stats.evaluaciones = evaluaciones.length;
  if (!evaluaciones.length) return stats;

  const orantes = await cargarOrantes();

  for (const ev of evaluaciones) {
    const despues = tocaDespues(ev, ahora);
    for (const o of orantes) {
      if (o.user.id === ev.userId) continue;
      if (tocaAntes(ev, o.prefs, ahora) && (o.prefs.pushAntes || o.prefs.emailAntes)) {
        await avisarOrante({ ...o, ev, tipo: 'ANTES', ahora, stats });
      }
      if (despues && (o.prefs.pushDespues || o.prefs.emailDespues)) {
        await avisarOrante({ ...o, ev, tipo: 'DESPUES', ahora, stats });
      }
    }
    if (despues) await avisarJoven({ ev, ahora, stats });
  }
  return stats;
}

// ---------- Tareas diarias y semanales ----------

// Marca una tarea como hecha. Devuelve false si otra ejecución ya la hizo.
async function reclamarTarea(clave) {
  try {
    await prisma.setting.create({ data: { key: clave, value: new Date().toISOString() } });
    return true;
  } catch (err) {
    if (esDuplicado(err)) return false;
    throw err;
  }
}

// Una vez al día (desde las 08:00): revisa la salud del push de cada persona y limpia datos vencidos.
async function tareasDiarias({ ahora = new Date() } = {}) {
  const local = aLocal(ahora);
  if (local.hour < 8 || !(await reclamarTarea(`tareas-diarias:${local.toISODate()}`))) return null;

  // Quien alguna vez activó push y hoy no tiene ninguna suscripción sana verá el aviso de reactivación.
  const conPush = await prisma.user.findMany({
    where: { pushSubs: { some: {} } },
    select: { id: true, pushSubs: { select: { activa: true, fallosSeguidos: true } } }
  });
  let necesitanReactivar = 0;
  for (const u of conPush) {
    const sana = u.pushSubs.some((s) => s.activa && s.fallosSeguidos < 2);
    if (!sana) necesitanReactivar++;
    await prisma.notificationPrefs.updateMany({ where: { userId: u.id }, data: { pushNecesitaReactivar: !sana } });
  }

  await prisma.loginToken.deleteMany({ where: { expiresAt: { lt: new Date(ahora.getTime() - 24 * HORA) } } });
  await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: ahora } } });
  return { necesitanReactivar };
}

// Domingo desde las 20:00: resumen de la semana para la líder.
async function resumenSemanal({ ahora = new Date() } = {}) {
  const local = aLocal(ahora);
  if (local.weekday !== 7 || local.hour < 20) return null;
  const clave = `resumen-semanal:${local.toISODate()}`;
  if (!(await reclamarTarea(clave))) return null;

  try {
    const lunes = local.plus({ days: 1 }).startOf('day');
    const [proximas, oracionesSemana, necesitan, lideres] = await Promise.all([
      prisma.evaluation.findMany({
        where: { fechaHora: { gte: lunes.toJSDate(), lt: lunes.plus({ days: 7 }).toJSDate() } },
        orderBy: { fechaHora: 'asc' },
        include: { user: { select: { nombre: true, apellido: true } } }
      }),
      prisma.prayerLog.count({ where: { createdAt: { gte: local.minus({ days: 7 }).toJSDate() } } }),
      prisma.evaluation.findMany({
        where: { resultadoAnimo: 'NECESITA_ORACION', fechaHora: { gte: local.minus({ days: 7 }).toJSDate() } },
        include: { user: { select: { nombre: true, apellido: true } } }
      }),
      prisma.user.findMany({ where: { rol: 'LIDER', email: { not: null } }, select: { email: true } })
    ]);
    const correo = plantillas.correoResumenSemanal({
      proximas: proximas.map((e) => ({ ...e, nombre: nombreVisible(e.user) })),
      oracionesSemana,
      pidieronOracion: [...new Set(necesitan.map((e) => nombreVisible(e.user)))]
    });
    for (const l of lideres) await enviarCorreo({ to: l.email, ...correo });
    return { enviados: lideres.length };
  } catch (err) {
    // Libera la tarea para reintentar en el próximo ciclo.
    await prisma.setting.delete({ where: { key: clave } }).catch(() => {});
    throw err;
  }
}

module.exports = { momentoAntes, enviarAvisosPendientes, tareasDiarias, resumenSemanal };
