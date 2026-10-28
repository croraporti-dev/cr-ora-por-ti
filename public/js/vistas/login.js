import { api, memoria } from '../api.js';
import { pintar, conCarga, esc } from '../ui.js';

const AVISO_PRIVACIDAD = `Solo guardamos el <strong>ramo, el tipo, la fecha y la hora</strong> de tus pruebas y trabajos,
para que un pequeño grupo de la iglesia ore por ti. <strong>Nunca</strong> guardamos notas ni calificaciones.
Puedes borrar tus evaluaciones cuando quieras.`;

export function vistaLogin({ irA, pestana = 'entrar' }) {
  const vista = pintar(`
    <h1>Te acompañamos en oración</h1>
    <p class="sub">Registra tus pruebas y trabajos, y un grupo de la iglesia orará por ti.</p>
    <div class="pestanas" role="tablist">
      <button role="tab" data-pestana="entrar" aria-selected="${pestana === 'entrar'}">Entrar</button>
      <button role="tab" data-pestana="registro" aria-selected="${pestana === 'registro'}">Soy nuevo/a</button>
    </div>

    <form id="f-entrar" class="tarjeta" ${pestana === 'entrar' ? '' : 'hidden'} novalidate>
      <label class="campo"><span>Tu correo</span>
        <input type="email" name="email" autocomplete="email" inputmode="email" required></label>
      <p class="error" hidden></p>
      <button class="btn bloque">Enviarme un código</button>
      <p class="chico" style="margin-top:12px">Te llegará un código de 6 dígitos. No necesitas contraseña.</p>
    </form>

    <form id="f-registro" class="tarjeta" ${pestana === 'registro' ? '' : 'hidden'} novalidate>
      <label class="campo"><span>Código de invitación</span>
        <input type="text" name="codigoInvitacion" autocomplete="off" autocapitalize="characters" placeholder="CR-XXXXXX" required></label>
      <label class="campo"><span>Tu nombre</span>
        <input type="text" name="nombre" autocomplete="given-name" maxlength="40" required></label>
      <label class="campo"><span>Tu correo</span>
        <input type="email" name="email" autocomplete="email" inputmode="email" required></label>
      <span class="campo" style="margin-bottom:6px"><span>¿Cómo quieres participar?</span></span>
      <div class="opciones">
        <label class="opcion"><input type="radio" name="rol" value="JOVEN" checked><span>📚 Soy joven</span></label>
        <label class="opcion"><input type="radio" name="rol" value="ORANTE"><span>🙏 Quiero orar</span></label>
      </div>
      <div class="aviso-privacidad">${AVISO_PRIVACIDAD}</div>
      <label class="check"><input type="checkbox" name="aceptaAviso"><span>Leí y acepto el aviso.</span></label>
      <label class="check"><input type="checkbox" name="esMenor"><span>Soy menor de 18 años.</span></label>
      <label class="check" id="c-apoderado" hidden><input type="checkbox" name="apoderado"><span>Mi apoderado está en conocimiento de que uso esta app.</span></label>
      <p class="error" hidden></p>
      <button class="btn bloque">Registrarme</button>
    </form>
  `);

  vista.querySelectorAll('[data-pestana]').forEach((b) =>
    b.addEventListener('click', () => irA(b.dataset.pestana === 'registro' ? '#/registro' : '#/login'))
  );

  const fRegistro = vista.querySelector('#f-registro');
  fRegistro.esMenor.addEventListener('change', () => {
    vista.querySelector('#c-apoderado').hidden = !fRegistro.esMenor.checked;
  });

  async function solicitar(form, datos) {
    await conCarga(form.querySelector('button'), form.querySelector('.error'), async () => {
      const r = await api('/auth/solicitar', { metodo: 'POST', datos });
      memoria.guardar('cr_email', datos.email);
      memoria.guardar('cr_mensaje', r.mensaje);
      irA('#/codigo');
    });
  }

  vista.querySelector('#f-entrar').addEventListener('submit', (e) => {
    e.preventDefault();
    solicitar(e.target, { modo: 'login', email: e.target.email.value.trim() });
  });

  fRegistro.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    solicitar(f, {
      modo: 'registro',
      codigoInvitacion: f.codigoInvitacion.value,
      nombre: f.nombre.value,
      email: f.email.value.trim(),
      rol: f.rol.value,
      aceptaAviso: f.aceptaAviso.checked,
      esMenor: f.esMenor.checked,
      apoderado: f.apoderado.checked
    });
  });
}

export function vistaCodigo({ irA, alEntrar }) {
  const email = memoria.leer('cr_email');
  if (!email) return irA('#/login');
  const vista = pintar(`
    <h1>Revisa tu correo</h1>
    <p class="sub">${esc(memoria.leer('cr_mensaje') || 'Te enviamos un código de 6 dígitos.')}<br>
      <span class="chico">Enviado a ${esc(email)}</span></p>
    <form class="tarjeta" novalidate>
      <label class="campo"><span>Código de 6 dígitos</span>
        <input class="codigo-input" name="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" required></label>
      <p class="error" hidden></p>
      <button class="btn bloque">Entrar</button>
    </form>
    <button class="btn texto" id="otro">Usar otro correo o pedir un código nuevo</button>
  `);
  const form = vista.querySelector('form');
  form.codigo.focus();
  form.codigo.addEventListener('input', () => {
    form.codigo.value = form.codigo.value.replace(/\D/g, '').slice(0, 6);
    if (form.codigo.value.length === 6) form.requestSubmit();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    conCarga(form.querySelector('button'), form.querySelector('.error'), async () => {
      const r = await api('/auth/verificar', { metodo: 'POST', datos: { email, codigo: form.codigo.value } });
      alEntrar(r.user);
    });
  });
  vista.querySelector('#otro').addEventListener('click', () => irA('#/login'));
}

// Enlace mágico: /#/entrar?t=... (la app hace el POST, no el antivirus del correo).
export async function vistaEnlace({ irA, alEntrar, params }) {
  const vista = pintar(`<p class="cargando">Entrando…</p>`);
  try {
    const r = await api('/auth/enlace', { metodo: 'POST', datos: { t: params.get('t') || '' } });
    alEntrar(r.user);
  } catch (err) {
    vista.innerHTML = `<h1>No pudimos entrar</h1><p class="error">${esc(err.message)}</p>
      <a class="btn bloque" href="#/login">Pedir un código nuevo</a>`;
  }
  void irA;
}
