import 'dotenv/config';
import { defineConfig, env } from '@prisma/config';

// Las migraciones usan la conexión directa de Supabase (puerto 5432);
// la app en ejecución usa el pooler (DATABASE_URL, puerto 6543).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DIRECT_URL')
  }
});
