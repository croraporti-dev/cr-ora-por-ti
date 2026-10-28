# CR ora por ti

PWA para que los jóvenes de CR registren sus pruebas, exámenes y trabajos, y un pequeño grupo
ore por ellos antes y converse con ellos después. Avisos por **push** (principal) y **correo** (respaldo).

Stack: Node.js + Express 5, Prisma 7 (adapter-pg), PostgreSQL en Supabase, Vercel. Frontend vanilla sin build.

> Este README se completa por etapas. Estado actual: **Etapa 3** (avisos push + correo, cron y NotificationLog).

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

**Jóvenes (`JOVEN`): sin cuenta ni inicio de sesión.**
- Abren la app, tocan "Anotar mi prueba" y la primera vez escriben nombre, apellido y celular, aceptan el aviso de privacidad y, si son menores, marcan que su apoderado está en conocimiento.
- Su celular queda recordado con una cookie httpOnly de 1 año, así que las siguientes veces solo anotan la evaluación.
- Solo ven y modifican **sus propias** evaluaciones. No ven la agenda general, por lo que un desconocido que abra el formulario no ve datos de nadie.
- Mismo número de celular = mismo joven. Si cambia de teléfono, escribe su número otra vez y recupera sus evaluaciones.
- El celular solo lo ve la líder. Los orantes ven "Camila P.".
- "¿Cómo te fue?" se responde en la app con tres botones cuando el joven vuelve a abrirla.

**Orantes (`ORANTE`) y líder (`LIDER`): con correo, sin contraseña.**
- Cada correo trae un **código de 6 dígitos** y un **enlace mágico** (vencen en 15 min y sirven una sola vez).
- En **iPhone con la app instalada** hay que escribir el código dentro de la app: el enlace del correo se abre en Safari, que guarda su sesión aparte.
- Para sumarse como orante se necesita el **código de invitación** que la líder ve (y puede cambiar) en su panel, porque la agenda muestra nombres de menores.
- Sesión de 30 días en una cookie httpOnly. Si la líder quita a alguien, su sesión deja de valer de inmediato.

## Agenda

- Agrupada en Hoy, Mañana, Esta semana (hasta el domingo), Más adelante y Hace poco (últimos 2 días, con el ánimo si el joven respondió).
- "Ya oré 🙏" suma una vez por persona (se puede deshacer). El joven ve cuántas personas oraron por él.
- ☆ en una tarjeta sigue a ese joven; el filtro "Solo los que sigo" muestra solo a esos jóvenes.
- La líder puede quitar cualquier evaluación (por ejemplo, una falsa).
- `#/agenda?ev=ID` abre y resalta una tarjeta (lo usarán las notificaciones).
- Todo se muestra en hora de Chile, aunque el celular esté configurado en otra zona.

## Avisos

El push es el canal principal; el correo es el respaldo automático.

| Aviso | A quién | Cuándo |
|---|---|---|
| **Antes** | Orantes y líder que siguen a ese joven | Según la anticipación de cada persona: 1 h, 3 h o la noche anterior a las 20:00 (hora de Chile). Vale hasta la hora de la evaluación. |
| **Después** | Orantes y líder | 2 h después de la evaluación (válido por 24 h). Incluye el ánimo si el joven ya respondió. |
| **¿Cómo te fue?** | El joven | 2 h después, solo por push con 3 botones (Bien / Más o menos / Necesito oración) que funcionan sin sesión. Si no tiene push, responde en la app. |
| **Resumen semanal** | La líder | Domingo desde las 20:00, por correo. |

Cómo se elige el canal, por aviso y por persona:
1. Si quiere push y tiene una suscripción activa → push.
2. Si no tiene push, o el push falla (404/410 o cualquier otro error) → **correo en ese mismo ciclo**. Si su push había funcionado antes, el correo incluye un enlace para reactivarlo.
3. Con "Celular y también correo" se envían ambos. Con "Solo correo", solo correo.

**Sin duplicados:** `NotificationLog` tiene un índice único `(userId, evaluationId, tipo, canal)`. Antes de enviar, cada ejecución
"reclama" su fila; si ya existe, no envía. Un correo que falló por el proveedor se reintenta en los ciclos siguientes
(máximo 5 veces). Un push que falló no se reintenta: pasa a correo. Si el joven cambia la hora de una evaluación,
sus avisos se reinician.

