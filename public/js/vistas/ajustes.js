// Ajustes de avisos (orantes y líder). Se guarda solo al cambiar cada opción.
import { api } from '../api.js';
import { pintar, esc, avisar, conCarga } from '../ui.js';
import { montarTarjetaAvisos } from './avisos.js';

const ANTICIPACIONES = [
  ['UNA_HORA', '1 hora antes'],
  ['TRES_HORAS', '3 horas antes'],
  ['NOCHE_ANTERIOR_20H', 'La noche anterior, a las 20:00']
];

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
    anticipacion: f.anticipacion.value
  };
}

export async function vistaAjustes({ params }) {
  const vista = pintar('<p class="cargando">Cargando…</p>');
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
        <h2 style="margin-top:0">¿Cuándo avisarte?</h2>
        <label class="check"><input type="checkbox" name="antes" ${antes ? 'checked' : ''}><span><strong>Antes</strong> de cada evaluación, para orar</span></label>
        <label class="campo" id="c-anticipacion" style="margin:-4px 0 14px 34px"><span class="chico">¿Con cuánta anticipación?</span>
          <select name="anticipacion">${ANTICIPACIONES.map(([k, t]) => `<option value="${k}" ${k === prefs.anticipacion ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </label>
        <label class="check"><input type="checkbox" name="despues" ${despues ? 'checked' : ''}><span><strong>Después</strong> (2 horas más tarde), para escribirle y preguntarle cómo le fue</span></label>
      </div>
      <p class="chico">Recibirás avisos de todos los jóvenes del grupo como notificaciones en este dispositivo.</p>
    </form>

    <form id="f-clave" class="tarjeta" novalidate style="margin-top:14px">
      <h2 style="margin-top:0">Cambiar contraseña</h2>
      <label class="campo"><span>Contraseña actual</span><input type="password" name="actual" autocomplete="current-password" required></label>
      <label class="campo"><span>Nueva contraseña (mínimo 8 caracteres)</span><input type="password" name="nueva" autocomplete="new-password" minlength="8" required></label>
      <p class="error" hidden></p>
      <button type="submit" class="btn secundario bloque">Cambiar contraseña</button>
      <p class="chico" style="margin-top:10px">Se cerrará tu sesión en los demás dispositivos.</p>
    </form>
  `;

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
  };
  sincronizar();

  f.addEventListener('change', async () => {
    sincronizar();
    try {
      await api('/ajustes', { metodo: 'PUT', datos: prefsDesdeFormulario(f) });
      avisar('Guardado');
    } catch (err) {
      avisar(err.message);
    }
  });
}
