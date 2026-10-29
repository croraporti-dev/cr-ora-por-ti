import { api } from './api.js';
import { esc } from './ui.js';
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

const MENU = [
  { ruta: '#/agenda', texto: 'Agenda' },
  { ruta: '#/ajustes', texto: 'Ajustes' },
  { ruta: '#/lider', texto: 'Grupo', roles: ['LIDER'] },
  { ruta: '#/salir', texto: 'Cerrar sesión', clase: 'cerrar' }
];

function irA(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// En celular el menú se abre con el botón de la izquierda; en pantallas grandes se ve en línea.
function abrirMenu(abrir) {
  document.getElementById('nav').classList.toggle('abierto', abrir);
  const boton = document.getElementById('btn-menu');
  boton.setAttribute('aria-expanded', String(abrir));
  boton.setAttribute('aria-label', abrir ? 'Cerrar menú' : 'Abrir menú');
}

function pintarMenu(ruta) {
  const nav = document.getElementById('nav');
  const boton = document.getElementById('btn-menu');
  abrirMenu(false);
  if (!estado.user) {
    nav.hidden = true;
    boton.hidden = true;
    return;
  }
  nav.hidden = false;
  boton.hidden = false;
  // Mientras su solicitud está pendiente solo puede salir.
  const menu = estado.user.pendiente ? MENU.filter((m) => m.ruta === '#/salir') : MENU;
  nav.innerHTML = menu.filter((m) => !m.roles || m.roles.includes(estado.user.rol))
    .map((m) => `<a href="${m.ruta}" class="${m.ruta === '#' + ruta ? 'activo' : ''} ${m.clase || ''}">${esc(m.texto)}</a>`)
    .join('');
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

function conectarMenu() {
  const nav = document.getElementById('nav');
  const boton = document.getElementById('btn-menu');
  boton.addEventListener('click', () => abrirMenu(!nav.classList.contains('abierto')));
  // Se cierra al elegir una opción, al tocar fuera o con Esc.
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) abrirMenu(false); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.barra')) abrirMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') abrirMenu(false); });
}

async function iniciar() {
  conectarMenu();
  push.registrarServiceWorker();
  push.precargarClave();
  await cargarSesion();
  window.addEventListener('hashchange', render);
  // Al tocar una notificación con la app ya abierta, el service worker pide ir a esa tarjeta.
  navigator.serviceWorker?.addEventListener('message', (e) => {
    if (e.data?.tipo === 'navegar') location.hash = new URL(e.data.url, location.origin).hash;
  });
  await render();
  await push.sincronizar();
}

iniciar();
