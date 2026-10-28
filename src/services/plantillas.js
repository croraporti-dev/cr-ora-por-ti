// Textos de los correos. Breves, amables y sin presión.
const config = require('../config');

const MARCA = 'CR ora por ti';

function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Envoltorio HTML simple y compatible con clientes de correo.
function envolver(contenidoHtml) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:24px">
<tr><td style="font-size:14px;color:#2563eb;font-weight:bold;padding-bottom:12px">🙏 ${MARCA}</td></tr>
<tr><td style="font-size:17px;line-height:1.5">${contenidoHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

function boton(url, texto, color = '#2563eb') {
  return `<a href="${escapar(url)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;margin:4px 0">${escapar(texto)}</a>`;
}

function correoAcceso({ codigo, enlace }) {
  return {
    subject: `${MARCA}: tu código de acceso es ${codigo}`,
    text: `Tu código para entrar es: ${codigo}\n\nTambién puedes entrar con este enlace:\n${enlace}\n\nVence en 15 minutos. Si no lo pediste, ignora este correo.`,
    html: envolver(`<p>Tu código para entrar es:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:8px 0 16px">${escapar(codigo)}</p>
<p>${boton(enlace, 'Entrar a la app')}</p>
<p style="font-size:14px;color:#64748b">Si usas la app instalada en iPhone, escribe el código dentro de la app (el enlace abre Safari).<br>Vence en 15 minutos. Si no lo pediste, ignora este correo.</p>`)
  };
}

module.exports = { MARCA, escapar, envolver, boton, correoAcceso, appUrl: () => config.appUrl };
