const config = require('../../config');

async function enviar({ from, to, subject, html, text }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': config.mail.brevoApiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: from, to: [{ email: to }], subject, htmlContent: html, textContent: text })
  });
  if (!res.ok) throw new Error(`Brevo respondió ${res.status}`);
}

module.exports = { enviar };
