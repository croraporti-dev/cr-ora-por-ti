// Postgres local para desarrollo y pruebas, sin Docker ni instalación.
// Uso: npm run db:local   (déjalo corriendo en una terminal aparte)
// Conexión: postgresql://postgres:local@localhost:54329/cr_ora
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const databaseDir = path.join(raiz, '.pgdata');
const nueva = !existsSync(databaseDir);

const pg = new EmbeddedPostgres({ databaseDir, user: 'postgres', password: 'local', port: 54329, persistent: true });

if (nueva) await pg.initialise();
await pg.start();
if (nueva) {
  await pg.createDatabase('cr_ora');
  await pg.createDatabase('cr_ora_test');
}
console.log('Postgres local listo en localhost:54329 (bases cr_ora y cr_ora_test). Ctrl+C para detener.');

async function detener() {
  await pg.stop();
  process.exit(0);
}
process.on('SIGINT', detener);
process.on('SIGTERM', detener);
