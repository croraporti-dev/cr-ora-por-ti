// Fechas en America/Santiago. En la base todo va en UTC; Luxon maneja el horario de verano.
const { DateTime } = require('luxon');
const config = require('../config');

const ZONA = config.zona;

// 'YYYY-MM-DD' + 'HH:mm' en hora de Chile → Date (UTC). null si no es válida.
function desdeLocal(fecha, hora) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '') || !/^\d{2}:\d{2}$/.test(hora || '')) return null;
  const dt = DateTime.fromISO(`${fecha}T${hora}`, { zone: ZONA });
  return dt.isValid ? dt.toJSDate() : null;
}

function aLocal(date) {
  return DateTime.fromJSDate(date, { zone: ZONA });
}

function ahoraLocal() {
  return DateTime.now().setZone(ZONA);
}

// "10:00"
function horaCorta(date) {
  return aLocal(date).toFormat('HH:mm');
}

// "hoy", "mañana" o "el martes 04/11/2026"
function diaRelativo(date, ahora = new Date()) {
  const d = aLocal(date).startOf('day');
  const hoy = aLocal(ahora).startOf('day');
  const dias = Math.round(d.diff(hoy, 'days').days);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias === -1) return 'ayer';
  return `el ${d.setLocale('es-CL').toFormat('cccc dd/MM/yyyy')}`;
}

module.exports = { ZONA, desdeLocal, aLocal, ahoraLocal, horaCorta, diaRelativo };
