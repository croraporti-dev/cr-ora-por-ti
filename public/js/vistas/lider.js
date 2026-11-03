// Grupo (rol líder): resumen de la semana, invitación, solicitudes y miembros en secciones plegables.
import { api, memoria } from '../api.js';
import { pintar, esc, conCarga, avisar, avisarConAccion, confirmar, mostrarEnlace } from '../ui.js';
import { hoyChile } from '../fechas.js';

const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const ICONO_MAS = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>';
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const nombreCompleto = (m) => [m.nombre, m.apellido].filter(Boolean).join(' ');

function cifra(valor, texto) {
  return `<div class="cifra"><strong>${valor}</strong><span>${esc(texto)}</span></div>`;
}

function resumenHtml(r) {
  const hoy = hoyChile();
  const maximo = Math.max(1, ...r.porDia.map((d) => d.cantidad));
  const barras = `
    <div class="carga" role="img" aria-label="Pruebas por día: ${r.porDia.map((d, i) => `${DIAS_CORTOS[i]} ${d.cantidad}`).join(', ')}">
      ${r.porDia.map((d, i) => `
        <div class="carga-dia ${d.fecha === hoy ? 'hoy' : ''}">
          <span class="carga-num">${d.cantidad || ''}</span>
          <span class="carga-barra" style="height:${Math.round((d.cantidad / maximo) * 100)}%"></span>
          <span class="carga-nombre">${DIAS_CORTOS[i]}</span>
        </div>`).join('')}
    </div>`;

  if (!r.evaluaciones) {
    return `
      ${barras}
      <p class="nota-calida">Esta semana todavía no hay pruebas anotadas. Comparte el QR o el enlace de la app para que los jóvenes anoten las suyas.</p>
      ${notaNotificaciones(r)}`;
  }
  return `
    ${barras}
    <div class="cifras">
      ${cifra(r.evaluaciones, r.evaluaciones === 1 ? 'evaluación esta semana' : 'evaluaciones esta semana')}
      ${cifra(r.jovenes, r.jovenes === 1 ? 'joven con pruebas' : 'jóvenes con pruebas')}
      ${cifra(r.oraciones, r.oraciones === 1 ? 'vez que alguien oró' : 'veces que alguien oró')}
      ${cifra(r.avisosPush, r.avisosPush === 1 ? 'notificación enviada' : 'notificaciones enviadas')}
    </div>
    ${r.oraciones ? '' : '<p class="chico">Todavía nadie ha marcado «Ya oré» esta semana.</p>'}
    ${r.pidieronOracion.length ? `<div class="pidieron"><strong>Pidieron oración en los últimos 7 días:</strong> ${r.pidieronOracion.map(esc).join(', ')}</div>` : ''}
    ${notaNotificaciones(r)}`;
}

function notaNotificaciones(r) {
  if (!r.orantes) return '';
  if (r.orantesConPush === r.orantes) {
    return `<p class="chico">Todas las personas que oran (${r.orantes}) tienen las notificaciones activadas.</p>`;
  }
  return `<p class="chico">${r.orantesConPush} de ${plural(r.orantes, 'persona que ora tiene', 'personas que oran tienen')} las notificaciones activadas. A las demás no les llegan avisos: recuérdales activarlas en Ajustes.</p>`;
}

function menuMas(opciones) {
  if (!opciones.length) return '';
  return `
    <div class="menu-mas">
      <button class="btn-icono" data-accion="menu" aria-haspopup="true" aria-expanded="false" aria-label="Más opciones">${ICONO_MAS}</button>
      <div class="menu-mas-lista" hidden>
        ${opciones.map(([accion, texto, peligro]) => `<button data-accion="${accion}" class="${peligro ? 'peligro-texto' : ''}">${esc(texto)}</button>`).join('')}
      </div>
    </div>`;
}

function filaOrante(m, yo) {
  const esYo = m.id === yo;
  const etiquetas = [
    m.rol === 'LIDER' ? '<span class="etiqueta-rol">Líder</span>' : '',
    esYo ? '<span class="chico">(tú)</span>' : ''
  ].join(' ');
  const detalle = [esc(m.email || ''), m.avisosActivos ? 'notificaciones activas' : 'sin notificaciones', m.tieneClave ? '' : 'sin contraseña']
    .filter(Boolean).join(' · ');
  const opciones = esYo ? [] : [
    ['acceso', 'Enviar acceso (nueva contraseña)'],
    m.rol === 'LIDER' ? ['rol-orante', 'Quitar rol de líder'] : ['rol-lider', 'Hacer líder'],
    ['quitar', 'Quitar del grupo', true]
  ];
  return `
    <li class="miembro" data-id="${esc(m.id)}">
      <div class="miembro-datos"><strong>${esc(nombreCompleto(m))} ${etiquetas}</strong><span class="chico">${detalle}</span></div>
      <div class="miembro-acciones">${menuMas(opciones)}</div>
    </li>`;
}

