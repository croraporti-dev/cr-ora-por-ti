const prisma = require('../db');

// Valores por defecto de los avisos según el rol.
function prefsPorDefecto(rol) {
  if (rol === 'JOVEN') {
    return { pushAntes: false, pushDespues: false, emailAntes: false, emailDespues: false, anticipacion: 'UNA_HORA' };
  }
  // LIDER (requisito) y ORANTE: push antes y después, 1 hora antes.
  return { pushAntes: true, pushDespues: true, emailAntes: false, emailDespues: false, anticipacion: 'UNA_HORA' };
}

// `aprobado: false` deja a la persona pendiente de aprobación (orantes que se suman por el enlace).
async function crearUsuario({ email, nombre, rol, aprobado = true, passwordHash = null }) {
  const ahora = new Date();
  return prisma.user.create({
    data: {
      email,
      nombre,
      rol,
      aceptoAvisoAt: ahora,
      aprobadoAt: aprobado ? ahora : null,
      passwordHash,
      prefs: { create: prefsPorDefecto(rol) }
    }
  });
}

function usuarioPublico(user) {
  return { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, pendiente: !user.aprobadoAt };
}

module.exports = { prefsPorDefecto, crearUsuario, usuarioPublico };
