// Textos de los correos. Breves, amables y sin presión.
const config = require('../config');

const MARCA = 'CR ora por ti';

function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Envoltorio HTML simple y compatible con clientes de correo.
function envolver(contenidoHtml) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:24px">
<tr><td style="font-size:14px;color:#2563eb;font-weight:bold;padding-bottom:12px">${MARCA}</td></tr>
<tr><td style="font-size:17px;line-height:1.5">${contenidoHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

function boton(url, texto, color = '#2563eb') {
  return `<a href="${escapar(url)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;margin:4px 0">${escapar(texto)}</a>`;
}

// ---------- Avisos de evaluaciones ----------
const { horaCorta, diaRelativo } = require('./tiempo');

// "prueba de Matemáticas", "entrega de trabajo de Historia", "disertación de Historia" (Otro con texto)
const FRASE_TIPO = { PRUEBA: 'prueba', EXAMEN: 'examen', TRABAJO: 'entrega de trabajo', OTRO: 'una evaluación' };
function queTiene(ev) {
  const tipo = ev.tipo === 'OTRO' && ev.tipoOtro ? ev.tipoOtro.toLowerCase() : FRASE_TIPO[ev.tipo];
  return `${tipo} de ${ev.ramo}`;
}

const FRASE_ANIMO = {
  BIEN: 'Contó que le fue bien.',
  MAS_O_MENOS: 'Contó que le fue más o menos.',
  NECESITA_ORACION: 'Pidió oración.'
};

const mayuscula = (s) => s[0].toUpperCase() + s.slice(1);
// "orar por Camila P." no debe terminar en ".."
const conPunto = (s) => (s.endsWith('.') ? s : `${s}.`);
const urlEvaluacion = (ev) => `/#/agenda?ev=${ev.id}`;

// Cada aviso tiene versión push (breve) y correo. `nombre` = "Camila P."
function avisoAntes(ev, nombre, ahora = new Date()) {
  const dia = diaRelativo(ev.fechaHora, ahora);
  const texto = `${mayuscula(dia)} a las ${horaCorta(ev.fechaHora)}, ${nombre} tiene ${queTiene(ev)}. Es un buen momento para orar por ${conPunto(nombre)}`;
  return {
    asunto: `${MARCA}: ${dia} ${nombre} tiene ${queTiene(ev)}`,
    texto,
    push: { title: `Ora por ${nombre}`, body: texto, url: urlEvaluacion(ev), tag: `antes-${ev.id}` }
  };
}

function avisoDespues(ev, nombre, ahora = new Date()) {
  const dia = diaRelativo(ev.fechaHora, ahora);
  let texto = `${nombre} tenía ${queTiene(ev)} ${dia}. Quizás es buen momento para escribirle y preguntarle cómo le fue.`;
  if (ev.resultadoAnimo) texto += ` ${FRASE_ANIMO[ev.resultadoAnimo]}`;
  return {
    asunto: `${MARCA}: ¿cómo le fue a ${nombre}?`,
    texto,
    push: { title: `¿Cómo le fue a ${nombre}?`, body: texto, url: urlEvaluacion(ev), tag: `despues-${ev.id}` }
  };
}

// Al joven (solo push: no tiene correo). Los botones del aviso registran el ánimo con un token firmado.
function avisoJoven(ev, tokenAnimo) {
  return {
    title: `¿Cómo te fue en tu ${queTiene(ev)}?`,
    body: 'Cuéntanos con un toque. Estamos orando por ti.',
    url: '/#/mis',
    tag: `animo-${ev.id}`,
    animo: { token: tokenAnimo },
    actions: [
      { action: 'BIEN', title: 'Bien' },
      { action: 'MAS_O_MENOS', title: 'Más o menos' },
      { action: 'NECESITA_ORACION', title: 'Necesito oración' }
    ]
  };
}

function correoAviso({ asunto, texto, push }, { reactivar = false } = {}) {
  const enlace = `${config.appUrl}${push.url}`;
  const enlaceReactivar = `${config.appUrl}/#/ajustes?reactivar=1`;
  const notaReactivar = reactivar
    ? `<p style="font-size:14px;background:#fff7ed;border-radius:8px;padding:10px 12px">Te escribimos por correo porque los avisos de tu dispositivo no están funcionando.
       <a href="${escapar(enlaceReactivar)}">Toca aquí para reactivarlos</a>.</p>`
    : '';
  return {
    subject: asunto,
    text: `${texto}\n\nVer en la agenda: ${enlace}${reactivar ? `\n\nLos avisos de tu dispositivo no están funcionando. Reactívalos aquí: ${enlaceReactivar}` : ''}`,
    html: envolver(`<p>${escapar(texto)}</p><p>${boton(enlace, 'Ver en la agenda')}</p>${notaReactivar}`)
  };
}

// Resumen del domingo para quienes tienen rol líder.
function correoResumenSemanal({ proximas, oracionesSemana, pidieronOracion }) {
  const lineas = proximas.map((p) => `• ${mayuscula(diaRelativo(p.fechaHora))} ${horaCorta(p.fechaHora)}: ${p.nombre}, ${queTiene(p)}`);
  const texto = [
    proximas.length ? `Esta semana hay ${proximas.length} evaluación(es):\n${lineas.join('\n')}` : 'Esta semana no hay evaluaciones anotadas.',
    `La semana pasada se registraron ${oracionesSemana} oración(es).`,
    pidieronOracion.length ? `Pidieron oración: ${pidieronOracion.join(', ')}.` : ''
  ].filter(Boolean).join('\n\n');
  return {
    subject: `${MARCA}: resumen de la semana`,
    text: `${texto}\n\nAgenda: ${config.appUrl}/#/agenda`,
    html: envolver(`${texto.split('\n\n').map((b) => `<p>${escapar(b).replace(/\n/g, '<br>')}</p>`).join('')}
      <p>${boton(`${config.appUrl}/#/agenda`, 'Abrir la agenda')}</p>`)
  };
}

// ---------- Solicitudes para sumarse a orar ----------

function avisoSolicitud(persona) {
  const texto = `${persona.nombre} (${persona.email}) quiere sumarse a orar por los jóvenes. Revisa la solicitud en «Grupo».`;
  const url = `${config.appUrl}/#/lider`;
  return {
    push: { title: 'Nueva solicitud para orar', body: texto, url: '/#/lider', tag: `solicitud-${persona.id}` },
    correo: {
      subject: `${MARCA}: ${persona.nombre} quiere sumarse a orar`,
      text: `${texto}\n\nAprobar o rechazar: ${url}`,
      html: envolver(`<p>${escapar(texto)}</p><p>${boton(url, 'Revisar solicitud')}</p>`)
    }
  };
}

function correoAprobado(persona) {
  const url = `${config.appUrl}/#/agenda`;
  const texto = `Hola, ${persona.nombre}. Ya eres parte del grupo de oración: desde ahora puedes ver la agenda y recibir avisos para orar por los jóvenes.`;
  return {
    subject: `${MARCA}: ya puedes orar con nosotros`,
    text: `${texto}\n\nAbrir la agenda: ${url}\n\nTe recomendamos activar los avisos en Ajustes.`,
    html: envolver(`<p>${escapar(texto)}</p><p>${boton(url, 'Abrir la agenda')}</p>
      <p style="font-size:14px;color:#64748b">Te recomendamos activar los avisos en Ajustes.</p>`)
  };
}

module.exports = {
  MARCA, escapar, envolver, boton, appUrl: () => config.appUrl,
  queTiene, avisoAntes, avisoDespues, avisoJoven, correoAviso, correoResumenSemanal,
  avisoSolicitud, correoAprobado
};
