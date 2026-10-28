// Solo para desarrollo local: muestra el correo en la terminal en vez de enviarlo,
// y lo agrega a correos-locales.txt (por si la terminal se limpia o se pierde de vista).
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');

const ARCHIVO = path.join(__dirname, '..', '..', '..', 'correos-locales.txt');

async function enviar({ to, subject, text }) {
  const hora = DateTime.now().setZone('America/Santiago').toFormat('dd/MM/yyyy HH:mm');
  const bloque = `\nCorreo para ${to} (${hora})\n   Asunto: ${subject}\n${text.split('\n').map((l) => '   ' + l).join('\n')}\n`;
  console.log(bloque);
  try {
    fs.appendFileSync(ARCHIVO, bloque);
  } catch {
    /* sin permiso de escritura: basta con la terminal */
  }
}

module.exports = { enviar };
