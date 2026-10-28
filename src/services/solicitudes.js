// Avisos de las solicitudes para sumarse a orar.
const prisma = require('../db');
const push = require('./push');
const { enviarCorreo } = require('./mailer');
const plantillas = require('./plantillas');

// A quienes tienen rol líder: push y, si no les llega, correo.
async function avisarNuevaSolicitud(persona) {
  const lideres = await prisma.user.findMany({
    where: { rol: 'LIDER', aprobadoAt: { not: null } },
    select: { id: true, email: true }
  });
  const aviso = plantillas.avisoSolicitud(persona);
  for (const l of lideres) {
    const r = await push.enviarAUsuario(l.id, aviso.push);
    if (!r.ok && l.email) await enviarCorreo({ to: l.email, ...aviso.correo });
  }
}

// A la persona aprobada, por correo (todavía no ha activado avisos).
async function avisarAprobacion(persona) {
  if (persona.email) await enviarCorreo({ to: persona.email, ...plantillas.correoAprobado(persona) });
}

module.exports = { avisarNuevaSolicitud, avisarAprobacion };
