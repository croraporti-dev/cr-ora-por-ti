// Panel de administración (rol líder): resumen de la semana, código de invitación y miembros.
import { api } from '../api.js';
import { pintar, esc, conCarga, avisar, confirmar, mostrarEnlace } from '../ui.js';

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
  if (m.pendiente) {
    return `
    <li class="miembro" data-id="${esc(m.id)}">
      <div class="miembro-datos"><strong>${nombre}</strong><span class="chico">${esc(m.email || '')}</span></div>
      <div class="miembro-acciones">
        <button class="btn secundario chico-btn" data-accion="aprobar">Aprobar</button>
        <button class="btn texto peligro-texto" data-accion="rechazar">Rechazar</button>
      </div>
    </li>`;
  }
  if (m.rol === 'JOVEN') {
    const numero = (m.telefono || '').replace('+', '');
    detalle = `${esc(m.telefono || '')} · ${m.evaluaciones} ${m.evaluaciones === 1 ? 'evaluación' : 'evaluaciones'}`;
    acciones = numero ? `<a class="btn texto" href="https://wa.me/${esc(numero)}" target="_blank" rel="noopener">WhatsApp</a>` : '';
  } else {
    detalle = `${esc(m.email || '')} · avisos ${m.avisosActivos ? 'activos' : 'por correo'}${m.tieneClave ? '' : ' · sin contraseña'}`;
    // Para otras personas: enlace para crear o cambiar su contraseña (por ejemplo, si la olvidó).
    // La propia contraseña se cambia en Ajustes.
    if (m.id !== yo) {
      acciones = `<button class="btn texto" data-accion="acceso">Enviar acceso</button><select data-accion="rol" aria-label="Rol de ${nombre}">
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
  const pendientes = miembros.filter((m) => m.pendiente);
  const de = (rol) => miembros.filter((m) => m.rol === rol && !m.pendiente);
  caja.innerHTML = `
    ${pendientes.length ? `<div class="solicitudes">${grupoMiembros('Solicitudes para orar', pendientes, yo, '')}
      <p class="chico">Aprueba solo a personas que conozcas: verán los nombres de los jóvenes.</p></div>` : ''}
    ${grupoMiembros('Líderes', de('LIDER'), yo, '')}
    ${grupoMiembros('Orantes', de('ORANTE'), yo, 'Aún no hay orantes. Comparte el enlace de invitación.')}
    ${grupoMiembros('Jóvenes', de('JOVEN'), yo, 'Aún no hay jóvenes registrados.')}`;
  return miembros;
}

export async function vistaLider() {
  const vista = pintar(`
    <h1>Grupo</h1>
    <div class="tarjeta" id="caja-resumen"><p class="cargando">Cargando…</p></div>

    <div class="tarjeta">
      <h2 style="margin-top:0">Invitar a orar</h2>
      <p class="chico">Comparte este enlace con quien quiera sumarse a orar por los jóvenes. Cada persona que se registre quedará pendiente hasta que la apruebes aquí. Los jóvenes no lo necesitan para anotar sus pruebas.</p>
      <p class="enlace-invitacion" id="codigo">…</p>
      <div style="display:grid;gap:10px">
        <a class="btn" id="whatsapp" target="_blank" rel="noopener" href="#">Compartir por WhatsApp</a>
        <button class="btn secundario" id="copiar">Copiar enlace</button>
        <button class="btn texto peligro-texto" id="nuevo">Generar un enlace nuevo</button>
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

  const mostrarEnlace = (enlace) => {
    caja.textContent = enlace;
    const texto = `Te invito a sumarte a orar por los jóvenes de CR: ${enlace}`;
    vista.querySelector('#whatsapp').href = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  };
  api('/lider/invitacion')
    .then((r) => mostrarEnlace(r.enlace))
    .catch((err) => { caja.textContent = '—'; avisar(err.message); });
  cargarResumen();
  cargarMiembros();

  vista.querySelector('#copiar').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(caja.textContent);
      avisar('Enlace copiado');
    } catch {
      avisar('No se pudo copiar; mantén presionado el enlace para copiarlo.');
    }
  });
  vista.querySelector('#nuevo').addEventListener('click', async (e) => {
    const boton = e.currentTarget;
    if (!(await confirmar('El enlace actual dejará de servir para registrarse. Úsalo si se compartió con quien no debía.', { titulo: '¿Generar un enlace nuevo?', aceptar: 'Generar' }))) return;
    conCarga(boton, null, async () => {
      mostrarEnlace((await api('/lider/invitacion', { metodo: 'POST' })).enlace);
      avisar('Listo, hay un enlace nuevo');
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
    const boton = ev.target.closest('button[data-accion]');
    if (!boton) return;
    const m = persona(boton.closest('.miembro'));
    const accion = boton.dataset.accion;

    if (accion === 'acceso') {
      await conCarga(boton, null, async () => {
        const r = await api(`/lider/miembros/${m.id}/acceso`, { metodo: 'POST' });
        mostrarEnlace({
          titulo: `Acceso para ${m.nombre}`,
          texto: 'Con este enlace podrá crear una contraseña nueva. Sirve una sola vez y vence en 24 horas. Envíaselo solo a esa persona.',
          enlace: r.enlace,
          mensaje: `Hola ${m.nombre}, con este enlace puedes crear tu contraseña para CR ora por ti:`
        });
      });
      return;
    }

    if (accion === 'aprobar') {
      await conCarga(boton, null, async () => {
        await api(`/lider/miembros/${m.id}/aprobar`, { metodo: 'POST' });
        avisar(`${m.nombre} ya puede orar con el grupo. Le avisamos por correo.`);
        await Promise.all([cargarMiembros(), cargarResumen()]);
      });
      return;
    }

    if (accion !== 'quitar' && accion !== 'rechazar') return;
    const seguro = accion === 'rechazar'
      ? await confirmar(`${m.nombre} no podrá ver la agenda ni recibir avisos.`, { titulo: '¿Rechazar solicitud?', aceptar: 'Rechazar', peligro: true })
      : await confirmar(`Se borrarán sus datos${m.rol === 'JOVEN' ? ' y todas sus evaluaciones' : ''}. No se puede deshacer.`, { titulo: `¿Quitar a ${m.nombre}?`, aceptar: 'Quitar', peligro: true });
    if (!seguro) return;
    await conCarga(boton, null, async () => {
      await api(`/lider/miembros/${m.id}`, { metodo: 'DELETE' });
      avisar(accion === 'rechazar' ? 'Solicitud rechazada' : `${m.nombre} ya no está en el grupo`);
      await Promise.all([cargarMiembros(), cargarResumen()]);
    });
  });
}
