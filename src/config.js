require('dotenv').config();

const esProduccion = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

function requerida(nombre, porDefectoEnDesarrollo) {
  const valor = process.env[nombre];
  if (valor) return valor;
  if (!esProduccion && porDefectoEnDesarrollo !== undefined) return porDefectoEnDesarrollo;
  throw new Error(`Falta la variable de entorno ${nombre}`);
}

const config = {
  esProduccion,
  puerto: Number(process.env.PORT || 3000),
  appUrl: requerida('APP_URL', 'http://localhost:3000').replace(/\/$/, ''),
  databaseUrl: requerida('DATABASE_URL'),
  sessionSecret: requerida('SESSION_SECRET', 'solo-para-desarrollo-cambiar'),
  cronSecret: requerida('CRON_SECRET', 'cron-desarrollo'),
  mail: {
    proveedor: (process.env.MAIL_PROVIDER || (esProduccion ? 'brevo' : 'consola')).toLowerCase(),
    fromEmail: process.env.MAIL_FROM_EMAIL || '',
    fromName: process.env.MAIL_FROM_NAME || 'CR Juntos en la prueba',
    brevoApiKey: process.env.BREVO_API_KEY || '',
    resendApiKey: process.env.RESEND_API_KEY || ''
  },
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
  },
  zona: 'America/Santiago'
};

module.exports = config;