**Chequeo diario** (primera ejecución del cron después de las 08:00): quien alguna vez activó push y ya no tiene
ninguna suscripción sana queda marcado para ver el aviso de reactivación al abrir la app. También limpia códigos y contadores vencidos.

## Cron (cada 10 minutos)

`POST /api/cron/enviar-avisos` con el header `x-cron-secret: <CRON_SECRET>`. Responde solo conteos (sin datos personales).
Llamarlo de más es seguro gracias a `NotificationLog`.

### GitHub Actions (principal)

El workflow ya está en [.github/workflows/enviar-avisos.yml](.github/workflows/enviar-avisos.yml).
1. Sube el proyecto a un repositorio de GitHub.
2. En **Settings → Secrets and variables → Actions → New repository secret**, crea `APP_URL` (por ejemplo `https://cr-ora.vercel.app`) y `CRON_SECRET` (el mismo valor que en Vercel).
3. En la pestaña **Actions**, abre "Enviar avisos" y prueba con **Run workflow**.

Ten en cuenta dos limitaciones de GitHub:
- **Retrasos:** GitHub suele atrasar los `schedule` entre 5 y 20 minutos, a veces más. La app lo tolera: el aviso "antes" sale mientras la evaluación no haya empezado.
- **Repositorio público o privado:**
  - en un repositorio **privado** cada ejecución cuenta como 1 minuto, y cada 10 minutos son unos 4.300 minutos al mes, más que los 2.000 gratis;
  - en uno **público** los minutos son ilimitados, pero GitHub **desactiva los cron tras 60 días sin actividad** en el repositorio (avisa por correo).
  - Recomendación: repositorio público (no contiene secretos) **y además** cron-job.org.

### cron-job.org (respaldo recomendado, gratis)

1. Crea una cuenta en https://cron-job.org.
2. Crea un cronjob con la URL `https://TU-APP/api/cron/enviar-avisos`, cada 10 minutos.
3. En **Advanced**, configura el método `POST` y el header `x-cron-secret` con el valor de `CRON_SECRET`.

Puedes tener GitHub Actions y cron-job.org a la vez: si ambos llaman, igual no se duplica nada.

### Probar el cron en local

```bash
curl -X POST -H "x-cron-secret: cron-desarrollo" http://localhost:3000/api/cron/enviar-avisos
```

(`cron-desarrollo` es el valor por defecto en desarrollo si no defines `CRON_SECRET`.)

## Pruebas de avisos

```bash
npm run db:local       # en otra terminal
npm run test:avisos
```

Simula evaluaciones con push y correo **falsos** (no se envía nada real) y verifica:
- cada aviso sale una sola vez, incluso con el cron corriendo 3 veces seguidas o 4 en paralelo;
- respaldo por correo cuando el push da 410 (suscripción desactivada y enlace para reactivar) o 500;
- "también por correo", "solo los que sigo", la anticipación de 3 h y un cron atrasado;
- "noche anterior 20:00" en los cambios de horario de abril y septiembre;
- aviso "después" con el ánimo, push "¿Cómo te fue?" al joven con token firmado, y aviso de nuevo si se cambia la hora;
- chequeo diario y resumen semanal (una sola vez, solo a la líder).

Usa la base `cr_ora_test`, que **se borra en cada ejecución**. Para usar otra, define `DATABASE_URL_TEST`; su nombre debe contener "test".

## Migraciones

`prisma migrate dev` es interactivo. Si la terminal no lo permite, crea la migración con `prisma migrate diff`
y aplícala con `npm run db:deploy`.

## Seguridad

- Límite de intentos guardado en Postgres (en Vercel, la memoria no se comparte entre instancias): 10 solicitudes de código por IP cada 15 min, 4 por correo y 5 intentos por código.
- Solo se guardan hashes de los códigos y enlaces.
- Las peticiones que modifican datos requieren el header `X-CR-App: 1` (protección CSRF) además de la cookie SameSite=Lax.
- Los logs nunca incluyen el cuerpo de las peticiones.
