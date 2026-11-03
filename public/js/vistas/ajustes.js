// Ajustes de avisos (orantes y líder). Se guarda solo al cambiar cada opción.
import { api } from '../api.js';
import { pintar, esc, avisar, conCarga, confirmar } from '../ui.js';
import { montarTarjetaAvisos } from './avisos.js';
import * as push from '../push.js';
import { leerTema, aplicarTema } from '../tema.js';

const ANTICIPACIONES = [
  ['TREINTA_MIN', '30 minutos antes'],
  ['UNA_HORA', '1 hora antes'],
  ['DOS_HORAS', '2 horas antes'],
  ['TRES_HORAS', '3 horas antes']
];
const HORAS_DIA_ANTERIOR = [17, 18, 19, 20, 21, 22];

function interruptor(nombre, activo, titulo, detalle) {
  return `
    <label class="interruptor">
      <span><strong>${titulo}</strong><span class="chico">${detalle}</span></span>
      <input type="checkbox" role="switch" name="${nombre}" ${activo ? 'checked' : ''}>
    </label>`;
}

// Pasos por si los avisos no llegan o llegan tarde. Se abre primero el del sistema del celular.
function ayudaAvisos() {
  const { ios, android } = push.entorno();
  const iphone = `
    <details class="ayuda" ${ios ? 'open' : ''}>
      <summary>En iPhone</summary>
      <ol>
        <li>Abre la app desde el ícono «CR Juntos» de tu pantalla de inicio (no desde Safari).</li>
        <li>En <strong>Ajustes › Notificaciones › CR Juntos</strong>, activa «Permitir notificaciones».</li>
        <li>Si usas un modo de <strong>Concentración</strong> (No molestar, Dormir), agrega CR Juntos a las apps permitidas.</li>
      </ol>
    </details>`;
  const androide = `
    <details class="ayuda" ${android ? 'open' : ''}>
      <summary>En Android</summary>
      <ol>
        <li>Instala la app: en Chrome toca <strong>⋮ › Instalar app</strong> (o «Agregar a la pantalla principal»).</li>
        <li>Para que no lleguen tarde: <strong>Ajustes › Apps › Chrome › Batería</strong> y elige «Sin restricciones».</li>
        <li>En <strong>Ajustes › Apps › Chrome › Notificaciones</strong>, revisa que estén permitidas.</li>
      </ol>
    </details>`;
  return `
    <div class="tarjeta">
      <h2 style="margin-top:0">¿No te llegan los avisos o llegan tarde?</h2>
      <p class="chico" style="margin-bottom:8px">Casi siempre es un ajuste del celular. Revisa estos pasos:</p>
      ${ios ? iphone + androide : androide + iphone}
    </div>`;
}

function prefsDesdeFormulario(f) {
  const antes = f.antes.checked;
  const despues = f.despues.checked;
  // Por ahora los avisos son solo notificaciones en el dispositivo (no se envían correos).
  return {
    pushAntes: antes,
    pushDespues: despues,
    emailAntes: false,
    emailDespues: false,
    tambienCorreo: false,
    anticipacion: f.anticipacion.value,
    diaAnterior: f.diaAnterior.checked,
    horaDiaAnterior: Number(f.horaDiaAnterior.value)
  };
}

