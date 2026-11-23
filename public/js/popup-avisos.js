// Popup que invita a instalar la app o a activar los avisos (solo orantes y líderes, en Android o iPhone).
// Cada mensaje sale UNA sola vez por dispositivo. Con AUTOMATICO en false solo aparece al abrir
// la Agenda con ?popup=avisos | bloqueados | instalar | iphone (modo de prueba: no se recuerda que se vio).
import { esc, avisar } from './ui.js';
import * as push from './push.js';

const AUTOMATICO = true;
const CLAVE_INSTALAR = 'cr_popup_instalar';
const CLAVE_AVISOS = 'cr_popup_avisos';

const ICONO = {
  campana: '<path d="M6 17h12l-1.5-2V11a4.5 4.5 0 0 0-9 0v4L6 17zM10 20a2 2 0 0 0 4 0"/>',
  campanaNo: '<path d="M6 17h12l-1.5-2V11a4.5 4.5 0 0 0-9 0v4L6 17zM10 20a2 2 0 0 0 4 0M4 4l16 16"/>',
  celular: '<path d="M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2"/>'
};

const VARIANTES = {
  avisos: {
    clave: CLAVE_AVISOS, icono: 'campana',
    titulo: 'Activa los avisos',
    texto: 'Te avisamos cuando alguien tenga una prueba, para que ores justo a tiempo. Puedes elegir cuándo en Ajustes.',
    boton: 'Activar avisos'
  },
  bloqueados: {
    clave: CLAVE_AVISOS, icono: 'campanaNo', alerta: true,
    titulo: 'Los avisos están bloqueados',
    texto: 'Para recibirlos, permite las notificaciones de CR Juntos en los ajustes de tu celular.',
    boton: 'Ver cómo permitirlos',
    pasos: (e) => (e.ios
      ? ['Abre Ajustes del iPhone › Notificaciones › CR Juntos.', 'Activa «Permitir notificaciones».', 'Vuelve a la app.']
      : ['Mantén presionado el ícono de CR Juntos y toca «Información de la app».', 'Entra a «Notificaciones» y permítelas.', 'Vuelve a la app.'])
  },
  instalar: {
    clave: CLAVE_INSTALAR, icono: 'celular',
    titulo: 'Instala la app en tu celular',
    texto: 'Ábrela como cualquier otra app y recibe los avisos de las pruebas.',
    boton: 'Instalar la app',
    pasos: () => ['Toca el menú ⋮ de Chrome, arriba a la derecha.', 'Elige «Instalar aplicación».', 'Confirma y abre «CR Juntos» desde el ícono.']
  },
  iphone: {
    clave: CLAVE_INSTALAR, icono: 'celular',
    titulo: 'Instala la app para recibir avisos',
    texto: 'En iPhone los avisos solo funcionan con la app en tu pantalla de inicio. Es una sola vez.',
    boton: 'Ver cómo instalarla',
    pasos: () => ['Toca Compartir, el cuadrado con una flecha, en la barra de Safari.', 'Baja y toca «Agregar a pantalla de inicio».', 'Abre «CR Juntos» desde el ícono nuevo.', 'Requiere iOS 16.4 o superior.']
  }
};

function yaLoVio(clave) {
  try { return localStorage.getItem(clave) === '1'; } catch { return false; }
}
function marcarVisto(clave) {
  try { localStorage.setItem(clave, '1'); } catch { /* sin almacenamiento: se mostraría de nuevo, no pasa nada */ }
}

// Qué mensaje corresponde a este dispositivo (solo en modo automático).
async function elegir(user) {
  if (!user || user.pendiente || user.rol === 'JOVEN') return null;
  const e = push.entorno();
  if (!e.ios && !e.android) return null; // computador: sin popup
  if (!e.instalada) {
    const v = e.ios ? 'iphone' : 'instalar';
    return yaLoVio(CLAVE_INSTALAR) ? null : v;
  }
  if (!e.soporte || yaLoVio(CLAVE_AVISOS)) return null;
  const sub = await push.suscripcionActual().catch(() => null);
  if (e.permiso === 'granted' && sub) return null; // ya tiene los avisos
  return e.permiso === 'denied' ? 'bloqueados' : 'avisos';
}

function pasosHtml(pasos) {
  return `<ol class="popup-pasos">${pasos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>`;
}

function abrir(nombre, probando) {
  const v = VARIANTES[nombre];
  const e = push.entorno();
  const dialogo = document.createElement('dialog');
  dialogo.className = 'dialogo popup-avisos';
  dialogo.setAttribute('aria-labelledby', 'pa-titulo');
  const cabecera = `<div class="popup-icono ${v.alerta ? 'alerta' : ''}"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONO[v.icono]}</svg></div>`;

  const portada = () => {
    dialogo.innerHTML = `${cabecera}
      <h2 id="pa-titulo">${esc(v.titulo)}</h2>
      <p>${esc(v.texto)}</p>
      <div class="popup-botones">
        <button type="button" class="btn bloque" data-accion="principal">${esc(v.boton)}</button>
        <button type="button" class="btn texto bloque" data-accion="cerrar">Ahora no</button>
      </div>`;
  };
  const pasos = () => {
    dialogo.innerHTML = `${cabecera}
      <h2 id="pa-titulo">${esc(v.titulo)}</h2>
      ${pasosHtml(v.pasos(e))}
      <div class="popup-botones"><button type="button" class="btn bloque" data-accion="cerrar">Entendido</button></div>`;
  };

  dialogo.addEventListener('click', async (ev) => {
    if (ev.target === dialogo) return dialogo.close();
    const boton = ev.target.closest('button[data-accion]');
    if (!boton) return;
    if (boton.dataset.accion === 'cerrar') return dialogo.close();
    // Botón principal, según el mensaje.
    if (nombre === 'avisos') {
      boton.disabled = true;
      try {
        await push.activar();
        dialogo.close();
        avisar('Avisos activados');
      } catch (err) {
        dialogo.close();
        avisar(err.message);
      }
    } else if (nombre === 'instalar' && push.puedeInstalar()) {
      await push.instalar();
      dialogo.close();
    } else {
      pasos();
    }
  });
  dialogo.addEventListener('close', () => {
    if (!probando) marcarVisto(v.clave);
    dialogo.remove();
  });
  portada();
  document.body.append(dialogo);
  dialogo.showModal();
}

// params: los de la ruta (?popup=... abre el modo de prueba).
export async function mostrarPopupAvisos({ user, params }) {
  if (!user || user.pendiente) return;
  if (document.querySelector('dialog[open]')) return;
  const prueba = params?.get('popup');
  if (prueba && VARIANTES[prueba]) return abrir(prueba, true);
  if (!AUTOMATICO) return;
  const nombre = await elegir(user);
  if (nombre) abrir(nombre, false);
}
