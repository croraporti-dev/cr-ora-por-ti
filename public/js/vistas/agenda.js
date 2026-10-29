// Agenda de oración (orantes y líder).
import { api } from '../api.js';
import { pintar, esc, avisar, confirmar } from '../ui.js';
import { ANIMOS, nombreTipo } from '../textos.js';
import { grupo, partesChile, cuando } from '../fechas.js';

const GRUPOS = [
  ['hoy', 'Hoy'],
  ['manana', 'Mañana'],
  ['semana', 'Esta semana'],
  ['despues', 'Más adelante'],
  ['pasadas', 'Hace poco']
];

// "+56912345678" → "+56 9 1234 5678"
function formatoCelular(t) {
  const m = /^\+56(9)(\d{4})(\d{4})$/.exec(t || '');
  return m ? `+56 ${m[1]} ${m[2]} ${m[3]}` : t || '';
}

// Celular (toca para llamar) y botón para escribirle por WhatsApp.
function contacto(joven) {
  if (!joven.telefono) return '';
  const numero = joven.telefono.replace('+', '');
  return `
    <div class="ev-contacto">
      <a href="tel:${esc(joven.telefono)}">${esc(formatoCelular(joven.telefono))}</a>
      <a class="btn-whatsapp" href="https://wa.me/${esc(numero)}" target="_blank" rel="noopener">WhatsApp</a>
    </div>`;
}

function tarjeta(e, user) {
  const pasada = grupo(e.fechaHora) === 'pasadas' || new Date(e.fechaHora) < new Date();
  const hora = ['hoy', 'manana'].includes(grupo(e.fechaHora)) ? partesChile(e.fechaHora).hora : cuando(e.fechaHora);
  const animo = e.resultadoAnimo
    ? `<span class="etiqueta ${e.resultadoAnimo === 'NECESITA_ORACION' ? 'urgente' : ''}">${ANIMOS[e.resultadoAnimo].etiqueta}</span>`
    : '';
  return `
    <article class="tarjeta evaluacion" id="ev-${esc(e.id)}" data-id="${esc(e.id)}">
      <strong class="ev-nombre">${esc(e.joven.nombre)}</strong>
      ${contacto(e.joven)}
      <div class="ev-titulo">${esc(nombreTipo(e))} de ${esc(e.ramo)} ${animo}</div>
      <div class="ev-cuando">${esc(hora)}${pasada && !e.resultadoAnimo ? ' · ya pasó' : ''}</div>
      <div class="ev-pie">
        <span class="oraron">${e.oraciones ? `Ya están orando por ${esc(e.joven.nombre)}` : ''}</span>
        <button class="btn ${e.yoOre ? 'secundario' : 'orar'}" data-accion="orar" aria-pressed="${e.yoOre}">${e.yoOre ? 'Oraste' : 'Ya oré'}</button>
      </div>
      ${user.rol === 'LIDER' ? '<button class="btn texto peligro-texto chico" data-accion="quitar">Quitar evaluación</button>' : ''}
    </article>`;
}

// Aviso al abrir la app si los avisos del dispositivo fallaron o nunca se activaron.
function bannerAvisos(avisos) {
  if (!avisos) return '';
  if (avisos.necesitaReactivar) {
    return `<a class="banner mal" href="#/ajustes?reactivar=1"><span>Tus avisos dejaron de llegar a este dispositivo. <strong>Toca aquí para reactivarlos.</strong></span></a>`;
  }
  if (avisos.quierePush && !avisos.pushActivas) {
    return `<a class="banner" href="#/ajustes?reactivar=1"><span>Activa los avisos en este dispositivo para saber cuándo orar. <strong>Activar</strong></span></a>`;
  }
  return '';
}

export async function vistaAgenda({ user, params, avisos }) {
  const vista = pintar(`
    ${bannerAvisos(avisos)}
    <h1>Agenda de oración</h1>
    <div id="lista"><p class="cargando">Cargando…</p></div>
    <p class="chico" style="text-align:center;margin-top:20px">¿Tú también tienes una prueba o examen? <a href="#/mis">Anótalo aquí</a> y el grupo orará por ti.</p>
  `);

  const lista = vista.querySelector('#lista');
  let evaluaciones;
  try {
    ({ evaluaciones } = await api('/agenda'));
  } catch (err) {
    lista.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    return;
  }

  if (!evaluaciones.length) {
    lista.innerHTML = '<p class="vacio">Por ahora no hay evaluaciones anotadas.</p>';
    return;
  }

  const porGrupo = {};
  for (const e of evaluaciones) (porGrupo[grupo(e.fechaHora)] ||= []).push(e);
  // Las pasadas, de la más reciente a la más antigua.
  porGrupo.pasadas?.reverse();
  lista.innerHTML = GRUPOS.filter(([k]) => porGrupo[k])
    .map(([k, titulo]) => `<h2>${titulo}</h2>${porGrupo[k].map((e) => tarjeta(e, user)).join('')}`)
    .join('');

  const porId = Object.fromEntries(evaluaciones.map((e) => [e.id, e]));
  // Busca la tarjeta actual en el DOM (otra acción pudo haberla redibujado mientras esperábamos).
  const repintar = (e) => {
    const actual = lista.querySelector(`#ev-${CSS.escape(e.id)}`);
    if (actual) actual.outerHTML = tarjeta(e, user);
  };

  lista.addEventListener('click', async (ev) => {
    const boton = ev.target.closest('button[data-accion]');
    if (!boton) return;
    const art = boton.closest('article');
    const e = porId[art.dataset.id];
    boton.disabled = true;
    try {
      if (boton.dataset.accion === 'orar') {
        const r = await api(`/agenda/${e.id}/ore`, { metodo: e.yoOre ? 'DELETE' : 'POST' });
        Object.assign(e, { yoOre: r.yoOre, oraciones: r.oraciones });
        repintar(e);
        if (r.yoOre) avisar('Gracias por orar');
      } else if (boton.dataset.accion === 'quitar') {
        if (!(await confirmar(`Se quitará de la agenda la evaluación de ${e.joven.nombre}. Úsalo para entradas falsas o repetidas.`, { titulo: '¿Quitar evaluación?', aceptar: 'Quitar', peligro: true }))) return;
        await api(`/lider/evaluaciones/${e.id}`, { metodo: 'DELETE' });
        lista.querySelector(`#ev-${CSS.escape(e.id)}`)?.remove();
        avisar('Evaluación quitada');
      }
    } catch (err) {
      avisar(err.message);
    } finally {
      boton.disabled = false;
    }
  });

  // Desde una notificación: #/agenda?ev=ID abre esa tarjeta.
  const destino = params.get('ev') && lista.querySelector(`#ev-${CSS.escape(params.get('ev'))}`);
  if (destino) {
    destino.classList.add('resaltada');
    destino.scrollIntoView({ block: 'center' });
  }
}
