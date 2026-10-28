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

module.exports = { ErrorValidacion, email, texto, opcion };
