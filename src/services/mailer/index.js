// Envío de correos con proveedor intercambiable (MAIL_PROVIDER = brevo | resend | consola).
const config = require('../../config');

const proveedores = {
  brevo: () => require('./brevo'),
  resend: () => require('./resend'),
  consola: () => require('./consola')
};

let transporteDePrueba = null;

// Para tests: reemplaza el envío real por una función propia.
function usarTransporte(fn) {
  transporteDePrueba = fn;
}

async function enviarCorreo({ to, subject, html, text }) {
  if (transporteDePrueba) return transporteDePrueba({ to, subject, html, text });
  const crear = proveedores[config.mail.proveedor];
  if (!crear) throw new Error(`MAIL_PROVIDER desconocido: ${config.mail.proveedor}`);
  const from = { email: config.mail.fromEmail, name: config.mail.fromName };
  return crear().enviar({ from, to, subject, html, text });
}

module.exports = { enviarCorreo, usarTransporte };
