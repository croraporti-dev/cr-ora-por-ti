// Agenda de oración (orantes y líder): pensada para muchas pruebas a la vez.
// Tira con los próximos 7 días, filas compactas que se expanden, "Ya oré" como estado y filtro.
import { api, memoria } from '../api.js';
import { pintar, esc, avisar, confirmar } from '../ui.js';
import { ANIMOS, nombreTipo } from '../textos.js';
import { partesChile, fechaChileEn, hoyChile, aDMA } from '../fechas.js';

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const ICONO_CHECK = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICONO_FLECHA = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICONO_MAS = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>';

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

const diaSemana = (fecha) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

function tituloDia(fecha, hoy, manana) {
  if (fecha === hoy) return 'Hoy';
  if (fecha === manana) return 'Mañana';
  const t = `${DIAS_LARGOS[diaSemana(fecha)]} ${aDMA(fecha)}`;
  return t[0].toUpperCase() + t.slice(1);
}

// Agrupa las evaluaciones de un mismo joven en un mismo día: una fila por joven y día.
function agrupar(evaluaciones) {
  const grupos = new Map();
  for (const e of evaluaciones) {
    const { fecha } = partesChile(e.fechaHora);
    const clave = `${fecha}|${e.joven.id}`;
    if (!grupos.has(clave)) grupos.set(clave, { clave, fecha, joven: e.joven, evs: [] });
    grupos.get(clave).evs.push(e);
  }
  return [...grupos.values()];
}

function resumenFila(g) {
  if (g.evs.length > 1) return `${g.evs.length} evaluaciones`;
  const e = g.evs[0];
  return `${nombreTipo(e)} de ${e.ramo}`;
}

function detalleEvaluacion(e, user) {
  const ahora = new Date();
  const pasada = new Date(e.fechaHora) < ahora;
  const animo = e.resultadoAnimo
    ? `<span class="etiqueta ${e.resultadoAnimo === 'NECESITA_ORACION' ? 'urgente' : ''}">${ANIMOS[e.resultadoAnimo].etiqueta}</span>`
    : '';
  const menu = user.rol === 'LIDER'
    ? `<div class="menu-mas">
        <button class="btn-icono" data-accion="menu" aria-haspopup="true" aria-expanded="false" aria-label="Más opciones">${ICONO_MAS}</button>
        <div class="menu-mas-lista" hidden>
          <button class="peligro-texto" data-accion="quitar" data-id="${esc(e.id)}">Quitar evaluación</button>
        </div>
      </div>`
    : '';
  return `
    <li class="ev-item" data-id="${esc(e.id)}">
      <div class="ev-item-datos">
        <strong>${esc(nombreTipo(e))} de ${esc(e.ramo)}</strong> ${animo}
        <span class="chico">${esc(partesChile(e.fechaHora).hora)}${pasada && !e.resultadoAnimo ? ' · ya pasó' : ''}${e.oraciones && !e.yoOre ? ' · ya están orando' : ''}</span>
      </div>
      <div class="ev-item-acciones">
        <button class="btn ${e.yoOre ? 'orado' : 'orar'}" data-accion="orar" data-id="${esc(e.id)}" aria-pressed="${e.yoOre}">
          ${e.yoOre ? `${ICONO_CHECK} Oraste` : 'Ya oré'}
        </button>
        ${menu}
      </div>
    </li>`;
}

function fila(g, user, abierta, resaltar) {
  const hora = partesChile(g.evs[0].fechaHora).hora;
  const todasOradas = g.evs.every((e) => e.yoOre);
  const pide = g.evs.some((e) => e.resultadoAnimo === 'NECESITA_ORACION');
  return `
    <li class="fila ${todasOradas ? 'orada' : ''} ${abierta ? 'abierta' : ''} ${resaltar ? 'resaltada' : ''}" data-clave="${esc(g.clave)}">
      <button class="fila-cabecera" data-accion="abrir" aria-expanded="${abierta}">
        <span class="fila-hora">${esc(hora)}</span>
        <span class="fila-texto">
          <span class="fila-nombre">${esc(g.joven.nombre)}</span>
          <span class="fila-ramo">${esc(resumenFila(g))}${pide ? ' · <span class="pide">pide oración</span>' : ''}</span>
        </span>
        <span class="fila-estado">${todasOradas ? `<span class="check" aria-label="Ya oraste">${ICONO_CHECK}</span>` : ''}${ICONO_FLECHA}</span>
      </button>
      ${abierta ? `
        <div class="fila-detalle">
          ${contacto(g.joven)}
          <ul class="ev-items">${g.evs.map((e) => detalleEvaluacion(e, user)).join('')}</ul>
        </div>` : ''}
    </li>`;
}

