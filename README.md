# CR ora por ti

PWA para que los jóvenes de CR registren sus pruebas, exámenes y trabajos, y un pequeño grupo
ore por ellos antes y converse con ellos después. Avisos por **push** (principal) y **correo** (respaldo).

Stack: Node.js + Express 5, Prisma 7 (adapter-pg), PostgreSQL en Supabase, Vercel. Frontend vanilla sin build.

> Estado actual: Etapas 1 a 5 construidas. Falta desplegar y probar en un celular real (cierre de la Etapa 4).

## Desarrollo local

Requisitos: Node 20 o superior.

```bash
npm install
cp .env.example .env        # en local basta con DATABASE_URL, DIRECT_URL y MAIL_PROVIDER=consola
npm run db:local            # Postgres embebido en localhost:54329 (déjalo corriendo en otra terminal)
npx prisma migrate dev      # crea las tablas
npm run crear-lider -- tu@correo.cl "Tu Nombre"   # crea una cuenta con rol líder y muestra el enlace de invitación
npm run dev                 # http://localhost:3000
```

Para usar el Postgres local, en `.env`:

```
DATABASE_URL="postgresql://postgres:local@localhost:54329/cr_ora"
DIRECT_URL="postgresql://postgres:local@localhost:54329/cr_ora"
MAIL_PROVIDER="consola"
```

Con `MAIL_PROVIDER=consola`, los correos (incluido el código de 6 dígitos) se muestran en la terminal del servidor.

### Prueba local completa (antes de desplegar)

Usa tres terminales:

| Terminal | Comando | Para qué |
|---|---|---|
| 1 | `npm run db:local` | Base de datos local |
| 2 | `npm run dev` | La app en http://localhost:3000; aquí aparecen los correos y los códigos |
| 3 | `npm run cron:local` | Envía los avisos pendientes cada minuto (simula GitHub Actions) |

Recorrido sugerido, en **Chrome** de tu computador:
1. **Líder:** `npm run crear-lider -- tu@correo.cl "Tu Nombre"`. Entra en http://localhost:3000 → «Entrar para orar», con el código de 6 dígitos que aparece en la terminal 2.
2. **Avisos:** en Ajustes toca «Activar avisos en este dispositivo», acepta el permiso y toca «Enviar notificación de prueba». La notificación debe llegar aunque minimices Chrome.
3. **Joven:** abre una ventana de incógnito (así tiene otra sesión), toca «Anotar mi prueba», completa tus datos y anota una evaluación para hoy, unos 50 minutos más tarde.
4. En el siguiente minuto, la terminal 3 muestra `push enviados: 1` y te llega «Ora por …». Al tocarla se abre esa tarjeta en la agenda.
5. **Respaldo por correo:** en Ajustes toca «Desactivar en este dispositivo» y anota otra evaluación. Ahora el aviso sale por correo y aparece en la terminal 2.
6. **Después:** el aviso "después" sale 2 horas tras la evaluación. Para no esperar, anota una evaluación con fecha de hoy y una hora de hace 2 a 3 horas (se aceptan horas de hasta 24 h atrás).

Al probar en Chrome de escritorio, el push usa los servidores de Google, así que el computador debe tener internet.

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
- Abren la app, tocan "Anotar mi prueba" y la primera vez escriben nombre, apellido y celular, y aceptan el aviso de privacidad.
- Su dispositivo queda recordado con una cookie httpOnly de 1 año, así que las siguientes veces solo anotan la evaluación.
- Solo ven y modifican **sus propias** evaluaciones. No ven la agenda general, por lo que un desconocido que abra el formulario no ve datos de nadie.
- Mismo número de celular = mismo joven. Si cambia de teléfono, escribe su número otra vez y recupera sus evaluaciones.
- El celular solo lo ven quienes tienen rol líder. Los orantes ven "Camila P.".
- "¿Cómo te fue?" se responde en la app con tres botones cuando el joven vuelve a abrirla.

