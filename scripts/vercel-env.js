// Reemplaza las variables de entorno del proyecto en Vercel con las de .env.vercel (Production y Preview).
// Uso (una vez): npx vercel login     y luego:     npm run vercel:env
// Los valores se leen del archivo y se pasan a la CLI de Vercel por la entrada estándar: nunca se muestran.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ARCHIVO = path.join(__dirname, '..', '.env.vercel');
const ENTORNOS = ['production', 'preview'];
const PROYECTO = ['--scope', 'cr-extras'];

function vercel(args, entrada) {
  return spawnSync('npx', ['--yes', 'vercel', ...args, ...PROYECTO], {
    input: entrada,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    cwd: path.join(__dirname, '..')
  });
}

if (!fs.existsSync(ARCHIVO)) {
  console.error('No encuentro .env.vercel');
  process.exit(1);
}

const variables = fs.readFileSync(ARCHIVO, 'utf8').split(/\r?\n/)
  .filter((l) => l.trim() && !l.trim().startsWith('#'))
  .map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"(.*)"$/, '$1')];
  });

console.log('Vinculando el proyecto cr-ora-por-ti...');
const link = vercel(['link', '--yes', '--project', 'cr-ora-por-ti']);
if (link.status !== 0) {
  console.error('No se pudo vincular el proyecto. ¿Corriste "npx vercel login"?\n', link.stderr);
  process.exit(1);
}

// Borra todas las variables actuales del proyecto (incluidas las que se copiaron por error desde .env local).
const lista = vercel(['env', 'ls']);
const actuales = [...new Set((lista.stdout || '').split('\n').map((l) => l.trim().split(/\s+/)[0]).filter((n) => /^[A-Z][A-Z0-9_]+$/.test(n)))];
for (const nombre of actuales) {
  for (const entorno of [...ENTORNOS, 'development']) vercel(['env', 'rm', nombre, entorno, '--yes']);
  console.log(`Borrada ${nombre}`);
}

for (const [nombre, valor] of variables) {
  for (const entorno of ENTORNOS) {
    const r = vercel(['env', 'add', nombre, entorno], valor);
    if (r.status !== 0) {
      console.error(`Error al agregar ${nombre} (${entorno}):`, (r.stderr || '').split('\n').slice(-3).join(' '));
      process.exitCode = 1;
    }
  }
  console.log(`Agregada ${nombre}`);
}
console.log(process.exitCode ? '\nHubo errores; revisa los mensajes de arriba.' : '\nListo. Avísale a Claude para redesplegar.');