function filaJoven(m) {
  const numero = (m.telefono || '').replace('+', '');
  return `
    <li class="miembro" data-id="${esc(m.id)}">
      <div class="miembro-datos"><strong>${esc(nombreCompleto(m))}</strong><span class="chico">${esc(m.telefono || 'sin celular')} · ${plural(m.evaluaciones, 'evaluación', 'evaluaciones')}</span></div>
      <div class="miembro-acciones">
        ${numero ? `<a class="btn-whatsapp" href="https://wa.me/${esc(numero)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        ${menuMas([['quitar', 'Quitar del grupo', true]])}
      </div>
    </li>`;
}

function filaSolicitud(m) {
  return `
    <li class="miembro" data-id="${esc(m.id)}">
      <div class="miembro-datos"><strong>${esc(nombreCompleto(m))}</strong><span class="chico">${esc(m.email || '')}</span></div>
      <div class="miembro-acciones">
        <button class="btn secundario chico-btn" data-accion="aprobar">Aprobar</button>
        <button class="btn texto peligro-texto" data-accion="rechazar">Rechazar</button>
      </div>
    </li>`;
}

// <details> que recuerda si estaba abierto.
function plegable(clave, titulo, contenido, abiertoPorDefecto = false) {
  const guardado = memoria.leer(`cr_grupo_${clave}`);
  const abierto = guardado === null ? abiertoPorDefecto : guardado === '1';
  return `<details class="plegable tarjeta" data-seccion="${clave}" ${abierto ? 'open' : ''}>
    <summary><span class="plegable-titulo">${titulo}</span></summary>
    <div class="plegable-cuerpo">${contenido}</div>
  </details>`;
}

export async function vistaLider() {
  const vista = pintar(`
    <h1>Grupo</h1>
    <div id="caja-solicitudes"></div>
    ${plegable('semana', 'Esta semana <span class="chico" id="rango-semana"></span>', '<div id="caja-resumen"><div class="esqueleto"></div></div>', true)}
    ${plegable('invitar', 'Invitar a orar', `
      <p class="chico">Comparte este enlace con quien quiera sumarse a orar por los jóvenes. Cada persona que se registre quedará pendiente hasta que la apruebes aquí. Los jóvenes no lo necesitan para anotar sus pruebas.</p>
      <p class="enlace-invitacion" id="codigo">…</p>
      <div style="display:grid;gap:10px">
        <a class="btn" id="whatsapp" target="_blank" rel="noopener" href="#">Compartir por WhatsApp</a>
        <button class="btn secundario" id="copiar">Copiar enlace</button>
        <button class="btn texto peligro-texto" id="nuevo">Generar un enlace nuevo</button>
      </div>`)}
    ${plegable('oran', 'Personas que oran <span class="chico" id="cuenta-oran"></span>', `
      <p class="chico">Todas reciben avisos de todos los jóvenes. Quienes tienen rol <strong>Líder</strong> además administran el grupo.</p>
      <ul class="miembros" id="lista-oran"></ul>`)}
    ${plegable('jovenes', 'Jóvenes <span class="chico" id="cuenta-jovenes"></span>', `
      <input type="search" id="buscar-joven" class="buscador" placeholder="Buscar por nombre o celular" aria-label="Buscar joven" autocomplete="off">
      <ul class="miembros" id="lista-jovenes"></ul>`)}
  `);

  // Recuerda qué secciones quedaron abiertas.
  vista.querySelectorAll('details.plegable').forEach((d) =>
    d.addEventListener('toggle', () => memoria.guardar(`cr_grupo_${d.dataset.seccion}`, d.open ? '1' : '0'))
  );

  const cajaResumen = vista.querySelector('#caja-resumen');
  const cajaCodigo = vista.querySelector('#codigo');
  const buscador = vista.querySelector('#buscar-joven');
  let miembros = [];
  let yo = null;
  // Quitar con "Deshacer": la persona se oculta y se borra recién si no se deshace a tiempo.
  const porQuitar = new Map();

  const cargarResumen = () => api('/lider/resumen')
    .then((r) => {
      vista.querySelector('#rango-semana').textContent = `(${r.semana.desde.slice(0, 5)} al ${r.semana.hasta.slice(0, 5)})`;
      cajaResumen.innerHTML = resumenHtml(r);
    })
    .catch((err) => { cajaResumen.innerHTML = `<p class="error">${esc(err.message)}</p>`; });

  function pintarMiembros() {
    const visibles = miembros.filter((m) => !porQuitar.has(m.id));
    const pendientes = visibles.filter((m) => m.pendiente);
    const oran = visibles.filter((m) => !m.pendiente && m.rol !== 'JOVEN')
      .sort((a, b) => (a.rol === b.rol ? nombreCompleto(a).localeCompare(nombreCompleto(b)) : a.rol === 'LIDER' ? -1 : 1));
    const jovenes = visibles.filter((m) => m.rol === 'JOVEN');
    const q = buscador.value.trim().toLowerCase();
    const encontrados = q ? jovenes.filter((m) => `${nombreCompleto(m)} ${m.telefono || ''}`.toLowerCase().includes(q)) : jovenes;

    vista.querySelector('#caja-solicitudes').innerHTML = pendientes.length ? `
      <div class="tarjeta solicitudes">
        <h2 style="margin-top:0">Solicitudes para orar <span class="chico">(${pendientes.length})</span></h2>
        <p class="chico">Aprueba solo a personas que conozcas: verán los nombres y celulares de los jóvenes.</p>
        <ul class="miembros">${pendientes.map(filaSolicitud).join('')}</ul>
      </div>` : '';

    vista.querySelector('#cuenta-oran').textContent = `(${oran.length})`;
    vista.querySelector('#lista-oran').innerHTML = oran.map((m) => filaOrante(m, yo)).join('')
      + (oran.length <= 1 ? '<li class="chico vacio-lista">Aún no se suma nadie más a orar. Comparte el enlace de invitación.</li>' : '');

    vista.querySelector('#cuenta-jovenes').textContent = `(${jovenes.length})`;
    vista.querySelector('#lista-jovenes').innerHTML = encontrados.map(filaJoven).join('')
      || `<li class="chico vacio-lista">${jovenes.length ? 'Nadie coincide con la búsqueda.' : 'Aún no hay jóvenes registrados. Comparte el QR para que anoten sus pruebas.'}</li>`;
    buscador.hidden = jovenes.length < 6;
  }

  const cargarMiembros = () => api('/lider/miembros')
    .then((r) => {
      miembros = r.miembros;
      yo = r.yo;
      pintarMiembros();
    })
    .catch((err) => { vista.querySelector('#lista-oran').innerHTML = `<li class="error">${esc(err.message)}</li>`; });

  const ponerEnlace = (enlace) => {
    cajaCodigo.textContent = enlace;
    vista.querySelector('#whatsapp').href = `https://wa.me/?text=${encodeURIComponent(`Te invito a sumarte a orar por los jóvenes de CR: ${enlace}`)}`;
  };
  api('/lider/invitacion').then((r) => ponerEnlace(r.enlace)).catch((err) => { cajaCodigo.textContent = '—'; avisar(err.message); });
  cargarResumen();
  cargarMiembros();

  buscador.addEventListener('input', pintarMiembros);

  vista.querySelector('#copiar').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(cajaCodigo.textContent);
      avisar('Enlace copiado');
    } catch {
      avisar('No se pudo copiar; mantén presionado el enlace para copiarlo.');
    }
  });
  vista.querySelector('#nuevo').addEventListener('click', async (e) => {
    const boton = e.currentTarget;
    if (!(await confirmar('El enlace actual dejará de servir para registrarse. Úsalo si se compartió con quien no debía.', { titulo: '¿Generar un enlace nuevo?', aceptar: 'Generar' }))) return;
    conCarga(boton, null, async () => {
      ponerEnlace((await api('/lider/invitacion', { metodo: 'POST' })).enlace);
      avisar('Listo, hay un enlace nuevo');
    });
  });

  function cerrarMenus(excepto) {
    vista.querySelectorAll('.menu-mas-lista').forEach((m) => {
      if (m !== excepto) {
        m.hidden = true;
        m.previousElementSibling?.setAttribute('aria-expanded', 'false');
      }
    });
  }

  let enPantalla = true;
  async function quitarDefinitivo(m) {
    porQuitar.delete(m.id);
    try {
      await api(`/lider/miembros/${m.id}`, { metodo: 'DELETE' });
      miembros = miembros.filter((x) => x.id !== m.id);
      if (enPantalla) cargarResumen();
    } catch (err) {
      avisar(err.message);
    }
    if (enPantalla) pintarMiembros();
  }

  // Si se cambia de pantalla mientras está el "Deshacer", se completa el borrado.
  window.addEventListener('hashchange', () => {
    enPantalla = false;
    for (const m of porQuitar.values()) quitarDefinitivo(m);
  }, { once: true });

  vista.addEventListener('click', async (ev) => {
    const boton = ev.target.closest('button[data-accion]');
    if (!boton) {
      cerrarMenus();
      return;
    }
    const accion = boton.dataset.accion;
    if (accion === 'menu') {
      const lista = boton.nextElementSibling;
      const abrir = lista.hidden;
      cerrarMenus(lista);
      lista.hidden = !abrir;
      boton.setAttribute('aria-expanded', String(abrir));
      return;
    }
    const fila = boton.closest('.miembro');
    const m = fila && miembros.find((x) => x.id === fila.dataset.id);
    if (!m) return;
    cerrarMenus();

    if (accion === 'acceso') {
      await conCarga(boton, null, async () => {
        const r = await api(`/lider/miembros/${m.id}/acceso`, { metodo: 'POST' });
        mostrarEnlace({
          titulo: `Acceso para ${m.nombre}`,
          texto: 'Con este enlace podrá crear una contraseña nueva. Sirve una sola vez y vence en 24 horas. Envíaselo solo a esa persona.',
          enlace: r.enlace,
          mensaje: `Hola ${m.nombre}, con este enlace puedes crear tu contraseña para CR Juntos en la prueba:`
        });
      });
    } else if (accion === 'rol-lider' || accion === 'rol-orante') {
      const lider = accion === 'rol-lider';
      const ok = await confirmar(
        lider ? `${m.nombre} podrá aprobar solicitudes, quitar personas y evaluaciones, y compartir el enlace de invitación.` : `${m.nombre} dejará de administrar el grupo, pero seguirá orando y recibiendo avisos.`,
        { titulo: lider ? `¿Hacer líder a ${m.nombre}?` : `¿Quitar el rol de líder a ${m.nombre}?`, aceptar: lider ? 'Hacer líder' : 'Quitar rol' }
      );
      if (!ok) return;
      try {
        await api(`/lider/miembros/${m.id}`, { metodo: 'PATCH', datos: { rol: lider ? 'LIDER' : 'ORANTE' } });
        avisar(lider ? `${m.nombre} ahora tiene rol de líder` : `${m.nombre} ya no tiene rol de líder`);
        await cargarMiembros();
      } catch (err) {
        avisar(err.message);
      }
    } else if (accion === 'aprobar') {
      await conCarga(boton, null, async () => {
        await api(`/lider/miembros/${m.id}/aprobar`, { metodo: 'POST' });
        avisar(`${m.nombre} ya puede orar con el grupo.`);
        await Promise.all([cargarMiembros(), cargarResumen()]);
      });
    } else if (accion === 'rechazar') {
      if (!(await confirmar(`${m.nombre} no podrá ver la agenda ni recibir avisos.`, { titulo: '¿Rechazar solicitud?', aceptar: 'Rechazar', peligro: true }))) return;
      await conCarga(boton, null, async () => {
        await api(`/lider/miembros/${m.id}`, { metodo: 'DELETE' });
        avisar('Solicitud rechazada');
        await cargarMiembros();
      });
    } else if (accion === 'quitar') {
      const ok = await confirmar(
        `Se borrarán sus datos${m.rol === 'JOVEN' ? ' y todas sus evaluaciones' : ''}. Tendrás unos segundos para deshacerlo.`,
        { titulo: `¿Quitar a ${m.nombre} del grupo?`, aceptar: 'Quitar', peligro: true }
      );
      if (!ok) return;
      porQuitar.set(m.id, m);
      pintarMiembros();
      const deshacer = await avisarConAccion(`${m.nombre} ya no está en el grupo`, 'Deshacer');
      if (!porQuitar.has(m.id)) return; // ya se completó al cambiar de pantalla
      if (deshacer) {
        porQuitar.delete(m.id);
        pintarMiembros();
        avisar(`${m.nombre} sigue en el grupo`);
      } else {
        await quitarDefinitivo(m);
      }
    }
  });
}
