// Genera el QR para que los jóvenes anoten sus pruebas (abre «Anotar mi prueba»), y un afiche para imprimir
// o compartir. Uso: npm run qr   → crea qr/qr-anotar-prueba.png y qr/afiche-anotar-prueba.png
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const sharp = require('sharp');

const URL_APP = (process.env.APP_URL || 'https://cr-ora-por-ti.vercel.app').replace(/\/$/, '');
const DESTINO = `${URL_APP}/#/mis`;
const AZUL = '#2563eb';
const carpeta = path.join(__dirname, '..', 'qr');

(async () => {
  fs.mkdirSync(carpeta, { recursive: true });

  // QR solo (nivel de corrección "H": se lee aunque el papel esté algo dañado o con el logo encima).
  const qrSvg = await QRCode.toString(DESTINO, { type: 'svg', errorCorrectionLevel: 'H', margin: 2, color: { dark: '#0f172a', light: '#ffffff' } });
  await sharp(Buffer.from(qrSvg)).resize(1000, 1000).png().toFile(path.join(carpeta, 'qr-anotar-prueba.png'));

  // Afiche tamaño carta vertical (1240 x 1754 px ≈ A4 a 150 ppp).
  const logo = fs.readFileSync(path.join(__dirname, '..', 'public', 'icons', 'logo-azul.svg'), 'utf8')
    .replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const qrInterno = qrSvg.replace(/^[\s\S]*?<svg[^>]*viewBox="([^"]+)"[^>]*>/, '<svg viewBox="$1" x="270" y="610" width="700" height="700">');
  const afiche = `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754" viewBox="0 0 1240 1754">
  <rect width="1240" height="1754" fill="#ffffff"/>
  <rect x="0" y="0" width="1240" height="16" fill="${AZUL}"/>
  <g transform="translate(470 120) scale(4.9)">${logo}</g>
  <text x="620" y="380" text-anchor="middle" font-family="Montserrat, Arial Black, Arial, sans-serif" font-weight="800" font-size="62" letter-spacing="6" fill="#0f172a">JUNTOS EN LA PRUEBA</text>
  <text x="620" y="470" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="46" fill="${AZUL}">¿Tienes una prueba o examen?</text>
  <text x="620" y="530" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#475569">Anótala y oraremos por ti ese día.</text>
  <rect x="250" y="590" width="740" height="740" rx="36" fill="#ffffff" stroke="${AZUL}" stroke-width="6"/>
  ${qrInterno}
  <text x="620" y="1420" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="44" fill="#0f172a">Escanea con la cámara de tu celular</text>
  <text x="620" y="1480" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="#475569">Sin cuenta ni contraseña: solo tu nombre y tu celular.</text>
  <text x="620" y="1600" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#64748b">${DESTINO.replace('https://', '')}</text>
  <rect x="0" y="1738" width="1240" height="16" fill="${AZUL}"/>
</svg>`;
  await sharp(Buffer.from(afiche)).png().toFile(path.join(carpeta, 'afiche-anotar-prueba.png'));

  console.log(`Listo. El QR abre: ${DESTINO}`);
  console.log('Archivos: qr/qr-anotar-prueba.png y qr/afiche-anotar-prueba.png');
})();
