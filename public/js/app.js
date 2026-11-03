import { api } from './api.js';
import { esc, esperarPintado } from './ui.js';
import { vistaLogin, vistaClave } from './vistas/login.js';
import { vistaBienvenida, vistaMis } from './vistas/joven.js';
import { vistaAgenda } from './vistas/agenda.js';
import { vistaLider } from './vistas/lider.js';
import { vistaAjustes } from './vistas/ajustes.js';
import * as push from './push.js';
import { vistaPendiente } from './vistas/pendiente.js';

const estado = { user: null, avisos: null };

async function cargarSesion() {
  try {
    ({ user: estado.user, avisos: estado.avisos } = await api('/yo'));
  } catch {
    estado.user = null;
    estado.avisos = null;
  }
}

// Rutas abiertas: el joven no inicia sesión.
const PUBLICAS = {
  '/bienvenida': vistaBienvenida,
  '/mis': vistaMis,
  '/login': (ctx) => vistaLogin({ ...ctx, pestana: 'entrar' }),
  '/registro': (ctx) => vistaLogin({ ...ctx, pestana: 'registro' }),
  '/unirse': (ctx) => vistaLogin({ ...ctx, pestana: 'registro' }),
  '/clave': vistaClave
};
// Login y registro no tienen sentido con sesión iniciada.
const SOLO_SIN_SESION = ['/login', '/registro', '/unirse'];

// Requieren sesión (orantes y líder).
const PRIVADAS = {
  '/agenda': { vista: vistaAgenda },
  '/ajustes': { vista: vistaAjustes },
  '/lider': { vista: vistaLider, roles: ['LIDER'] }
};

// Íconos simples (trazo) para la barra inferior del celular.
const ICONOS = {
  agenda: '<path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
  grupo: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><path d="M16 4.6a3.2 3.2 0 0 1 0 6.4M18 14.4c1.6.7 2.7 2.3 3 4.6"/>',
  ajustes: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'
};

const MENU = [
  { ruta: '#/agenda', texto: 'Agenda', icono: 'agenda' },
  { ruta: '#/lider', texto: 'Grupo', icono: 'grupo', roles: ['LIDER'] },
  { ruta: '#/ajustes', texto: 'Ajustes', icono: 'ajustes' }
];

function irA(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// En pantallas grandes el menú va en la barra de arriba; en celular, abajo como pestañas (al alcance del pulgar).
function pintarMenu(ruta) {
  const nav = document.getElementById('nav');
  const tabs = document.getElementById('tabs');
  // Sin sesión, o mientras su solicitud está pendiente, no hay a dónde ir.
  const visible = !!estado.user && !estado.user.pendiente;
  nav.hidden = !visible;
  tabs.hidden = !visible;
  document.body.classList.toggle('con-tabs', visible);
  if (!visible) return;
  const menu = MENU.filter((m) => !m.roles || m.roles.includes(estado.user.rol));
  const actual = (m) => (m.ruta === '#' + ruta ? 'class="activo" aria-current="page"' : '');
  nav.innerHTML = menu.map((m) => `<a href="${m.ruta}" ${actual(m)}>${esc(m.texto)}</a>`).join('');
  tabs.innerHTML = menu.map((m) => `
    <a href="${m.ruta}" ${actual(m)}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONOS[m.icono]}</svg>
      <span>${esc(m.texto)}</span>
    </a>`).join('');
}

async function render() {
  const [ruta, query = ''] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(query);
  const ctx = {
    irA,
    params,
    user: estado.user,
    avisos: estado.avisos,
    async alEntrar() {
      await cargarSesion();
      push.sincronizar();
      irA('#/agenda');
    }
  };

  if (ruta === '/salir') {
    await api('/auth/salir', { metodo: 'POST' }).catch(() => {});
    estado.user = null;
    return irA('#/bienvenida');
  }

  // Inicio: orantes y líder van a la agenda; los demás a la bienvenida.
  if (ruta === '/') return irA(estado.user ? '#/agenda' : '#/bienvenida');

  if (PUBLICAS[ruta]) {
    if (estado.user && SOLO_SIN_SESION.includes(ruta)) return irA('#/agenda');
    pintarMenu(ruta);
    return PUBLICAS[ruta](ctx);
  }

  const privada = PRIVADAS[ruta];
  if (!privada) return irA('#/');
  if (!estado.user) return irA('#/login');
  if (estado.user.pendiente) {
    pintarMenu(ruta);
    // alRevisar devuelve true si sigue pendiente.
    return vistaPendiente({
      alRevisar: async () => {
        await cargarSesion();
        if (estado.user?.pendiente) return true;
        render();
        return false;
      }
    });
  }
  if (privada.roles && !privada.roles.includes(estado.user.rol)) return irA('#/agenda');
  pintarMenu(ruta);
  await privada.vista(ctx);
  document.getElementById('vista').focus({ preventScroll: true });
}

// Al cambiar de pantalla, el contenido aparece con un fundido suave (si el navegador lo soporta
// y la persona no pidió menos movimiento). La transición espera solo el primer pintado, no la carga de datos.
function conTransicion() {
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return render();
  document.startViewTransition(() => {
    const pintado = esperarPintado();
    const listo = render().catch(() => {});
    return Promise.race([pintado, listo, new Promise((r) => setTimeout(r, 300))]);
  });
}

async function iniciar() {
  push.registrarServiceWorker();
  push.precargarClave();
  await cargarSesion();
  window.addEventListener('hashchange', conTransicion);
  // Al tocar una notificación con la app ya abierta, el service worker pide ir a esa tarjeta.
  navigator.serviceWorker?.addEventListener('message', (e) => {
    if (e.data?.tipo === 'navegar') location.hash = new URL(e.data.url, location.origin).hash;
  });
  await render();
  await push.sincronizar();
}

iniciar();
