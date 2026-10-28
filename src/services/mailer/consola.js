// Solo para desarrollo local: muestra el correo en la terminal en vez de enviarlo.
async function enviar({ to, subject, text }) {
  console.log(`\nCorreo para ${to}\n   Asunto: ${subject}\n${text.split('\n').map((l) => '   ' + l).join('\n')}\n`);
}

module.exports = { enviar };