export async function vistaAjustes({ params, user, irA }) {
  const vista = pintar('<h1>Ajustes</h1><div class="esqueleto esqueleto-tarjeta"></div><div class="esqueleto esqueleto-tarjeta alta"></div>');
  let datos;
  try {
    datos = await api('/ajustes');
  } catch (err) {
    vista.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    return;
  }
  const { prefs } = datos;
  const antes = prefs.pushAntes || prefs.emailAntes;
  const despues = prefs.pushDespues || prefs.emailDespues;

  vista.innerHTML = `
    <h1>Ajustes</h1>
    <div id="caja-push"></div>
    <form id="f-ajustes">
      <div class="tarjeta">
        <div class="titulo-con-estado">
          <h2>¿Cuándo avisarte?</h2>
          <span class="estado-guardado" id="guardado" role="status" aria-live="polite"></span>
        </div>
        <p class="chico" style="margin-bottom:6px">Puedes activar uno, varios o ninguno. Se guarda solo.</p>
        ${interruptor('diaAnterior', prefs.diaAnterior, 'El día anterior', 'Para tenerlo presente y orar con tiempo.')}
        <label class="campo sub-opcion" id="c-dia-anterior"><span class="chico">¿A qué hora?</span>
          <select name="horaDiaAnterior">${HORAS_DIA_ANTERIOR.map((h) => `<option value="${h}" ${h === prefs.horaDiaAnterior ? 'selected' : ''}>${h}:00</option>`).join('')}</select>
        </label>
        ${interruptor('antes', antes, 'Antes de la evaluación', 'Para orar justo en el momento.')}
        <label class="campo sub-opcion" id="c-anticipacion"><span class="chico">¿Con cuánta anticipación?</span>
          <select name="anticipacion">${ANTICIPACIONES.map(([k, t]) => `<option value="${k}" ${k === prefs.anticipacion ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </label>
        ${interruptor('despues', despues, 'Después', '2 horas más tarde, para escribirle y preguntarle cómo le fue.')}
      </div>
      <p class="chico">Recibirás avisos de todos los jóvenes del grupo como notificaciones en este dispositivo.</p>
    </form>

    <div class="tarjeta">
      <h2 style="margin-top:0">Apariencia</h2>
      <div class="segmentado tres" role="group" aria-label="Apariencia" id="tema">
        ${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, t]) => `<button type="button" data-tema="${v}" aria-pressed="${leerTema() === v}">${t}</button>`).join('')}
      </div>
      <p class="chico">Automático usa el mismo modo que tu celular. Se guarda en este dispositivo.</p>
    </div>

    ${ayudaAvisos()}

    <form id="f-clave" class="tarjeta" novalidate style="margin-top:14px">
      <h2 style="margin-top:0">Cambiar contraseña</h2>
      <label class="campo"><span>Contraseña actual</span><input type="password" name="actual" autocomplete="current-password" required></label>
      <label class="campo"><span>Nueva contraseña (mínimo 8 caracteres)</span><input type="password" name="nueva" autocomplete="new-password" minlength="8" required></label>
      <p class="error" hidden></p>
      <button type="submit" class="btn secundario bloque">Cambiar contraseña</button>
      <p class="chico" style="margin-top:10px">Se cerrará tu sesión en los demás dispositivos.</p>
    </form>

    <div class="tarjeta cuenta">
      <div><strong>${esc([user.nombre, user.apellido].filter(Boolean).join(' '))}</strong><span class="chico">${esc(user.email || '')}</span></div>
      <button type="button" class="btn texto peligro-texto" id="salir">Cerrar sesión</button>
    </div>
  `;

  vista.querySelector('#salir').addEventListener('click', async () => {
    if (await confirmar('Para volver a entrar necesitarás tu correo y contraseña.', { titulo: '¿Cerrar sesión?', aceptar: 'Cerrar sesión' })) irA('#/salir');
  });

  const fClave = vista.querySelector('#f-clave');
  fClave.addEventListener('submit', (e) => {
    e.preventDefault();
    conCarga(fClave.querySelector('button[type=submit]'), fClave.querySelector('.error'), async () => {
      await api('/yo/clave', { metodo: 'POST', datos: { actual: fClave.actual.value, nueva: fClave.nueva.value } });
      fClave.reset();
      avisar('Contraseña cambiada');
    });
  });

  montarTarjetaAvisos(vista.querySelector('#caja-push'), { modo: 'orante', resaltar: params.get('reactivar') === '1' });

  const f = vista.querySelector('#f-ajustes');
  const sincronizar = () => {
    vista.querySelector('#c-anticipacion').hidden = !f.antes.checked;
    vista.querySelector('#c-dia-anterior').hidden = !f.diaAnterior.checked;
  };
  sincronizar();

  vista.querySelector('#tema').addEventListener('click', (e) => {
    const boton = e.target.closest('button[data-tema]');
    if (!boton) return;
    aplicarTema(boton.dataset.tema);
    vista.querySelectorAll('#tema button').forEach((b) => b.setAttribute('aria-pressed', String(b === boton)));
  });

  const guardado = vista.querySelector('#guardado');
  let borrarEstado;
  f.addEventListener('change', async () => {
    sincronizar();
    clearTimeout(borrarEstado);
    guardado.className = 'estado-guardado';
    guardado.textContent = 'Guardando…';
    try {
      await api('/ajustes', { metodo: 'PUT', datos: prefsDesdeFormulario(f) });
      guardado.classList.add('listo');
      guardado.textContent = 'Guardado';
      borrarEstado = setTimeout(() => { guardado.textContent = ''; }, 2500);
    } catch (err) {
      guardado.classList.add('error-guardado');
      guardado.textContent = 'No se guardó';
      avisar(err.message);
    }
  });
}
