import { api } from './api.js';
import { esc } from './ui.js';
import { vistaLogin, vistaCodigo, vistaEnlace } from './vistas/login.js';
import { vistaBienvenida, vistaMis } from './vistas/joven.js';
import { vistaAgenda } from './vistas/agenda.js';
import { vistaLider } from './vistas/lider.js';

const estado = { user: null };

// Rutas abiertas: el joven no inicia sesión.
const PUBLICAS = {
  '/bienvenida': vistaBienvenida,
  '/mis': vistaMis,
  '/login': (ctx) => vistaLogin({ ...ctx, pestana: 'entrar' }),
  '/registro': (ctx) => vistaLogin({ ...ctx, pestana: 'registro' }),
  '/codigo': vistaCodigo,
  '/entrar': vistaEnlace
};
// Login y registro no tienen sentido con sesión iniciada.
const SOLO_SIN_SESION = ['/login', '/registro', '/codigo'];

// Requieren sesión (orantes y líder).
const PRIVADAS = {
  '/agenda': { vista: vistaAgenda },
  '/lider': { vista: vistaLider, roles: ['LIDER'] }
};

const MENU = [
  { ruta: '#/agenda', texto: 'Agenda' },
  { ruta: '#/lider', texto: 'Líder', roles: ['LIDER'] },
  { ruta: '#/salir', texto: 'Salir' }
];

function irA(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function pintarMenu(ruta) {
  const nav = document.getElementById('nav');
  if (!estado.user) {
    nav.hidden = true;
    return;
  }
  nav.hidden = false;
  nav.innerHTML = MENU.filter((m) => !m.roles || m.roles.includes(estado.user.rol))
    .map((m) => `<a href="${m.ruta}" class="${m.ruta === '#' + ruta ? 'activo' : ''}">${esc(m.texto)}</a>`)
    .join('');
}

async function render() {
  const [ruta, query = ''] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(query);
  const ctx = {
    irA,
    params,
    user: estado.user,
    alEntrar(user) {
      estado.user = user;
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
  if (privada.roles && !privada.roles.includes(estado.user.rol)) return irA('#/agenda');
  pintarMenu(ruta);
  await privada.vista(ctx);
  document.getElementById('vista').focus({ preventScroll: true });
}

async function iniciar() {
  try {
    estado.user = (await api('/yo')).user;
  } catch {
    estado.user = null;
  }
  window.addEventListener('hashchange', render);
  render();
}

iniciar();
