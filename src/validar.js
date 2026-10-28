// Validaciones simples del lado del servidor.
class ErrorValidacion extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.status = 400;
  }
}

function email(valor) {
  const e = String(valor || '').trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new ErrorValidacion('Revisa tu correo, parece que no está bien escrito.');
  return e;
}

function texto(valor, { nombre, min = 1, max = 80 }) {
  const t = String(valor ?? '').trim().replace(/\s+/g, ' ');
  if (t.length < min) throw new ErrorValidacion(`Falta ${nombre}.`);
  if (t.length > max) throw new ErrorValidacion(`El texto de ${nombre} es demasiado largo (máximo ${max} caracteres).`);
  return t;
}

function opcion(valor, permitidas, nombre) {
  if (!permitidas.includes(valor)) throw new ErrorValidacion(`El valor de ${nombre} no es válido.`);
  return valor;
}

// Celular chileno → +569XXXXXXXX. Acepta "9 1234 5678", "+56 9 1234 5678", "56912345678".
function telefono(valor) {
  let d = String(valor || '').replace(/\D/g, '');
  if (d.startsWith('56')) d = d.slice(2);
  if (d.length === 8) d = `9${d}`;
  if (!/^9\d{8}$/.test(d)) throw new ErrorValidacion('Revisa tu número de celular (ejemplo: 9 1234 5678).');
  return `+56${d}`;
}

module.exports = { ErrorValidacion, email, texto, opcion, telefono };
