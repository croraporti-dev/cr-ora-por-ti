// Simula el cron en tu computador: llama a /api/cron/enviar-avisos cada minuto.
// Uso: npm run cron:local   (con `npm run dev` corriendo en otra terminal)
const { DateTime } = require('luxon');
const config = require('../src/config');

const URL = `http://localhost:${config.puerto}/api/cron/enviar-avisos`;
const CADA_MS = 60 * 1000;

async function llamar() {
  const hora = DateTime.now().setZone(config.zona).toFormat('HH:mm:ss');
  try {
    const res = await fetch(URL, { method: 'POST', headers: { 'x-cron-secret': config.cronSecret } });
    const r = await res.json();
    if (!res.ok) return console.log(`[${hora}] Error ${res.status}: ${r.error}`);
    const a = r.avisos;
    console.log(`[${hora}] push enviados: ${a.push}, push fallidos: ${a.pushFallidos}, correos: ${a.correos}, correos fallidos: ${a.correosFallidos}`);
  } catch {
    console.log(`[${hora}] No se pudo conectar con ${URL}. ¿Está corriendo npm run dev?`);
  }
}

console.log(`Cron local: llamando a ${URL} cada minuto. Ctrl+C para detener.`);
llamar();
setInterval(llamar, CADA_MS);
