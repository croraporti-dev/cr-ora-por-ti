// Panel de la líder: resumen de la semana, código de invitación y miembros.
import { api } from '../api.js';
import { pintar, esc, conCarga, avisar } from '../ui.js';

function cifra(valor, texto, detalle = '') {
  return `<div class="cifra"><strong>${valor}</strong><span>${esc(texto)}</span>${detalle ? `<small>${esc(detalle)}</small>` : ''}</div>`;
}

function resumenHtml(r) {
  const plural = (n, uno, varios) => (n === 1 ? uno : varios);
  return `
    <h2 style="margin-top:0">Esta semana <span class="chico">(${esc(r.semana.desde)} al ${esc(r.semana.hasta)})</span></h2>
    <div class="cifras">
      ${cifra(r.evaluaciones, plural(r.evaluaciones, 'evaluación', 'evaluaciones'), r.evaluacionesPendientes ? `${r.evaluacionesPendientes} por venir` : '')}
      ${cifra(r.jovenes, plural(r.jovenes, 'joven con evaluaciones', 'jóvenes con evaluaciones'))}
      ${cifra(r.oraciones, plural(r.oraciones, 'oración registrada', 'oraciones registradas'))}
      ${cifra(r.avisosPush + r.avisosCorreo, plural(r.avisosPush + r.avisosCorreo, 'aviso enviado', 'avisos enviados'), `${r.avisosPush} push · ${r.avisosCorreo} correo`)}
    </div>
    <p class="chico">Orantes con avisos activos en algún dispositivo: <strong>${r.orantesConPush} de ${r.orantes}</strong>.
      Los demás reciben los avisos por correo.</p>
    ${r.pidieronOracion.length
      ? `<div class="pidieron"><strong>Pidieron oración en los últimos 7 días:</strong> ${r.pidieronOracion.map(esc).join(', ')}</div>`
      : ''}`;
}

const ROLES = { LIDER: 'Líder', ORANTE: 'Orante' };

function filaMiembro(m, yo) {
  const nombre = esc([m.nombre, m.apellido].filter(Boolean).join(' '));
  let detalle;
  let acciones = '';
  if (m.rol === 'JOVEN') {
    const numero = (m.telefono || '').replace('+', '');
    detalle = `${esc(m.telefono || '')}${m.esMenor ? ' · menor de edad' : ''} · ${m.evaluaciones} ${m.evaluaciones === 1 ? 'evaluación' : 'evaluaciones'}`;
    acciones = numero ? `<a class="btn texto" href="https://wa.me/${esc(numero)}" target="_blank" rel="noopener">WhatsApp</a>` : '';
  } else {
    detalle = `${esc(m.email || '')} · avisos ${m.avisosActivos ? 'activos' : 'por correo'}`;
    if (m.id !== yo) {
      acciones = `<select data-accion="rol" aria-label="Rol de ${nombre}">
        ${Object.entries(ROLES).map(([k, t]) => `<option value="${k}" ${k === m.rol ? 'selected' : ''}>${t}</option>`).join('')}
      </select>`;
    }
  }
  return `
    <li class="miembro" data-id="${esc(m.id)}">
      <div class="miembro-datos"><strong>${nombre}${m.id === yo ? ' <span class="chico">(tú)</span>' : ''}</strong><span class="chico">${detalle}</span></div>
      <div class="miembro-acciones">
        ${acciones}
        ${m.id !== yo ? '<button class="btn texto peligro-texto" data-accion="quitar">Quitar</button>' : ''}
      </div>
    </li>`;
}

function grupoMiembros(titulo, lista, yo, vacio) {
  return `<h3>${titulo} <span class="chico">(${lista.length})</span></h3>
    ${lista.length ? `<ul class="miembros">${lista.map((m) => filaMiembro(m, yo)).join('')}</ul>` : `<p class="chico">${vacio}</p>`}`;
}