**Orantes (`ORANTE`) y líder (`LIDER`): con correo, sin contraseña.**
- Cada correo trae un **código de 6 dígitos** y un **enlace mágico** (vencen en 15 min y sirven una sola vez).
- En **iPhone con la app instalada** hay que escribir el código dentro de la app: el enlace del correo se abre en Safari, que guarda su sesión aparte.
- Para sumarse a orar se necesita el **enlace de invitación** que se comparte desde la pantalla «Grupo» (por WhatsApp o copiándolo). No hay que escribir ningún código.
- **Aprobación:** quien se registra por el enlace queda **pendiente**. No ve la agenda ni recibe avisos hasta que alguien con rol líder lo aprueba en «Grupo». A quienes tienen rol líder les llega un aviso por cada solicitud nueva (push, o correo si no tienen push), y la persona recibe un correo cuando la aprueban. Si el enlace se filtra, quien lo use igual queda pendiente; para anularlo, se genera uno nuevo.
- Quien ora y también tiene pruebas las anota en el formulario público («Anotar mi prueba»), como cualquier joven. Desde la agenda hay un acceso directo. Son dos cosas separadas: los adultos que solo oran no ven esa opción en su cuenta.
- Sesión de 30 días en una cookie httpOnly. Si se quita a alguien desde «Grupo», su sesión deja de valer de inmediato.

## Agenda

- Agrupada en Hoy, Mañana, Esta semana (hasta el domingo), Más adelante y Hace poco (últimos 2 días, con el ánimo si el joven respondió).
- "Ya oré" suma una vez por persona (se puede deshacer). El joven ve cuántas personas oraron por él.
- Sin distinciones: todos los orantes y líderes ven y reciben avisos de todos los jóvenes.
- Quienes tienen rol líder pueden quitar cualquier evaluación (por ejemplo, una falsa).
- `#/agenda?ev=ID` abre y resalta una tarjeta (lo usarán las notificaciones).
- Todo se muestra en hora de Chile, aunque el celular esté configurado en otra zona.

## Pantalla «Grupo» (rol líder)

Menú «Grupo» (solo rol LIDER):
- **Esta semana** (lunes a domingo):
  - evaluaciones, cuántas faltan y cuántos jóvenes las tienen;
  - oraciones registradas;
  - avisos enviados por push y por correo;
  - cuántos orantes tienen avisos activos;
  - quién pidió oración en los últimos 7 días.
- **Solicitudes para orar:** aprobar o rechazar a quienes se registraron con el enlace.
- **Invitar a orar:** enlace para compartir por WhatsApp o copiar, y botón para generar uno nuevo (el anterior deja de servir).
- **Miembros**, agrupados en líderes, orantes y jóvenes:
  - Jóvenes: celular y cuántas evaluaciones tiene, con un enlace a WhatsApp para escribirle fuera de la app.
  - Orantes: correo y si tiene avisos activos o los recibe por correo.
  - Cambiar el rol entre Orante y Líder. Siempre debe quedar al menos una persona con rol de líder. Los jóvenes no cambian de rol.
  - Quitar a alguien borra sus datos, incluidas sus evaluaciones. Nadie puede quitar su propia cuenta.

## Avisos

El push es el canal principal; el correo es el respaldo automático.

| Aviso | A quién | Cuándo |
|---|---|---|
| **Antes** | Todos los orantes y líderes | Según la anticipación de cada persona: 1 h, 3 h o la noche anterior a las 20:00 (hora de Chile). Vale hasta la hora de la evaluación. |
| **Después** | Todos los orantes y líderes | 2 h después de la evaluación (válido por 24 h). Incluye el ánimo si el joven ya respondió. |
| **¿Cómo te fue?** | El joven | 2 h después, solo por push con 3 botones (Bien / Más o menos / Necesito oración) que funcionan sin sesión. Si no tiene push, responde en la app. |
| **Resumen semanal** | Quienes tienen rol líder | Domingo desde las 20:00, por correo. |

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
- todos reciben avisos de todos los jóvenes; "también por correo", la anticipación de 3 h y un cron atrasado;
- "noche anterior 20:00" en los cambios de horario de abril y septiembre;
- aviso "después" con el ánimo, push "¿Cómo te fue?" al joven con token firmado, y aviso de nuevo si se cambia la hora;
- chequeo diario y resumen semanal (una sola vez, solo al rol líder).

