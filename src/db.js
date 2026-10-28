const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const config = require('./config');

// En Vercel cada instancia reutiliza el cliente mientras siga "caliente".
const globalParaPrisma = globalThis;

if (!globalParaPrisma.__prisma) {
  // max bajo: el pooler de Supabase (puerto 6543) ya multiplexa las conexiones.
  const pool = new Pool({ connectionString: config.databaseUrl, max: 3 });
  globalParaPrisma.__prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
}

module.exports = globalParaPrisma.__prisma;
