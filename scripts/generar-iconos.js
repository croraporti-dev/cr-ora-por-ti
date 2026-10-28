// Genera los íconos de la PWA con el logo «Union» de CR (public/icons/union.svg, el mismo de CR Digital).
// Uso: npm run iconos   (solo hace falta si cambia el logo; los PNG quedan en el repositorio)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const AZUL = '#2563eb';
const CREMA = '#E5E2DD'; // color original del logo
const destino = path.join(__dirname, '..', 'public', 'icons');

// Trazado del logo Union (viewBox 0 0 61 38).
const original = fs.readFileSync(path.join(destino, 'union.svg'), 'utf8');
const TRAZO = original.match(/<path d="([^"]+)"/)[1];
const ANCHO = 61;
const ALTO = 38;

// ancho = ancho del logo respecto del ícono (el maskable necesita más margen: zona segura del 80 %).
function svg({ ancho, fondo = AZUL, color = CREMA, redondeado = true }) {
  const escala = (100 * ancho) / ANCHO;
  const x = (100 - ANCHO * escala) / 2;
  const y = (100 - ALTO * escala) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  ${fondo ? `<rect width="100" height="100" ${redondeado ? 'rx="22"' : ''} fill="${fondo}"/>` : ''}
  <path transform="translate(${x} ${y}) scale(${escala})" d="${TRAZO}" fill="${color}"/>
</svg>`;
}

async function png(contenido, nombre, tamano) {
  await sharp(Buffer.from(contenido)).resize(tamano, tamano).png().toFile(path.join(destino, nombre));
  console.log(`Creado ${nombre}`);
}

(async () => {
  const normal = svg({ ancho: 0.62 });
  // Para el encabezado de la app (fondo blanco): el logo en azul, sin recuadro.
  fs.writeFileSync(path.join(destino, 'logo-azul.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} ${ALTO}"><path d="${TRAZO}" fill="${AZUL}"/></svg>\n`);
  fs.writeFileSync(path.join(destino, 'icon.svg'), normal);
  await png(normal, 'icon-192.png', 192);
  await png(normal, 'icon-512.png', 512);
  await png(svg({ ancho: 0.5, redondeado: false }), 'maskable-512.png', 512);
  // iOS redondea solo las esquinas: fondo completo.
  await png(svg({ ancho: 0.58, redondeado: false }), 'apple-touch-icon.png', 180);
  // Insignia de la barra de estado de Android: silueta blanca sobre transparente.
  await png(svg({ ancho: 0.8, fondo: null, color: '#ffffff' }), 'badge-96.png', 96);
})();
