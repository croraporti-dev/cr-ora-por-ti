// Acceso de orantes y líderes: correo + contraseña. Sumarse solo con el enlace de invitación.
import { api, memoria } from '../api.js';
import { pintar, conCarga, esc } from '../ui.js';

const AVISO_PRIVACIDAD = `Verás los nombres y las fechas de evaluación de los jóvenes.
Úsalo solo para orar por ellos y <strong>no compartas esta información</strong> fuera del grupo.`;

// Campo de contraseña con botón "Mostrar" (más fácil en el celular).
function campoClave(nombre, etiqueta, autocompletar) {
  return `
    <label class="campo"><span>${etiqueta}</span>
      <div class="clave">
        <input type="password" name="${nombre}" autocomplete="${autocompletar}" minlength="8" required>
        <button type="button" class="btn texto" data-mostrar>Mostrar</button>
      </div>
    </label>`;
}

function conectarMostrar(contenedor) {
  contenedor.querySelectorAll('[data-mostrar]').forEach((b) =>
    b.addEventListener('click', () => {
      const input = b.previousElementSibling;
      const ver = input.type === 'password';
      input.type = ver ? 'text' : 'password';
      b.textContent = ver ? 'Ocultar' : 'Mostrar';
    })
  );
}

// El enlace de invitación (#/unirse?i=...) se recuerda mientras la persona cambia de pestaña.
export function vistaLogin({ irA, params, alEntrar, pestana = 'entrar' }) {
  if (params?.get('i')) memoria.guardar('cr_invitacion', params.get('i'));
  const invitacion = memoria.leer('cr_invitacion');
  const vista = pintar(`
    <h1>Entrar para orar</h1>
    <p class="sub">Para quienes quieren orar por los jóvenes. ¿Eres joven? <a href="#/mis">Anota tu prueba aquí</a>, sin cuenta.</p>
    <div class="pestanas" role="tablist">
      <button role="tab" data-pestana="entrar" aria-selected="${pestana === 'entrar'}">Entrar</button>
      <button role="tab" data-pestana="registro" aria-selected="${pestana === 'registro'}">Quiero sumarme</button>
    </div>

    <form id="f-entrar" class="tarjeta" ${pestana === 'entrar' ? '' : 'hidden'} novalidate>
      <label class="campo"><span>Correo</span>
        <input type="email" name="email" autocomplete="email" inputmode="email" required></label>
      ${campoClave('password', 'Contraseña', 'current-password')}
      <p class="error" hidden></p>
      <button type="submit" class="btn bloque">Entrar</button>
      <p class="chico" style="margin-top:12px">¿Olvidaste tu contraseña? Pide a quien administra el grupo que te envíe un enlace para crear una nueva.</p>
    </form>

    <div class="tarjeta" ${pestana === 'registro' && !invitacion ? '' : 'hidden'}>
      <p>Para sumarte al grupo de oración necesitas el <strong>enlace de invitación</strong>. Pídeselo a quien te invitó a orar y ábrelo en este dispositivo.</p>
    </div>

    <form id="f-registro" class="tarjeta" ${pestana === 'registro' && invitacion ? '' : 'hidden'} novalidate>
      <p class="chico" style="margin-bottom:14px">Después de registrarte, alguien del equipo revisará tu solicitud. Cuando te aprueben podrás ver la agenda.</p>
      <label class="campo"><span>Tu nombre</span>
        <input type="text" name="nombre" autocomplete="given-name" maxlength="40" required></label>
      <label class="campo"><span>Tu correo</span>
        <input type="email" name="email" autocomplete="email" inputmode="email" required></label>
      ${campoClave('password', 'Crea una contraseña (mínimo 8 caracteres)', 'new-password')}
      <div class="aviso-privacidad">${AVISO_PRIVACIDAD}</div>
      <label class="check"><input type="checkbox" name="aceptaAviso"><span>Me comprometo a cuidar esta información.</span></label>
      <p class="error" hidden></p>
      <button type="submit" class="btn bloque">Sumarme al grupo de oración</button>
    </form>
  `);

  conectarMostrar(vista);
  vista.querySelectorAll('[data-pestana]').forEach((b) =>
    b.addEventListener('click', () => irA(b.dataset.pestana === 'registro' ? '#/registro' : '#/login'))
  );

  const fEntrar = vista.querySelector('#f-entrar');
  fEntrar.addEventListener('submit', (e) => {
    e.preventDefault();
    conCarga(fEntrar.querySelector('button[type=submit]'), fEntrar.querySelector('.error'), async () => {
      await api('/auth/entrar', { metodo: 'POST', datos: { email: fEntrar.email.value.trim(), password: fEntrar.password.value } });
      await alEntrar();
    });
  });

  const fRegistro = vista.querySelector('#f-registro');
  fRegistro.addEventListener('submit', (e) => {
    e.preventDefault();
    conCarga(fRegistro.querySelector('button[type=submit]'), fRegistro.querySelector('.error'), async () => {
      await api('/auth/registro', {
        metodo: 'POST',
        datos: {
          invitacion,
          nombre: fRegistro.nombre.value,
          email: fRegistro.email.value.trim(),
          password: fRegistro.password.value,
          aceptaAviso: fRegistro.aceptaAviso.checked
        }
      });
      await alEntrar();
    });
  });
}

// #/clave?t=... — crear o cambiar la contraseña con el enlace de un solo uso.
export async function vistaClave({ params, alEntrar }) {
  const t = params.get('t') || '';
  const vista = pintar('<p class="cargando">Revisando el enlace…</p>');
  let datos;
  try {
    datos = await api(`/auth/clave?t=${encodeURIComponent(t)}`);
  } catch (err) {
    vista.innerHTML = `<h1>Enlace no válido</h1><p class="error">${esc(err.message)}</p>
      <a class="btn secundario bloque" href="#/login">Ir a entrar</a>`;
    return;
  }
  vista.innerHTML = `
    <h1>Hola, ${esc(datos.nombre)}</h1>
    <p class="sub">Crea tu contraseña para entrar con <strong>${esc(datos.email)}</strong>.</p>
    <form class="tarjeta" novalidate>
      ${campoClave('password', 'Nueva contraseña (mínimo 8 caracteres)', 'new-password')}
      ${campoClave('repetir', 'Repítela', 'new-password')}
      <p class="error" hidden></p>
      <button type="submit" class="btn bloque">Guardar y entrar</button>
    </form>`;
  conectarMostrar(vista);
  const f = vista.querySelector('form');
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const caja = f.querySelector('.error');
    if (f.password.value !== f.repetir.value) {
      caja.textContent = 'Las contraseñas no coinciden.';
      caja.hidden = false;
      return;
    }
    conCarga(f.querySelector('button[type=submit]'), caja, async () => {
      await api('/auth/clave', { metodo: 'POST', datos: { t, password: f.password.value } });
      await alEntrar();
    });
  });
}
