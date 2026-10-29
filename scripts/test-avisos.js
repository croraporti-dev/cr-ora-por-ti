// npm run test:avisos — simula evaluaciones próximas y verifica que:
//  • cada aviso sale UNA sola vez por canal, aunque el cron corra varias veces o en paralelo;
//  • si el push falla (410 u otro error), sale el correo de respaldo en el mismo ciclo;
//  • todos reciben avisos de todos; "también por correo" y las anticipaciones (incluido el cambio de horario) funcionan.
// No envía nada real: push y correo se reemplazan por transportes falsos.
// Usa una base de pruebas que se BORRA en cada ejecución (por defecto la local de `npm run db:local`).
const { execSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const URL_TEST = process.env.DATABASE_URL_TEST || 'postgresql://postgres:local@localhost:54329/cr_ora_test';
if (!/test/i.test(URL_TEST)) {
  console.error('DATABASE_URL_TEST debe apuntar a una base de PRUEBAS (su nombre debe contener "test"): se borra completa.');
  process.exit(1);
}
Object.assign(process.env, {
  DATABASE_URL: URL_TEST,
  DIRECT_URL: URL_TEST,
  MAIL_PROVIDER: 'consola',
  APP_URL: 'https://cr-ora.test',
  VAPID_PUBLIC_KEY: '',
  VAPID_PRIVATE_KEY: ''
});
execSync('npx prisma migrate deploy', { stdio: 'ignore', env: process.env });

const { DateTime } = require('luxon');
const prisma = require('../src/db');
const mailer = require('../src/services/mailer');
const push = require('../src/services/push');
const avisos = require('../src/services/avisos');
const evaluaciones = require('../src/services/evaluaciones');
const { prefsPorDefecto } = require('../src/services/usuarios');

const HORA = 3600 * 1000;
const correos = [];
const pushes = [];
const comportamientoPush = new Map(); // endpoint → 'ok' | código de error
let correoFallaVeces = 0;

mailer.usarTransporte(async (m) => {
  if (correoFallaVeces > 0) {
    correoFallaVeces--;
    throw new Error('proveedor caído');
  }
  correos.push(m);
});
push.usarTransporte(async (sub, payload) => {
  const c = comportamientoPush.get(sub.endpoint) || 'ok';
  if (c !== 'ok') throw Object.assign(new Error('push'), { statusCode: c });
  pushes.push({ endpoint: sub.endpoint, payload });
});

async function limpiar() {
  correos.length = 0;
  pushes.length = 0;
  comportamientoPush.clear();
  correoFallaVeces = 0;
  await prisma.$executeRawUnsafe(
    'TRUNCATE "NotificationLog","PrayerLog","PushSubscription","Evaluation","DeviceToken","NotificationPrefs","Setting","User" CASCADE'
  );
}

let n = 0;
async function orante({ rol = 'ORANTE', push: conPush = null, pendiente = false, ...prefs } = {}) {
  n++;
  const u = await prisma.user.create({
    data: {
      email: `persona${n}@prueba.cl`, nombre: `Persona${n}`, rol,
      aprobadoAt: pendiente ? null : new Date(),
      prefs: { create: { ...prefsPorDefecto(rol), ...prefs } }
    }
  });
  if (conPush) {
    const endpoint = `https://push.test/${u.id}`;
    await prisma.pushSubscription.create({ data: { userId: u.id, endpoint, p256dh: 'x', auth: 'y' } });
    comportamientoPush.set(endpoint, conPush);
  }
  return u;
}

async function joven(nombre = 'Camila', conPush = null) {
  n++;
  const u = await prisma.user.create({ data: { nombre, apellido: 'Pérez', telefono: `+5691000${String(n).padStart(4, '0')}`, rol: 'JOVEN' } });
  if (conPush) {
    const endpoint = `https://push.test/${u.id}`;
    await prisma.pushSubscription.create({ data: { userId: u.id, endpoint, p256dh: 'x', auth: 'y' } });
    comportamientoPush.set(endpoint, conPush);
  }
  return u;
}

const evaluacion = (j, fechaHora, extra = {}) =>
  prisma.evaluation.create({ data: { userId: j.id, tipo: 'PRUEBA', ramo: 'Matemáticas', fechaHora, ...extra } });

const correosPara = (u) => correos.filter((c) => c.to === u.email);
const pushesPara = (u) => pushes.filter((p) => p.endpoint === `https://push.test/${u.id}`);

test.beforeEach(limpiar);
test.after(() => prisma.$disconnect());

test('push a quien tiene suscripción, correo a quien no; una sola vez aunque el cron corra 3 veces', async () => {
  const lider = await orante({ rol: 'LIDER', push: 'ok' });
  const sinPush = await orante();
  const j = await joven();
  const fecha = new Date(Date.now() + 50 * 60 * 1000); // en 50 min (aviso de 1 h ya corresponde)
  await evaluacion(j, fecha);

  for (let i = 0; i < 3; i++) await avisos.enviarAvisosPendientes({ ahora: new Date() });

  assert.equal(pushesPara(lider).length, 1, 'la líder recibe 1 push');
  assert.equal(correosPara(lider).length, 0, 'la líder no recibe correo');
  assert.equal(correosPara(sinPush).length, 1, 'quien no tiene push recibe 1 correo');
  assert.match(pushesPara(lider)[0].payload.body, /Camila Pérez tiene prueba de Matemáticas\. Es un buen momento para orar por Camila Pérez.$/);
  assert.match(pushesPara(lider)[0].payload.url, /#\/agenda\?ev=/);
  assert.match(correosPara(sinPush)[0].subject, /^CR ora por ti: (hoy|mañana) Camila Pérez tiene prueba de Matemáticas$/);
});

test('ejecuciones en paralelo tampoco duplican', async () => {
  const lider = await orante({ rol: 'LIDER', push: 'ok' });
  const otro = await orante();
  await evaluacion(await joven(), new Date(Date.now() + 30 * 60 * 1000));

  await Promise.all([1, 2, 3, 4].map(() => avisos.enviarAvisosPendientes({ ahora: new Date() })));

  assert.equal(pushesPara(lider).length, 1);
  assert.equal(correosPara(otro).length, 1);
});

test('push vencido (410): se desactiva, sale el correo con enlace para reactivar, y no se repite', async () => {
  const lider = await orante({ rol: 'LIDER', push: 410 });
  await evaluacion(await joven(), new Date(Date.now() + 40 * 60 * 1000));

  await avisos.enviarAvisosPendientes({ ahora: new Date() });
  await avisos.enviarAvisosPendientes({ ahora: new Date() });

  assert.equal(pushesPara(lider).length, 0);
  assert.equal(correosPara(lider).length, 1, 'correo de respaldo en el mismo ciclo');
  assert.match(correosPara(lider)[0].text, /ajustes\?reactivar=1/);
  const sub = await prisma.pushSubscription.findFirst({ where: { userId: lider.id } });
  assert.equal(sub.activa, false, 'suscripción marcada inactiva');
  const prefs = await prisma.notificationPrefs.findUnique({ where: { userId: lider.id } });
  assert.equal(prefs.pushNecesitaReactivar, true, 'verá el aviso de reactivación');
  const logs = await prisma.notificationLog.findMany({ where: { userId: lider.id } });
  assert.deepEqual(logs.map((l) => `${l.canal}:${l.estado}`).sort(), ['EMAIL:OK', 'PUSH:FALLO']);
});

test('push con error temporal (500): también cae a correo', async () => {
  const lider = await orante({ rol: 'LIDER', push: 500 });
  await evaluacion(await joven(), new Date(Date.now() + 40 * 60 * 1000));
  await avisos.enviarAvisosPendientes({ ahora: new Date() });
  assert.equal(correosPara(lider).length, 1);
  const sub = await prisma.pushSubscription.findFirst({ where: { userId: lider.id } });
  assert.equal(sub.activa, true, 'un 500 no anula la suscripción');
  assert.equal(sub.fallosSeguidos, 1);
});

test('"también por correo" envía ambos', async () => {
  const o = await orante({ push: 'ok', tambienCorreo: true });
  await evaluacion(await joven(), new Date(Date.now() + 40 * 60 * 1000));
  await avisos.enviarAvisosPendientes({ ahora: new Date() });
  await avisos.enviarAvisosPendientes({ ahora: new Date() });
  assert.equal(pushesPara(o).length, 1);
  assert.equal(correosPara(o).length, 1);
});

test('si el proveedor de correo falla, se reintenta en el siguiente ciclo y sale una sola vez', async () => {
  const o = await orante();
  await evaluacion(await joven(), new Date(Date.now() + 40 * 60 * 1000));
  correoFallaVeces = 1;
  await avisos.enviarAvisosPendientes({ ahora: new Date() });
  assert.equal(correosPara(o).length, 0);
  await avisos.enviarAvisosPendientes({ ahora: new Date() });
  await avisos.enviarAvisosPendientes({ ahora: new Date() });
  assert.equal(correosPara(o).length, 1);
});

test('sin distinciones: cada orante recibe el aviso de cada joven', async () => {
  const camila = await joven('Camila');
  const diego = await joven('Diego');
  const o1 = await orante({ push: 'ok' });
  const o2 = await orante({ push: 'ok' });
  const fecha = new Date(Date.now() + 40 * 60 * 1000);
  await evaluacion(camila, fecha);
  await evaluacion(diego, fecha);
  await avisos.enviarAvisosPendientes({ ahora: new Date() });
  for (const o of [o1, o2]) {
    // Coinciden en el mismo ciclo: una sola notificación con los dos nombres.
    assert.equal(pushesPara(o).length, 1);
    const { title, body, url } = pushesPara(o)[0].payload;
    assert.match(title, /^Ora por (Camila Pérez y Diego Pérez|Diego Pérez y Camila Pérez)$/);
    assert.match(body, /Camila Pérez tiene prueba de Matemáticas/);
    assert.match(body, /Diego Pérez tiene prueba de Matemáticas/);
    assert.equal(url, '/#/agenda');
  }
  // Y no se repite en el siguiente ciclo.
  await avisos.enviarAvisosPendientes({ ahora: new Date() });
  assert.equal(pushesPara(o1).length, 1);
});

test('3 o más evaluaciones juntas: una notificación de resumen, sin nombres', async () => {
  const o = await orante({ push: 'ok' });
  const fecha = new Date(Date.now() + 40 * 60 * 1000);
  for (const nombre of ['Ana', 'Beto', 'Cata']) await evaluacion(await joven(nombre), fecha);
  await avisos.enviarAvisosPendientes({ ahora: new Date() });
  assert.equal(pushesPara(o).length, 1);
  const { title, body } = pushesPara(o)[0].payload;
  assert.equal(title, 'Ora por 3 personas');
  assert.match(body, /^3 personas tienen una evaluación pronto\. Entra a la agenda/);
  const logs = await prisma.notificationLog.count({ where: { userId: o.id, canal: 'PUSH', estado: 'OK' } });
  assert.equal(logs, 3, 'cada evaluación queda registrada como avisada');
});

test('agrupado: si el push falla, sale un correo de respaldo por cada evaluación', async () => {
  const o = await orante({ push: 410 });
  const fecha = new Date(Date.now() + 40 * 60 * 1000);
  await evaluacion(await joven('Ana'), fecha);
  await evaluacion(await joven('Beto'), fecha);
  await avisos.enviarAvisosPendientes({ ahora: new Date() });
  assert.equal(correosPara(o).length, 2);
});

test('"después" de dos personas: una notificación con los dos nombres', async () => {
  const o = await orante({ push: 'ok' });
  const fecha = new Date(Date.now() - 3 * HORA);
  await evaluacion(await joven('Ana'), fecha);
  await evaluacion(await joven('Beto'), fecha);
  await avisos.enviarAvisosPendientes({ ahora: new Date() });
  assert.equal(pushesPara(o).length, 1);
  assert.match(pushesPara(o)[0].payload.title, /^¿Cómo les fue a (Ana Pérez y Beto Pérez|Beto Pérez y Ana Pérez)\?$/);
});

test('quien espera aprobación no recibe avisos', async () => {
  const aprobado = await orante({ push: 'ok' });
  const pendiente = await orante({ push: 'ok', pendiente: true });
  await evaluacion(await joven(), new Date(Date.now() + 40 * 60 * 1000));
  await avisos.enviarAvisosPendientes({ ahora: new Date() });
  assert.equal(pushesPara(aprobado).length, 1);
  assert.equal(pushesPara(pendiente).length, 0);
  assert.equal(correosPara(pendiente).length, 0);
});

test('respeta la anticipación: 3 horas no avisa a las 3 h 10 min, sí a las 2 h 50 min', async () => {
  const o = await orante({ push: 'ok', anticipacion: 'TRES_HORAS' });
  const fecha = new Date(Date.now() + 5 * HORA);
  await evaluacion(await joven(), fecha);
  await avisos.enviarAvisosPendientes({ ahora: new Date(fecha - 3 * HORA - 10 * 60000) });
  assert.equal(pushesPara(o).length, 0);
  await avisos.enviarAvisosPendientes({ ahora: new Date(fecha - 2 * HORA - 50 * 60000) });
  assert.equal(pushesPara(o).length, 1);
});

test('cron atrasado: si GitHub se demora, el aviso igual sale antes de la evaluación', async () => {
  const o = await orante({ push: 'ok' });
  const fecha = new Date(Date.now() + 5 * HORA);
  await evaluacion(await joven(), fecha);
  await avisos.enviarAvisosPendientes({ ahora: new Date(fecha - 5 * 60000) }); // 55 min "tarde"
  assert.equal(pushesPara(o).length, 1);
  await avisos.enviarAvisosPendientes({ ahora: new Date(fecha.getTime() + 60000) }); // ya empezó
  assert.equal(pushesPara(o).length, 1, 'no se envía después de la hora');
});

test('"noche anterior 20:00" en hora de Chile, incluso con cambio de horario', () => {
  const zona = 'America/Santiago';
  const casos = [
    // Fin del horario de verano: la noche del sábado 3 de abril de 2027 los relojes vuelven de 24:00 a 23:00.
    ['2027-04-04T10:00', '2027-04-03T20:00'],
    // Inicio del horario de verano: la noche del sábado 4 de septiembre de 2027 se adelanta de 24:00 a 01:00.
    ['2027-09-05T09:00', '2027-09-04T20:00'],
    ['2026-11-02T08:00', '2026-11-01T20:00']
  ];
  for (const [evaluacionLocal, esperadoLocal] of casos) {
    const fecha = DateTime.fromISO(evaluacionLocal, { zone: zona }).toJSDate();
    const momento = avisos.momentoAntes(fecha, 'NOCHE_ANTERIOR_20H');
    assert.equal(DateTime.fromJSDate(momento, { zone: zona }).toFormat("yyyy-MM-dd'T'HH:mm"), esperadoLocal);
  }
});

test('aviso "después": a los orantes 2 h más tarde (con el ánimo) y push "¿Cómo te fue?" al joven', async () => {
  const o = await orante({ push: 'ok' });
  const j = await joven('Camila', 'ok');
  const fecha = new Date(Date.now() - 3 * HORA);
  const ev = await evaluacion(j, fecha, { resultadoAnimo: null });

  await avisos.enviarAvisosPendientes({ ahora: new Date(fecha.getTime() + 1.5 * HORA) });
  assert.equal(pushesPara(o).length, 0, 'aún no pasan 2 horas');

  await avisos.enviarAvisosPendientes({ ahora: new Date() });
  assert.equal(pushesPara(o).length, 1);
  assert.match(pushesPara(o)[0].payload.body, /Camila Pérez tenía prueba de Matemáticas (hoy|ayer)\. Quizás es buen momento para escribirle/);
  assert.equal(pushesPara(j).length, 1);
  const alJoven = pushesPara(j)[0].payload;
  assert.equal(alJoven.title, '¿Cómo te fue en tu prueba de Matemáticas?');
  assert.equal(alJoven.actions.length, 3);

  // El botón del push registra el ánimo con el token firmado, sin sesión.
  const { verificarEnlace } = require('../src/services/tokens');
  assert.equal(verificarEnlace(alJoven.animo.token, 'animo').e, ev.id);
  assert.equal(verificarEnlace(alJoven.animo.token, 'enlace'), null, 'el token no sirve para otra cosa');
  await evaluaciones.registrarAnimo(ev.id, 'NECESITA_ORACION');

  const o2 = await orante({ push: 'ok' });
  await avisos.enviarAvisosPendientes({ ahora: new Date() });
  assert.match(pushesPara(o2)[0].payload.body, /Pidió oración/);
  assert.equal(pushesPara(o).length, 1, 'el primero no recibe otro');
  assert.equal(pushesPara(j).length, 1, 'el joven no recibe otro');
});

test('si se cambia la hora de la evaluación, el aviso vuelve a salir para la nueva hora', async () => {
  const o = await orante({ push: 'ok' });
  const j = await joven();
  const ev = await evaluacion(j, new Date(Date.now() + 40 * 60 * 1000));
  await avisos.enviarAvisosPendientes({ ahora: new Date() });
  assert.equal(pushesPara(o).length, 1);

  const nueva = DateTime.now().setZone('America/Santiago').plus({ days: 2 }).set({ hour: 10, minute: 0 });
  await evaluaciones.actualizar(j.id, ev.id, { tipo: 'PRUEBA', ramo: 'Matemáticas', fecha: nueva.toISODate(), hora: '10:00' });
  await avisos.enviarAvisosPendientes({ ahora: nueva.minus({ minutes: 30 }).toJSDate() });
  assert.equal(pushesPara(o).length, 2);
});

test('chequeo diario: marca para reactivar a quien tiene push pero ninguna suscripción sana', async () => {
  const lider = await orante({ rol: 'LIDER', push: 'ok' });
  await prisma.pushSubscription.updateMany({ where: { userId: lider.id }, data: { fallosSeguidos: 3 } });
  const ahora = DateTime.fromISO('2026-11-03T09:00', { zone: 'America/Santiago' }).toJSDate();
  assert.deepEqual(await avisos.tareasDiarias({ ahora }), { necesitanReactivar: 1 });
  assert.equal(await avisos.tareasDiarias({ ahora }), null, 'solo una vez al día');
  const prefs = await prisma.notificationPrefs.findUnique({ where: { userId: lider.id } });
  assert.equal(prefs.pushNecesitaReactivar, true);
});

test('resumen semanal: domingo a las 20:00, una sola vez, solo a la líder', async () => {
  const lider = await orante({ rol: 'LIDER' });
  const otro = await orante();
  const domingo = DateTime.fromISO('2026-11-01T20:05', { zone: 'America/Santiago' });
  await evaluacion(await joven(), domingo.plus({ days: 2 }).set({ hour: 10 }).toJSDate());
  assert.equal(await avisos.resumenSemanal({ ahora: domingo.minus({ hours: 1 }).toJSDate() }), null);
  await avisos.resumenSemanal({ ahora: domingo.toJSDate() });
  await avisos.resumenSemanal({ ahora: domingo.plus({ minutes: 10 }).toJSDate() });
  assert.equal(correosPara(lider).length, 1);
  assert.equal(correosPara(otro).length, 0);
  assert.match(correosPara(lider)[0].text, /Esta semana hay 1 evaluación/);
});
