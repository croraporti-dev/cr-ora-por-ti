// Agenda de oración (orantes y líder).
import { api, memoria } from '../api.js';
import { pintar, esc, avisar } from '../ui.js';
import { TIPOS, ANIMOS } from '../textos.js';
import { grupo, partesChile, cuando } from '../fechas.js';

const GRUPOS = [
  ['hoy', 'Hoy'],
  ['manana', 'Mañana'],
  ['semana', 'Esta semana'],
  ['despues', 'Más adelante'],
  ['pasadas', 'Hace poco']
];

function tarjeta(e, user) {
  const pasada = grupo(e.fechaHora) === 'pasadas' || new Date(e.fechaHora) < new Date();
  const hora = ['hoy', 'manana'].includes(grupo(e.fechaHora)) ? partesChile(e.fechaHora).hora : cuando(e.fechaHora);
  const animo = e.resultadoAnimo
    ? `<span class="etiqueta ${e.resultadoAnimo === 'NECESITA_ORACION' ? 'urgente' : ''}">${ANIMOS[e.resultadoAnimo].etiqueta}</span>`
    : '';
  return `
    <article class="tarjeta evaluacion" id="ev-${esc(e.id)}" data-id="${esc(e.id)}">
      <div class="ev-cabecera">
        <strong class="ev-nombre">${esc(e.joven.nombre)}</strong>
        <button class="seguir ${e.sigo ? 'activo' : ''}" data-accion="seguir" aria-pressed="${e.sigo}">${e.sigo ? 'Siguiendo' : 'Seguir'}</button>
      </div>
      <div class="ev-titulo">${esc(TIPOS[e.tipo].nombre)} de ${esc(e.ramo)} ${animo}</div>
      <div class="ev-cuando">${esc(hora)}${pasada && !e.resultadoAnimo ? ' · ya pasó' : ''}</div>
      <div class="ev-pie">
        <span class="oraron" data-contador>${e.oraciones ? `${e.oraciones} ${e.oraciones === 1 ? 'persona oró' : 'personas oraron'}` : 'Nadie ha orado aún'}</span>
        <button class="btn ${e.yoOre ? 'secundario' : 'orar'}" data-accion="orar" aria-pressed="${e.yoOre}">${e.yoOre ? 'Oraste' : 'Ya oré'}</button>
      </div>
      ${user.rol === 'LIDER' ? '<button class="btn texto peligro-texto chico" data-accion="quitar">Quitar evaluación</button>' : ''}
    </article>`;
}

// Aviso al abrir la app si los avisos del celular fallaron o nunca se activaron.
function bannerAvisos(avisos) {
  if (!avisos) return '';
  if (avisos.necesitaReactivar) {
    return `<a class="banner mal" href="#/ajustes?reactivar=1"><span>Tus avisos dejaron de llegar al celular. <strong>Toca aquí para reactivarlos.</strong></span></a>`;
  }
  if (avisos.quierePush && !avisos.pushActivas) {
    return `<a class="banner" href="#/ajustes?reactivar=1"><span>Activa los avisos en tu celular para saber cuándo orar. <strong>Activar</strong></span></a>`;
  }
  return '';
}

export async function vistaAgenda({ user, params, avisos }) {
  const soloSeguidos = memoria.leer('cr_filtro') === 'seguidos';
  const vista = pintar(`
    ${bannerAvisos(avisos)}
    <h1>Agenda de oración</h1>
    <div class="pestanas" role="tablist">
      <button role="tab" data-filtro="todos" aria-selected="${!soloSeguidos}">Todos</button>
      <button role="tab" data-filtro="seguidos" aria-selected="${soloSeguidos}">Solo los que sigo</button>
    </div>
    <div id="lista"><p class="cargando">Cargando…</p></div>
  `);

  vista.querySelectorAll('[data-filtro]').forEach((b) =>
    b.addEventListener('click', () => {
      memoria.guardar('cr_filtro', b.dataset.filtro);
      vistaAgenda({ user, params, avisos });
    })
  );

  const lista = vista.querySelector('#lista');
  let evaluaciones;
  try {
    ({ evaluaciones } = await api(`/agenda${soloSeguidos ? '?seguidos=1' : ''}`));
  } catch (err) {
    lista.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    return;
  }

  if (!evaluaciones.length) {
    lista.innerHTML = `<p class="vacio">${soloSeguidos
      ? 'No hay evaluaciones de los jóvenes que sigues. Toca «Seguir» en una tarjeta para seguir a alguien.'
      : 'Por ahora no hay evaluaciones anotadas.'}</p>`;
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
      } else if (boton.dataset.accion === 'seguir') {
        const r = await api(`/agenda/seguir/${e.joven.id}`, { metodo: e.sigo ? 'DELETE' : 'POST' });
        // Actualiza todas las tarjetas de ese joven.
        evaluaciones.filter((x) => x.joven.id === e.joven.id).forEach((x) => {
          x.sigo = r.sigo;
          repintar(x);
        });
        avisar(r.sigo ? `Ahora sigues a ${e.joven.nombre}` : `Dejaste de seguir a ${e.joven.nombre}`);
      } else if (boton.dataset.accion === 'quitar') {
        if (!confirm(`¿Quitar la evaluación de ${e.joven.nombre}? Úsalo para entradas falsas o repetidas.`)) return;
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
