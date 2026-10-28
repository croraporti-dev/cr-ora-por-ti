const config = require('../../config');

async function enviar({ from, to, subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${config.mail.resendApiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: `${from.name} <${from.email}>`, to: [to], subject, html, text })
  });
  if (!res.ok) throw new Error(`Resend respondió ${res.status}`);
}

module.exports = { enviar };
