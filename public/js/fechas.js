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

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

// 'YYYY-MM-DD' → 'dd/mm/aaaa'
export function aDMA(fechaIso) {
  const [a, m, d] = fechaIso.split('-');
  return `${d}/${m}/${a}`;
}

// 'dd/mm/aaaa' → 'YYYY-MM-DD', o null si no es una fecha real.
export function desdeDMA(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texto || '').trim());
  if (!m) return null;
  const [, d, mes, a] = m;
  const f = new Date(Date.UTC(+a, +mes - 1, +d));
  if (f.getUTCFullYear() !== +a || f.getUTCMonth() !== +mes - 1 || f.getUTCDate() !== +d) return null;
  return `${a}-${mes}-${d}`;
}

// "hoy a las 10:00" | "mañana a las 08:30" | "jueves 06/11/2026, 10:00" (siempre 24 h)
export function cuando(iso, ahora = new Date()) {
  const { fecha, hora, diaSemana } = partesChile(iso);
  const g = grupo(iso, ahora);
  if (g === 'hoy') return `hoy a las ${hora}`;
  if (g === 'manana') return `mañana a las ${hora}`;
  return `${DIAS[diaSemana - 1]} ${aDMA(fecha)}, ${hora}`;
}

export function hoyChile() {
  return partesChile(new Date()).fecha;
}

// Fecha de Chile dentro de `dias` días, en 'YYYY-MM-DD'.
export function fechaChileEn(dias) {
  return partesChile(new Date(Date.now() + dias * 86400000)).fecha;
}

export function yaPaso(iso) {
  return new Date(iso).getTime() <= Date.now();
}