Usa la base `cr_ora_test`, que **se borra en cada ejecución**. Para usar otra, define `DATABASE_URL_TEST`; su nombre debe contener "test".

## App instalable y avisos push

- `public/manifest.webmanifest` incluye nombre "CR ora por ti", short_name "CR ora", `display: standalone` e íconos 192, 512 y maskable. Para regenerar los íconos: `npm run iconos`.
- `public/sw.js` es el service worker. Recibe el push, abre la tarjeta de la evaluación al tocar el aviso y registra el ánimo con los botones "¿Cómo te fue?" (en Android). También permite abrir la app sin conexión.
- El permiso se pide **solo** al tocar "Activar avisos en este dispositivo", nunca al cargar la página.
- En **Ajustes** (orantes y líder) y en **Mis evaluaciones** (jóvenes) hay un indicador "Avisos en este dispositivo: activos / no activos" con los botones "Activar avisos en este dispositivo", "Enviar notificación de prueba" y "Desactivar".
- **Reactivación:** si una suscripción vence o falla, al abrir la agenda aparece un aviso para reactivarla, y los correos de respaldo traen el enlace `/#/ajustes?reactivar=1`.

### iPhone

- Las push solo funcionan desde **iOS 16.4**, y con la app **agregada a la pantalla de inicio** y abierta desde su ícono.
- Si se abre en Safari sin instalar, la app muestra una guía de 3 pasos: Compartir → «Agregar a pantalla de inicio» → abrir «CR ora» desde el ícono → activar avisos.
- En iPhone los botones dentro de la notificación no aparecen: tocar el aviso "¿Cómo te fue?" abre la app, donde están los 3 botones.
- La app instalada guarda su sesión aparte de Safari: hay que entrar con el **código de 6 dígitos** dentro de la app.

### Claves VAPID

```bash
npm run generar-vapid
```

Copia `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (un `mailto:` tuyo) a `.env` y a Vercel.
Genéralas **una sola vez**: si cambian, todas las suscripciones dejan de servir y cada persona debe reactivar sus avisos.

### Probar el push en local

El push funciona en `http://localhost` en Chrome o Edge, sin HTTPS:
1. `npm run dev`, abre http://localhost:3000 en Chrome y entra.
2. Ve a **Ajustes**, toca **Activar avisos en este dispositivo** y acepta el permiso.
3. Toca **Enviar notificación de prueba**.

Desde el celular se necesita HTTPS, así que hay que probar con la app desplegada en Vercel.

## Desplegar (costo $0)

### 1. Base de datos en Supabase
1. Crea un proyecto en https://supabase.com (plan Free, región **South America (São Paulo)**). Guarda la contraseña de la base.
2. Toca **Connect** en el proyecto y copia:
   - **Transaction pooler** (puerto 6543) → `DATABASE_URL`, agregando `?pgbouncer=true` al final.
   - **Session pooler** o **Direct connection** (puerto 5432) → `DIRECT_URL`.
3. Pega esas dos URL en `.env.produccion` (archivo local, no se sube a GitHub; ahí también están los secretos ya generados) y corre desde tu computador:
   ```bash
   npm run prod:migrar
   npm run prod:crear-lider -- correo-de-caro@ejemplo.cl "Caro"
   ```
   El segundo comando muestra el enlace de invitación (también está en la pantalla «Grupo»).

Supabase pausa los proyectos gratis tras 7 días sin uso. El cron consulta la base cada 10 minutos, así que no debería pausarse.

### 2. Correo con Brevo (recomendado para empezar)
1. Crea una cuenta gratis en https://www.brevo.com (300 correos al día).
2. Ve a **Senders, Domains & Dedicated IPs → Senders → Add a sender**, ingresa el correo remitente y nombre "CR ora por ti", y verifícalo con el código que te llega.
3. Ve a **SMTP & API → API Keys → Generate a new API key** y cópiala en `BREVO_API_KEY`.
4. En las variables: `MAIL_PROVIDER=brevo`, `MAIL_FROM_EMAIL=<el remitente verificado>`, `MAIL_FROM_NAME=CR ora por ti`.

