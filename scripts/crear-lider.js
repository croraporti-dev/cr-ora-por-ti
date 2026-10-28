// Crea (o promueve) a la líder y genera el primer código de invitación.
// Uso: npm run crear-lider -- correo@ejemplo.cl "Nombre"
const prisma = require('../src/db');
const v = require('../src/validar');
const { crearUsuario, prefsPorDefecto } = require('../src/services/usuarios');
const invitacion = require('../src/services/invitacion');

async function main() {
  const [, , correo, ...partesNombre] = process.argv;
  if (!correo || !partesNombre.length) {
    console.log('Uso: npm run crear-lider -- correo@ejemplo.cl "Nombre"');
    process.exit(1);
  }
  const email = v.email(correo);
  const nombre = v.texto(partesNombre.join(' '), { nombre: 'el nombre', min: 2, max: 40 });

  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    user = await prisma.user.update({ where: { id: user.id }, data: { rol: 'LIDER', nombre, aprobadoAt: user.aprobadoAt || new Date() } });
    await prisma.notificationPrefs.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...prefsPorDefecto('LIDER') },
      update: prefsPorDefecto('LIDER')
    });
    console.log(`Listo: ${nombre} (${email}) ahora es LÍDER.`);
  } else {
    user = await crearUsuario({ email, nombre, rol: 'LIDER' });
    console.log(`Listo: líder creada, ${nombre} (${email}).`);
  }

  const codigo = (await invitacion.codigoActivo()) || (await invitacion.regenerar(user.id));
  console.log(`Enlace de invitación para orantes: ${invitacion.enlace(codigo.code)}`);
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
