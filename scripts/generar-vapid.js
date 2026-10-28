// Genera un par de claves VAPID para Web Push. Uso: npm run generar-vapid
// Cópialas a .env y a las variables de entorno de Vercel. Genéralas UNA vez: si cambian,
// todas las suscripciones existentes dejan de funcionar y cada persona debe reactivar sus avisos.
const webpush = require('web-push');

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY="${publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${privateKey}"`);
console.log('VAPID_SUBJECT="mailto:tu-correo@ejemplo.cl"');
