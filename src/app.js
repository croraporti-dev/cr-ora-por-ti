const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { cargarUsuario } = require('./middleware/auth');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Vercel: req.ip sale de X-Forwarded-For

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });
  next();
});

app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());

// Protección CSRF simple: las peticiones que modifican datos desde la app deben traer
// este header (un formulario de otro sitio no puede agregarlo). El cron usa su propio secreto.
const RUTAS_SIN_HEADER = ['/api/cron/'];
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (RUTAS_SIN_HEADER.some((r) => req.originalUrl.startsWith(r))) return next();
  if (req.get('X-CR-App') !== '1') return res.status(403).json({ error: 'Petición no permitida.' });
  next();
});

app.use('/api', cargarUsuario);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/yo', require('./routes/yo'));
app.use('/api/cron', require('./routes/cron'));
app.use('/api/animo', require('./routes/animo'));
app.use('/api/ajustes', require('./routes/ajustes'));
app.use('/api/joven', require('./routes/joven'));
app.use('/api/agenda', require('./routes/agenda'));
app.use('/api/lider', require('./routes/lider'));

app.use('/api', (req, res) => res.status(404).json({ error: 'No encontrado.' }));

// En Vercel los archivos de /public los sirve la CDN; esto es para desarrollo local.
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  // Solo el mensaje técnico, nunca el cuerpo de la petición (puede traer correos o códigos).
  const resumen = String(err.message || '').trim().split('\n').pop() || err.name;
  console.error(`[error] ${req.method} ${req.path}: ${err.code ? `${err.code} ` : ''}${resumen}`);
  res.status(500).json({ error: 'Algo falló de nuestro lado. Inténtalo de nuevo en un momento.' });
});

module.exports = app;