async function pintarMiembros(caja) {
  const { miembros, yo } = await api('/lider/miembros');
  const de = (rol) => miembros.filter((m) => m.rol === rol);
  caja.innerHTML = `
    ${grupoMiembros('Líderes', de('LIDER'), yo, '')}
    ${grupoMiembros('Orantes', de('ORANTE'), yo, 'Aún no hay orantes. Comparte el código de invitación.')}
    ${grupoMiembros('Jóvenes', de('JOVEN'), yo, 'Aún no hay jóvenes registrados.')}`;
  return miembros;
}

export async function vistaLider() {
  const vista = pintar(`
    <h1>Panel de la líder</h1>
    <div class="tarjeta" id="caja-resumen"><p class="cargando">Cargando…</p></div>

    <div class="tarjeta">
      <h2 style="margin-top:0">Código de invitación</h2>
      <p class="chico">Para que nuevos orantes se sumen. Los jóvenes no lo necesitan. Si el código se filtra, genera uno nuevo: el anterior deja de funcionar.</p>
      <p class="codigo-invitacion" id="codigo">…</p>
      <div style="display:grid;gap:10px">
        <button class="btn secundario" id="copiar">Copiar código</button>
        <button class="btn peligro" id="nuevo">Generar un código nuevo</button>
      </div>
    </div>

    <div class="tarjeta">
      <h2 style="margin-top:0">Miembros</h2>
      <div id="caja-miembros"><p class="cargando">Cargando…</p></div>
    </div>
  `);

  const cajaResumen = vista.querySelector('#caja-resumen');
  const cajaMiembros = vista.querySelector('#caja-miembros');
  const caja = vista.querySelector('#codigo');

  const cargarResumen = () => api('/lider/resumen')
    .then((r) => { cajaResumen.innerHTML = resumenHtml(r); })
    .catch((err) => { cajaResumen.innerHTML = `<p class="error">${esc(err.message)}</p>`; });

  let miembros = [];
  const cargarMiembros = () => pintarMiembros(cajaMiembros)
    .then((m) => { miembros = m; })
    .catch((err) => { cajaMiembros.innerHTML = `<p class="error">${esc(err.message)}</p>`; });

  api('/lider/invitacion')
    .then((r) => { caja.textContent = r.codigo; })
    .catch((err) => { caja.textContent = '—'; avisar(err.message); });
  cargarResumen();
  cargarMiembros();

  vista.querySelector('#copiar').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(caja.textContent);
      avisar('Código copiado');
    } catch {
      avisar('No se pudo copiar; mantén presionado el código para copiarlo.');
    }
  });
  vista.querySelector('#nuevo').addEventListener('click', (e) => {
    if (!confirm('¿Generar un código nuevo? El actual dejará de servir para registrarse.')) return;
    conCarga(e.currentTarget, null, async () => {
      caja.textContent = (await api('/lider/invitacion', { metodo: 'POST' })).codigo;
      avisar('Listo, hay un código nuevo');
    });
  });

  const persona = (fila) => miembros.find((m) => m.id === fila.dataset.id);

  cajaMiembros.addEventListener('change', async (ev) => {
    const select = ev.target.closest('select[data-accion=rol]');
    if (!select) return;
    const m = persona(select.closest('.miembro'));
    const anterior = m.rol;
    try {
      await api(`/lider/miembros/${m.id}`, { metodo: 'PATCH', datos: { rol: select.value } });
      avisar(`${m.nombre} ahora es ${ROLES[select.value].toLowerCase()}`);
      await cargarMiembros();
    } catch (err) {
      select.value = anterior;
      avisar(err.message);
    }
  });

  cajaMiembros.addEventListener('click', async (ev) => {
    const boton = ev.target.closest('button[data-accion=quitar]');
    if (!boton) return;
    const m = persona(boton.closest('.miembro'));
    const extra = m.rol === 'JOVEN' ? ' y todas sus evaluaciones' : '';
    if (!confirm(`¿Quitar a ${m.nombre} del grupo? Se borrarán sus datos${extra}. No se puede deshacer.`)) return;
    await conCarga(boton, null, async () => {
      await api(`/lider/miembros/${m.id}`, { metodo: 'DELETE' });
      avisar(`${m.nombre} ya no está en el grupo`);
      await Promise.all([cargarMiembros(), cargarResumen()]);
    });
  });
}
