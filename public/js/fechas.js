// Todas las fechas se muestran en hora de Chile, aunque el celular esté en otra zona.
const ZONA = 'America/Santiago';

const fmtPartes = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short'
});

// ISO (UTC) → { fecha: 'YYYY-MM-DD', hora: 'HH:mm', diaSemana: 1..7 (lunes = 1) }
export function partesChile(iso) {
  const p = Object.fromEntries(fmtPartes.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const dias = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}`, diaSemana: dias[p.weekday] };
}

function diasEntre(fechaA, fechaB) {
  return Math.round((Date.parse(fechaB) - Date.parse(fechaA)) / 86400000);
}

// Grupo de la agenda: 'pasadas' | 'hoy' | 'manana' | 'semana' | 'despues'
export function grupo(iso, ahora = new Date()) {
  const hoy = partesChile(ahora);
  const dias = diasEntre(hoy.fecha, partesChile(iso).fecha);
  if (dias < 0) return 'pasadas';
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'manana';
  if (dias <= 7 - hoy.diaSemana) return 'semana'; // hasta el domingo
  return 'despues';
}

const fmtDia = new Intl.DateTimeFormat('es-CL', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' });

// "hoy a las 10:00" | "mañana a las 08:30" | "jueves 6 de noviembre, 10:00"
export function cuando(iso, ahora = new Date()) {
  const { hora } = partesChile(iso);
  const g = grupo(iso, ahora);
  if (g === 'hoy') return `hoy a las ${hora}`;
  if (g === 'manana') return `mañana a las ${hora}`;
  return `${fmtDia.format(new Date(iso))}, ${hora}`;
}

export function hoyChile() {
  return partesChile(new Date()).fecha;
}

export function yaPaso(iso) {
  return new Date(iso).getTime() <= Date.now();
}
