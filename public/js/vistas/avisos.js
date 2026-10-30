// Tarjeta "Avisos en este dispositivo": estado, activar, notificación de prueba y guía para iPhone.
import { api } from '../api.js';
import { esc, conCarga, avisar, confirmar } from '../ui.js';
import * as push from '../push.js';

// Ilustraciones simples para la guía de iPhone.
const ICONO_COMPARTIR = `<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><rect x="12" y="18" width="24" height="24" rx="4" fill="none" stroke="#2563eb" stroke-width="3"/><path d="M24 6v24M16 13l8-8 8 8" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICONO_AGREGAR = `<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><rect x="8" y="8" width="32" height="32" rx="7" fill="none" stroke="#2563eb" stroke-width="3"/><path d="M24 16v16M16 24h16" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/></svg>`;
const ICONO_APP = `<img src="/icons/apple-touch-icon.png" width="44" height="44" alt="" style="border-radius:10px">`;

function guiaIphone(iosViejo) {
  return `
    <div class="tarjeta guia">
      <h2 style="margin-top:0">Activa los avisos en tu iPhone</h2>
      <p class="chico" style="margin-bottom:14px">En iPhone los avisos solo funcionan si agregas la app a tu pantalla de inicio. Es una sola vez:</p>
      ${iosViejo ? '<p class="error">Tu iPhone necesita iOS 16.4 o superior. Actualízalo en Ajustes › General › Actualización de software.</p>' : ''}
      <ol class="pasos">
        <li>${ICONO_COMPARTIR}<div><strong>1. Toca Compartir</strong><br><span class="chico">El cuadrado con flecha en la barra de Safari. Si no lo ves, toca ··· primero.</span></div></li>
        <li>${ICONO_AGREGAR}<div><strong>2. «Agregar a pantalla de inicio»</strong><br><span class="chico">Baja en la lista hasta encontrarlo y toca «Agregar».</span></div></li>
        <li>${ICONO_APP}<div><strong>3. Abre «CR ora» desde el ícono</strong><br><span class="chico">Ahí verás el botón «Activar avisos en este dispositivo».</span></div></li>
      </ol>
      <p class="chico">Dentro de la app instalada entra con tu correo y contraseña (la app guarda su sesión aparte de Safari).</p>
    </div>`;
}

function bloqueado(e) {
  const como = e.ios
    ? 'Abre <strong>Ajustes › Notificaciones › CR ora</strong> y activa «Permitir notificaciones».'
    : 'Toca el candado (o ⋮ › Información del sitio) junto a la dirección, entra a <strong>Notificaciones</strong> y elige «Permitir». Luego vuelve aquí.';
  return `<div class="tarjeta"><h2 style="margin-top:0">Los avisos están bloqueados</h2><p>${como}</p>
    <button class="btn secundario bloque" data-accion="reintentar" style="margin-top:12px">Ya los permití</button></div>`;
}

// modo: 'orante' | 'joven'
export async function montarTarjetaAvisos(contenedor, { modo = 'orante', resaltar = false } = {}) {
  const e = push.entorno();
  const intro = modo === 'joven'
    ? '¿Quieres que te preguntemos cómo te fue? Activa los avisos y responde con un toque.'
    : 'Te avisaremos antes de cada evaluación para orar, y después para escribirle al joven.';

  async function pintar() {
    if (e.ios && !e.instalada) return (contenedor.innerHTML = guiaIphone(e.iosViejo));
    if (e.iosViejo) return (contenedor.innerHTML = guiaIphone(true));
    if (!e.soporte) {
      contenedor.innerHTML = `<div class="tarjeta"><p>Este navegador no permite avisos. En Android ábrela en <strong>Chrome</strong>; en iPhone, en <strong>Safari</strong>.</p></div>`;
      return;
    }
    if (push.entorno().permiso === 'denied') return (contenedor.innerHTML = bloqueado(e));

    contenedor.innerHTML = '<div class="tarjeta"><p class="cargando">Revisando los avisos…</p></div>';
    let sub = null;
    let srv = { esteDispositivo: null, necesitaReactivar: false, disponible: true };
    try {
      sub = await push.suscripcionActual();
      srv = await push.estadoServidor(sub);
    } catch {
      /* se muestra como no activos */
    }
    const activo = !!(sub && srv.esteDispositivo?.activa && push.entorno().permiso === 'granted');
    const instalar = e.android && !e.instalada && push.puedeInstalar()
      ? '<button class="btn texto bloque" data-accion="instalar">Instalar la app en este dispositivo</button>'
      : '';

    if (activo) {
      contenedor.innerHTML = `
        <div class="tarjeta estado-push bien ${resaltar ? 'resaltada' : ''}">
          <p style="margin-bottom:12px">Avisos en este dispositivo: <strong>activos</strong></p>
          <button class="btn bloque" data-accion="prueba">Enviar notificación de prueba</button>
          <button class="btn texto bloque" data-accion="desactivar">Desactivar en este dispositivo</button>
          ${instalar}
        </div>`;
      return;
    }

    const fallaron = srv.necesitaReactivar || (sub && srv.esteDispositivo && !srv.esteDispositivo.activa);
    contenedor.innerHTML = `
      <div class="tarjeta ${fallaron ? 'estado-push mal' : ''} ${resaltar ? 'resaltada' : ''}">
        <p style="margin-bottom:12px">${fallaron
          ? '<strong>Tus avisos dejaron de funcionar.</strong> Vuelve a activarlos en este dispositivo.'
          : `Avisos en este dispositivo: <strong>no activos</strong>.<br><span class="chico">${esc(intro)}</span>`}</p>
        ${srv.disponible === false ? '<p class="error">El servidor aún no tiene configuradas las claves de avisos.</p>' : ''}
        <p class="error error-accion" hidden></p>
        <button class="btn bloque" data-accion="activar">Activar avisos en este dispositivo</button>
        ${instalar}
      </div>`;
  }

  contenedor.onclick = async (ev) => {
    const boton = ev.target.closest('button[data-accion]');
    if (!boton) return;
    const accion = boton.dataset.accion;
    const cajaError = contenedor.querySelector('.error-accion');
    if (accion === 'activar') {
      // Sin esperas antes de pedir el permiso (requisito de iPhone).
      await conCarga(boton, cajaError, async () => {
        try {
          await push.activar();
          avisar('Listo, avisos activados en este dispositivo');
        } catch (err) {
          if (err.bloqueado) return pintar();
          throw err;
        }
        await pintar();
      });
    } else if (accion === 'prueba') {
      await conCarga(boton, null, async () => {
        await api('/push/prueba', { metodo: 'POST' });
        avisar('Enviada. Debería llegarte en unos segundos.');
      });
    } else if (accion === 'desactivar') {
      if (!(await confirmar('Dejarán de llegarte notificaciones en este dispositivo.', { titulo: '¿Desactivar avisos?', aceptar: 'Desactivar' }))) return;
      await push.desactivar();
      await pintar();
    } else if (accion === 'reintentar') {
      e.permiso = push.entorno().permiso;
      await pintar();
    } else if (accion === 'instalar') {
      if (await push.instalar()) avisar('¡App instalada!');
      await pintar();
    }
  };

  document.addEventListener('cr-instalable', () => pintar(), { once: true });
  await pintar();
  if (resaltar) contenedor.scrollIntoView({ block: 'center' });
}
