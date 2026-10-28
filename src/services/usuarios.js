const prisma = require('../db');

// Valores por defecto de los avisos según el rol.
function prefsPorDefecto(rol) {
  if (rol === 'JOVEN') {
    return { pushAntes: false, pushDespues: false, emailAntes: false, emailDespues: false, anticipacion: 'UNA_HORA', seguir: 'TODOS' };
  }
  // LIDER (requisito) y ORANTE: push antes y después, 1 hora, siguen a todos.
  return { pushAntes: true, pushDespues: true, emailAntes: false, emailDespues: false, anticipacion: 'UNA_HORA', seguir: 'TODOS' };
}

async function crearUsuario({ email, nombre, rol, esMenor = false, apoderado = false }) {
  const ahora = new Date();
  return prisma.user.create({
    data: {
      email,
      nombre,
      rol,
      esMenor,
      aceptoAvisoAt: ahora,
      apoderadoAt: esMenor && apoderado ? ahora : null,
      prefs: { create: prefsPorDefecto(rol) }
    }
  });
}

function usuarioPublico(user) {
  return { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
}

module.exports = { prefsPorDefecto, crearUsuario, usuarioPublico };
