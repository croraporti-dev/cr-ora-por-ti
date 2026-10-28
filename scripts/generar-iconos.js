// Genera los íconos de la PWA desde un SVG (corazón con una cruz, colores de CR Digital).
// Uso: npm run iconos   (solo hace falta si cambias el diseño; los PNG quedan en el repositorio)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const AZUL = '#2563eb';
const CALIDO = '#f59e0b';
const destino = path.join(__dirname, '..', 'public', 'icons');

const CORAZON = 'M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88 Z';
const CRUZ = `<rect x="46.5" y="27" width="7" height="40" rx="2"/><rect x="36" y="37" width="28" height="7" rx="2"/>`;

// escala = tamaño del corazón respecto del ícono (el maskable necesita más margen: zona segura del 80 %).
function svg({ escala, fondo = true, redondeado = true }) {
  const t = 100 * escala;
  const o = (100 - t) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  ${fondo ? `<rect width="100" height="100" ${redondeado ? 'rx="22"' : ''} fill="${AZUL}"/>` : ''}
  <g transform="translate(${o} ${o + 2}) scale(${escala})">
    <path d="${CORAZON}" fill="#ffffff"/>
    <g fill="${CALIDO}">${CRUZ}</g>
  </g>
</svg>`;
}

// Insignia de la barra de estado de Android: silueta blanca sobre transparente.
const insignia = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><mask id="m"><rect width="100" height="100" fill="#fff"/><g fill="#000">${CRUZ}</g></mask></defs>
  <path d="${CORAZON}" fill="#ffffff" mask="url(#m)"/>
</svg>`;

async function png(contenido, nombre, tamano) {
  await sharp(Buffer.from(contenido)).resize(tamano, tamano).png().toFile(path.join(destino, nombre));
  console.log(`✔ ${nombre}`);
}

(async () => {
  fs.mkdirSync(destino, { recursive: true });
  const normal = svg({ escala: 0.72 });
  fs.writeFileSync(path.join(destino, 'icon.svg'), normal);
  await png(normal, 'icon-192.png', 192);
  await png(normal, 'icon-512.png', 512);
  await png(svg({ escala: 0.56, redondeado: false }), 'maskable-512.png', 512);
  // iOS redondea solo las esquinas: fondo completo.
  await png(svg({ escala: 0.68, redondeado: false }), 'apple-touch-icon.png', 180);
  await png(insignia, 'badge-96.png', 96);
})();
