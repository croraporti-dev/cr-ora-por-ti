# CR ora por ti

PWA para que los jóvenes de CR registren sus pruebas, exámenes y trabajos, y un pequeño grupo
ore por ellos antes y converse con ellos después. Avisos por **push** (principal) y **correo** (respaldo).

Stack: Node.js + Express 5, Prisma 7 (adapter-pg), PostgreSQL en Supabase, Vercel. Frontend vanilla sin build.

> Este README se completa por etapas. Estado actual: **Etapa 1** (base, login, invitación, roles).

## Desarrollo local

Requisitos: Node 20 o superior.

```bash
npm install
cp .env.example .env        # en local basta con DATABASE_URL, DIRECT_URL y MAIL_PROVIDER=consola
npm run db:local            # Postgres embebido en localhost:54329 (déjalo corriendo en otra terminal)
npx prisma migrate dev      # crea las tablas
npm run crear-lider -- tu@correo.cl "Tu Nombre"   # crea la líder y muestra el código de invitación
npm run dev                 # http://localhost:3000
```

Para usar el Postgres local, en `.env`:

```
DATABASE_URL="postgresql://postgres:local@localhost:54329/cr_ora"
DIRECT_URL="postgresql://postgres:local@localhost:54329/cr_ora"
MAIL_PROVIDER="consola"
```

Con `MAIL_PROVIDER=consola`, los correos (incluido el código de 6 dígitos) se muestran en la terminal del servidor.

## Variables de entorno

Revisa [.env.example](.env.example); ahí está explicada cada una.

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Pooler de Supabase (puerto 6543, `?pgbouncer=true`). Lo usa la app. |
| `DIRECT_URL` | Conexión directa (puerto 5432). Solo para `prisma migrate`. |
| `APP_URL` | URL pública sin `/` final (se usa en los enlaces de los correos). |
| `SESSION_SECRET` | Firma las sesiones y los enlaces. Largo y aleatorio. |
| `CRON_SECRET` | Secreto del endpoint del cron. |
| `MAIL_PROVIDER` | `brevo`, `resend` o `consola`. |
| `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` | Remitente: "CR ora por ti" <correo verificado>. |
| `BREVO_API_KEY` / `RESEND_API_KEY` | Clave del proveedor elegido. |
| `VAPID_*` | Claves de Web Push (Etapa 4). |

## Acceso y roles

- Sin contraseñas: cada correo trae un **código de 6 dígitos** y un **enlace mágico** (ambos vencen en 15 min y sirven una sola vez).
- En **iPhone con la app instalada** hay que escribir el código dentro de la app: el enlace del correo se abre en Safari, que guarda su sesión aparte.
- Para registrarse se necesita el **código de invitación** que la líder ve (y puede cambiar) en su panel.
- Sesión de 30 días en una cookie httpOnly. Si la líder quita a alguien, su sesión deja de valer de inmediato.
- Roles: `JOVEN` (registra sus evaluaciones), `ORANTE` (ve la agenda y ora), `LIDER` (administra el grupo).

## Seguridad

- Límite de intentos guardado en Postgres (en Vercel, la memoria no se comparte entre instancias): 10 solicitudes de código por IP cada 15 min, 4 por correo y 5 intentos por código.
- Solo se guardan hashes de los códigos y enlaces.
- Las peticiones que modifican datos requieren el header `X-CR-App: 1` (protección CSRF) además de la cookie SameSite=Lax.
- Los logs nunca incluyen el cuerpo de las peticiones.
