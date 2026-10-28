// POST /api/cron/enviar-avisos — lo llama GitHub Actions (y/o cron-job.org) cada 10 minutos.
// Llamarlo dos veces es seguro: NotificationLog evita duplicados.
const express = require('express');
const config = require('../config');
const { igualesSeguro } = require('../services/tokens');
const avisos = require('../services/avisos');

const router = express.Router();

function requiereSecreto(req, res, next) {
  const enviado = req.get('x-cron-secret') || '';
  if (!enviado || !igualesSeguro(enviado, config.cronSecret)) return res.status(401).json({ error: 'No autorizado.' });
  next();
}

router.post('/enviar-avisos', requiereSecreto, async (req, res, next) => {
  try {
    const inicio = Date.now();
    const resultado = {
      avisos: await avisos.enviarAvisosPendientes(),
      diarias: await avisos.tareasDiarias(),
      resumenSemanal: await avisos.resumenSemanal()
    };
    // Solo conteos: nunca nombres ni correos en la respuesta o los logs.
    console.log(`[cron] ${JSON.stringify(resultado.avisos)} en ${Date.now() - inicio} ms`);
    res.json({ ok: true, ...resultado, ms: Date.now() - inicio });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