export async function vistaAgenda({ user, params, avisos }) {
  const vista = pintar(`
    ${bannerAvisos(avisos)}
    <div class="agenda-cabecera">
      <h1>Agenda de oración</h1>
      <p class="contador" id="contador" hidden></p>
    </div>
    <div id="lista"><div class="esqueleto"></div><div class="esqueleto"></div><div class="esqueleto"></div></div>
  `);
  const lista = vista.querySelector('#lista');

  let evaluaciones;
  try {
    ({ evaluaciones } = await api('/agenda'));
  } catch (err) {
    lista.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    return;
  }

  const hoy = hoyChile();
  const manana = fechaChileEn(1);
  const semana = Array.from({ length: 7 }, (_, i) => fechaChileEn(i));
  const finSemana = semana[6];
  const estado = {
    filtro: memoria.leer('cr_agenda_filtro') === 'por-orar' ? 'por-orar' : 'todas',
    dia: null,
    abiertas: new Set(),
    verMas: false,
    verPasadas: false,
    resaltar: null
  };

  // Desde una notificación: #/agenda?ev=ID abre esa fila.
  const destino = params.get('ev') && evaluaciones.find((e) => e.id === params.get('ev'));
  if (destino) {
    const { fecha } = partesChile(destino.fechaHora);
    estado.abiertas.add(`${fecha}|${destino.joven.id}`);
    estado.resaltar = `${fecha}|${destino.joven.id}`;
    if (fecha > finSemana) estado.verMas = true;
    if (fecha < hoy) estado.verPasadas = true;
  }

  const porId = new Map(evaluaciones.map((e) => [e.id, e]));

  function pintarContador() {
    const deHoy = evaluaciones.filter((e) => partesChile(e.fechaHora).fecha === hoy);
    const caja = vista.querySelector('#contador');
    if (!deHoy.length) {
      caja.hidden = true;
      return;
    }
    const oradas = deHoy.filter((e) => e.yoOre).length;
    caja.hidden = false;
    caja.innerHTML = oradas === deHoy.length
      ? `${ICONO_CHECK} Oraste por todas las pruebas de hoy`
      : `Has orado por <strong>${oradas} de ${deHoy.length}</strong> hoy`;
    caja.classList.toggle('completo', oradas === deHoy.length);
  }

  function seccion(titulo, grupos, extraClase = '') {
    if (!grupos.length) return '';
    return `
      <section class="dia ${extraClase}">
        <h2>${esc(titulo)}</h2>
        <ul class="filas">${grupos.map((g) => fila(g, user, estado.abiertas.has(g.clave), estado.resaltar === g.clave)).join('')}</ul>
      </section>`;
  }

  function pintarLista() {
    pintarContador();
    const visibles = estado.filtro === 'por-orar' ? evaluaciones.filter((e) => !e.yoOre) : evaluaciones;
    const grupos = agrupar(visibles);
    const enSemana = grupos.filter((g) => g.fecha >= hoy && g.fecha <= finSemana);
    const despues = grupos.filter((g) => g.fecha > finSemana);
    const pasadas = grupos.filter((g) => g.fecha < hoy).reverse();
    const cuenta = (fecha) => evaluaciones.filter((e) => partesChile(e.fechaHora).fecha === fecha).length;

    const tira = `
      <div class="semana" role="toolbar" aria-label="Filtrar por día">
        ${semana.map((f) => {
          const n = cuenta(f);
          const elegido = estado.dia === f;
          return `<button class="semana-dia ${elegido ? 'elegido' : ''} ${n ? '' : 'vacio-dia'}" data-accion="dia" data-fecha="${f}" aria-pressed="${elegido}"
            aria-label="${esc(tituloDia(f, hoy, manana))}: ${n} ${n === 1 ? 'evaluación' : 'evaluaciones'}">
            <span class="semana-nombre">${f === hoy ? 'Hoy' : DIAS_CORTOS[diaSemana(f)]}</span>
            <span class="semana-num">${Number(f.slice(8))}</span>
            <span class="semana-cuenta">${n || ''}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="segmentado" role="group" aria-label="Mostrar">
        <button data-accion="filtro" data-filtro="todas" aria-pressed="${estado.filtro === 'todas'}">Todas</button>
        <button data-accion="filtro" data-filtro="por-orar" aria-pressed="${estado.filtro === 'por-orar'}">Por orar</button>
      </div>`;

    let cuerpo = '';
    if (!evaluaciones.length) {
      cuerpo = `
        <div class="vacio-calido">
          <p class="vacio-titulo">Esta semana nadie ha anotado pruebas todavía</p>
          <p>Cuando alguien anote una prueba o examen, aparecerá aquí para que el grupo ore por esa persona.</p>
          <a class="btn bloque" href="#/mis">Anotar mi prueba</a>
        </div>`;
    } else if (estado.dia) {
      const delDia = enSemana.filter((g) => g.fecha === estado.dia);
      cuerpo = seccion(tituloDia(estado.dia, hoy, manana), delDia)
        || `<p class="vacio">${estado.filtro === 'por-orar' && cuenta(estado.dia) ? 'Ya oraste por todas las pruebas de este día.' : 'No hay pruebas este día.'}</p>`;
      cuerpo += '<button class="btn texto bloque" data-accion="dia" data-fecha="">Ver toda la semana</button>';
    } else {
      cuerpo = semana.map((f) => seccion(tituloDia(f, hoy, manana), enSemana.filter((g) => g.fecha === f))).join('');
      if (!cuerpo) {
        cuerpo = estado.filtro === 'por-orar' && enSemana.length === 0 && evaluaciones.some((e) => partesChile(e.fechaHora).fecha >= hoy && partesChile(e.fechaHora).fecha <= finSemana)
          ? '<div class="vacio-calido"><p class="vacio-titulo">Ya oraste por todas las pruebas de la semana</p><p>Gracias por acompañar a los jóvenes.</p></div>'
          : '<p class="vacio">No hay pruebas en los próximos 7 días.</p>';
      }
      if (despues.length) {
        cuerpo += estado.verMas
          ? seccion('Más adelante', despues, 'mas-adelante')
          : `<button class="btn secundario bloque ver-mas" data-accion="ver-mas">Ver más adelante (${despues.reduce((n, g) => n + g.evs.length, 0)})</button>`;
      }
      if (pasadas.length) {
        cuerpo += estado.verPasadas
          ? seccion('Hace poco', pasadas, 'pasadas')
          : `<button class="btn texto bloque" data-accion="ver-pasadas">Ver las de hace poco (${pasadas.reduce((n, g) => n + g.evs.length, 0)})</button>`;
      }
    }

    lista.innerHTML = `${evaluaciones.length ? tira : ''}${cuerpo}
      ${evaluaciones.length ? '<p class="chico pie-agenda">¿Tú también tienes una prueba o examen? <a href="#/mis">Anótalo aquí</a> y el grupo orará por ti.</p>' : ''}`;
  }

  pintarLista();
  if (estado.resaltar) lista.querySelector('.fila.resaltada')?.scrollIntoView({ block: 'center' });

  function cerrarMenus(excepto) {
    lista.querySelectorAll('.menu-mas-lista').forEach((m) => {
      if (m !== excepto) {
        m.hidden = true;
        m.previousElementSibling?.setAttribute('aria-expanded', 'false');
      }
    });
  }

  lista.addEventListener('click', async (ev) => {
    const boton = ev.target.closest('button[data-accion]');
    if (!boton) {
      cerrarMenus();
      return;
    }
    const accion = boton.dataset.accion;

    if (accion === 'abrir') {
      const clave = boton.closest('.fila').dataset.clave;
      estado.abiertas.has(clave) ? estado.abiertas.delete(clave) : estado.abiertas.add(clave);
      estado.resaltar = null;
      pintarLista();
      return;
    }
    if (accion === 'dia') {
      estado.dia = boton.dataset.fecha && estado.dia !== boton.dataset.fecha ? boton.dataset.fecha : null;
      pintarLista();
      return;
    }
    if (accion === 'filtro') {
      estado.filtro = boton.dataset.filtro;
      memoria.guardar('cr_agenda_filtro', estado.filtro);
      pintarLista();
      return;
    }
    if (accion === 'ver-mas') {
      estado.verMas = true;
      pintarLista();
      return;
    }
    if (accion === 'ver-pasadas') {
      estado.verPasadas = true;
      pintarLista();
      return;
    }
    if (accion === 'menu') {
      const menu = boton.nextElementSibling;
      const abrir = menu.hidden;
      cerrarMenus(menu);
      menu.hidden = !abrir;
      boton.setAttribute('aria-expanded', String(abrir));
      return;
    }

    const e = porId.get(boton.dataset.id);
    if (!e) return;
    boton.disabled = true;
    try {
      if (accion === 'orar') {
        // Al marcar, una vibración corta confirma el toque al instante (solo Android la soporta).
        if (!e.yoOre) navigator.vibrate?.(12);
        const r = await api(`/agenda/${e.id}/ore`, { metodo: e.yoOre ? 'DELETE' : 'POST' });
        Object.assign(e, { yoOre: r.yoOre, oraciones: r.oraciones });
        pintarLista();
        if (r.yoOre) {
          vista.querySelector(`button[data-accion="orar"][data-id="${CSS.escape(e.id)}"]`)?.classList.add('recien');
          const contador = vista.querySelector('#contador');
          contador.classList.add('latido');
          setTimeout(() => contador.classList.remove('latido'), 700);
          avisar('Gracias por orar');
        }
      } else if (accion === 'quitar') {
        cerrarMenus();
        const ok = await confirmar(`Se quitará de la agenda la evaluación de ${e.joven.nombre}. Úsalo para entradas falsas o repetidas.`, { titulo: '¿Quitar evaluación?', aceptar: 'Quitar', peligro: true });
        if (!ok) return;
        await api(`/lider/evaluaciones/${e.id}`, { metodo: 'DELETE' });
        evaluaciones = evaluaciones.filter((x) => x.id !== e.id);
        porId.delete(e.id);
        pintarLista();
        avisar('Evaluación quitada');
      }
    } catch (err) {
      avisar(err.message);
    } finally {
      boton.disabled = false;
    }
  });
}
