// Datos de prueba: jóvenes "Persona 1", "Persona 2"… con pruebas y exámenes repartidos en la semana.
// Uso:  npm run demo -- crear | borrar               (local)
//       npm run prod:demo -- crear | borrar          (producción, usa .env.produccion)
// - Sin celular, para que el botón de WhatsApp no apunte al número de alguien real.
// - Sus avisos quedan marcados como ya enviados, para no llenar de notificaciones a quienes oran.
//   Agrega --con-avisos si quieres que sí lleguen.
const prisma = require('../src/db');
const { DateTime } = require('luxon');
const { prefsPorDefecto } = require('../src/services/usuarios');

const ZONA = 'America/Santiago';
const CANTIDAD = 8;
const esDemo = { rol: 'JOVEN', telefono: null, nombre: { startsWith: 'Persona ' } };

// [persona, días desde hoy, hora, tipo, ramo, tipoOtro, ánimo (solo pasadas)]
const EVALUACIONES = [
  [1, -2, '10:00', 'PRUEBA', 'Lenguaje', null, 'BIEN'],
  [2, -1, '15:30', 'EXAMEN', 'Física', null, 'NECESITA_ORACION'],
  [3, -1, '09:00', 'TRABAJO', 'Historia', null, 'MAS_O_MENOS'],
  [4, 0, '18:00', 'PRUEBA', 'Matemáticas'],
  [5, 0, '20:30', 'OTRO', 'Inglés', 'Disertación'],
  [1, 1, '08:30', 'EXAMEN', 'Química'],
  [6, 1, '11:00', 'PRUEBA', 'Biología'],
  [7, 2, '10:15', 'TRABAJO', 'Artes'],
  [2, 3, '09:45', 'PRUEBA', 'Filosofía'],
  [8, 3, '16:00', 'EXAMEN', 'Cálculo'],
  [3, 5, '12:00', 'OTRO', 'Música', 'Presentación'],
  [4, 6, '08:00', 'PRUEBA', 'Educación Física'],
  [6, 8, '14:30', 'EXAMEN', 'Programación'],
  [5, 10, '10:00', 'PRUEBA', 'Economía']
];

async function borrar() {
  const r = await prisma.user.deleteMany({ where: esDemo });
  console.log(`Borrados ${r.count} jóvenes de prueba (y sus evaluaciones).`);
}

async function crear(conAvisos) {
  await borrar();
  const hoy = DateTime.now().setZone(ZONA).startOf('day');
  const jovenes = [];
  for (let i = 1; i <= CANTIDAD; i++) {
    jovenes.push(await prisma.user.create({
      data: { nombre: `Persona ${i}`, rol: 'JOVEN', aprobadoAt: new Date(), prefs: { create: prefsPorDefecto('JOVEN') } }
    }));
  }
  const orantes = await prisma.user.findMany({ where: { rol: { in: ['ORANTE', 'LIDER'] }, aprobadoAt: { not: null } }, select: { id: true } });

  for (const [n, dias, hora, tipo, ramo, tipoOtro = null, animo = null] of EVALUACIONES) {
    const [h, m] = hora.split(':').map(Number);
    const fechaHora = hoy.plus({ days: dias }).set({ hour: h, minute: m }).toJSDate();
    const pasada = fechaHora < new Date();
    const ev = await prisma.evaluation.create({
      data: {
        userId: jovenes[n - 1].id, tipo, tipoOtro, ramo, fechaHora,
        estado: pasada ? 'REALIZADA' : 'PENDIENTE',
        resultadoAnimo: pasada ? animo : null
      }
    });
    if (!conAvisos) {
      await prisma.notificationLog.createMany({
        data: orantes.flatMap((o) => ['ANTES', 'DESPUES'].flatMap((t) => ['PUSH', 'EMAIL'].map((c) => ({
          userId: o.id, evaluationId: ev.id, tipo: t, canal: c, estado: 'OK'
        })))),
        skipDuplicates: true
      });
    }
  }
  console.log(`Creados ${CANTIDAD} jóvenes de prueba con ${EVALUACIONES.length} evaluaciones${conAvisos ? '' : ' (sin enviar avisos)'}.`);
}

const [accion] = process.argv.slice(2);
const tarea = accion === 'crear' ? crear(process.argv.includes('--con-avisos')) : accion === 'borrar' ? borrar() : null;
if (!tarea) {
  console.log('Uso: npm run demo -- crear | borrar   (agrega --con-avisos para que sí se envíen)');
  process.exit(1);
}
tarea
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