Para que **no caigan en spam**:
- Con un remitente `@gmail.com` funciona para empezar, pero Gmail y Outlook desconfían de correos "de gmail" enviados por otro servidor.
- Lo ideal es usar un **dominio propio** (por ejemplo `avisos@crdigital.cl`). En Brevo, ve a **Domains → Add a domain** y crea en tu DNS los registros que te indique:
  - el TXT de verificación;
  - **DKIM**;
  - **SPF** (`v=spf1 include:spf.brevo.com ~all`, o agrega ese `include` a tu SPF actual);
  - **DMARC** (`v=DMARC1; p=none; rua=mailto:tu-correo`).
- Pide a quienes reciben avisos que marquen el primer correo como "No es spam" y agreguen el remitente a sus contactos.

**Alternativa, Resend:** exige un dominio verificado desde el principio (registros SPF y DKIM en tu DNS; plan gratis de 3.000 correos al mes). Variables: `MAIL_PROVIDER=resend` y `RESEND_API_KEY`.

### 3. Código en GitHub
1. Crea un repositorio en GitHub. Público es lo recomendado: no contiene secretos y da minutos ilimitados para el cron.
2. Súbelo:
   ```bash
   git remote add origin https://github.com/TU-USUARIO/cr-ora-por-ti.git
   git push -u origin master
   ```

### 4. Vercel
1. En https://vercel.com, ve a **Add New → Project** e importa el repositorio. En Framework Preset elige **Other**; el resto lo toma de `vercel.json`.
2. En **Environment Variables** agrega:
   - `DATABASE_URL`, `DIRECT_URL`;
   - `APP_URL` (por ahora `https://<nombre>.vercel.app`);
   - `SESSION_SECRET`, `CRON_SECRET`;
   - `MAIL_PROVIDER`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `BREVO_API_KEY`;
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
3. Toca **Deploy**. Si la URL final es distinta, corrige `APP_URL` y vuelve a desplegar.
4. Configura el cron. En GitHub ve a **Settings → Secrets → Actions**, agrega `APP_URL` y `CRON_SECRET`, y en **Actions → Enviar avisos** prueba con **Run workflow**. Si quieres respaldo, configura también cron-job.org (ver la sección del cron).

### 5. Prueba en un celular real (cierra la Etapa 4)
- [ ] En el celular, abre la URL de Vercel (en iPhone, con Safari).
- [ ] Agrégala a la pantalla de inicio (en iPhone siguiendo la guía; en Android con "Instalar app") y ábrela desde el ícono «CR ora».
- [ ] Entra con tu correo y el código de 6 dígitos.
- [ ] En Ajustes, toca **Activar avisos en este dispositivo** y acepta.
- [ ] Toca **Enviar notificación de prueba**: debe llegarte «CR ora por ti» en segundos, incluso con la app cerrada.
- [ ] Al tocar la notificación, se abre la app.
- [ ] Un joven de prueba anota una evaluación para dentro de ~1 hora. En el siguiente ciclo del cron te llega «Ora por …», y al tocarlo se abre esa tarjeta en la agenda.

## Migraciones

`prisma migrate dev` es interactivo. Si la terminal no lo permite, crea la migración con `prisma migrate diff`
y aplícala con `npm run db:deploy`.

## Seguridad

- Límite de intentos guardado en Postgres (en Vercel, la memoria no se comparte entre instancias). Por correo: 4 solicitudes de código cada 15 min y 5 intentos por código. Por red (IP), con margen para que 50 personas usen el mismo Wi-Fi de la iglesia: 40 solicitudes de código cada 15 min, 100 perfiles de joven y 400 evaluaciones por hora.
- Solo se guardan hashes de los códigos y enlaces.
- Las peticiones que modifican datos requieren el header `X-CR-App: 1` (protección CSRF) además de la cookie SameSite=Lax.
- Los logs nunca incluyen el cuerpo de las peticiones.
