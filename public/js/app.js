import { api } from './api.js';
import { esc } from './ui.js';
import { vistaLogin, vistaCodigo, vistaEnlace } from './vistas/login.js';
import { vistaInicio, vistaLider } from './vistas/inicio.js';

const estado = { user: null };

const PUBLICAS = {
  '/login': (ctx) => vistaLogin({ ...ctx, pestana: 'entrar' }),
  '/registro': (ctx) => vistaLogin({ ...ctx, pestana: 'registro' }),
  '/codigo': vistaCodigo,
  '/entrar': vistaEnlace
};

const PRIVADAS = {
  '/': vistaInicio,
  '/lider': vistaLider
};

const MENU = [
  { ruta: '#/', texto: 'Agenda' },
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
      irA('#/');
    }
  };

  if (ruta === '/salir') {
    await api('/auth/salir', { metodo: 'POST' }).catch(() => {});
    estado.user = null;
    return irA('#/login');
  }

  if (PUBLICAS[ruta]) {
    // Si ya hay sesión, el login no tiene sentido (salvo el enlace mágico, que puede cambiar de cuenta).
    if (estado.user && ruta !== '/entrar') return irA('#/');
    pintarMenu(ruta);
    return PUBLICAS[ruta](ctx);
  }

  if (!estado.user) return irA('#/login');
  pintarMenu(ruta);
  const vista = PRIVADAS[ruta] || PRIVADAS['/'];
  await vista(ctx);
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
