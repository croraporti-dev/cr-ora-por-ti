import 'dotenv/config';
import { defineConfig } from '@prisma/config';

// Las migraciones usan la conexión directa de Supabase (puerto 5432);
// la app en ejecución usa el pooler (DATABASE_URL, puerto 6543).
// `prisma generate` (npm install / build en Vercel) no necesita base de datos.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  ...(process.env.DIRECT_URL ? { datasource: { url: process.env.DIRECT_URL } } : {})
});
