// Web Push en el navegador: detección del entorno, permiso y suscripción.
import { api } from './api.js';

let clavePromesa = null;
let eventoInstalar = null;

// Se carga la clave al abrir la app para que, al tocar "Activar", lo PRIMERO sea pedir el permiso
// (iPhone exige que el pedido ocurra directo dentro del toque, sin esperas antes).
export function precargarClave() {
  clavePromesa ||= api('/push/clave').then((r) => r.clave).catch(() => null);
  return clavePromesa;
}

export function entorno() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const m = ua.match(/OS (\d+)_(\d+)/);
  const iosViejo = ios && !!m && (Number(m[1]) < 16 || (Number(m[1]) === 16 && Number(m[2]) < 4));
  return {
    ios,
    iosViejo,
    android: /Android/i.test(ua),
    instalada: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    soporte: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
    permiso: 'Notification' in window ? Notification.permission : 'no-disponible'
  };
}

export async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch {
    /* sin service worker la app igual funciona; solo no habrá push */
  }
}

async function registro() {
  return navigator.serviceWorker.ready;
}

export async function suscripcionActual() {
  if (!entorno().soporte) return null;
  return (await registro()).pushManager.getSubscription();
}

function base64aBytes(b64) {
  const relleno = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function mismaClave(sub, clave) {
  const actual = sub.options?.applicationServerKey;
  if (!actual) return true;
  const a = new Uint8Array(actual);
  const b = base64aBytes(clave);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

// Debe llamarse directamente desde el toque de un botón.
export async function activar() {
  const permiso = await Notification.requestPermission();
  if (permiso === 'denied') throw Object.assign(new Error('Los avisos están bloqueados para esta app.'), { bloqueado: true });
  if (permiso !== 'granted') throw new Error('Necesitamos tu permiso para enviarte avisos.');
  const clave = await precargarClave();
  if (!clave) throw new Error('El servidor aún no tiene configurados los avisos.');
  const reg = await registro();
  let sub = await reg.pushManager.getSubscription();
  if (sub && !mismaClave(sub, clave)) {
    // Cambiaron las claves del servidor: hay que rehacer la suscripción.
    await sub.unsubscribe();
    sub = null;
  }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64aBytes(clave) });
  await api('/push/suscribir', { metodo: 'POST', datos: { subscription: sub.toJSON() } });
  return sub;
}

export async function desactivar() {
  const sub = await suscripcionActual();
  if (!sub) return;
  await api('/push/desuscribir', { metodo: 'POST', datos: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}

// Al abrir la app: si este celular ya tiene permiso y suscripción, se la recordamos al servidor
// (repara suscripciones marcadas como inactivas o renovadas por el navegador).
export async function sincronizar() {
  try {
    if (entorno().permiso !== 'granted') return;
    const sub = await suscripcionActual();
    if (sub) await api('/push/suscribir', { metodo: 'POST', datos: { subscription: sub.toJSON() } });
  } catch {
    /* sin dueño (401) o sin conexión: no pasa nada */
  }
}

export async function estadoServidor(sub) {
  return api(`/push/estado${sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : ''}`);
}

// Instalación en Android/Chrome (en iPhone se hace desde el botón Compartir).
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  eventoInstalar = e;
  document.dispatchEvent(new Event('cr-instalable'));
});

export function puedeInstalar() {
  return !!eventoInstalar;
}

export async function instalar() {
  if (!eventoInstalar) return false;
  eventoInstalar.prompt();
  const { outcome } = await eventoInstalar.userChoice;
  eventoInstalar = null;
  return outcome === 'accepted';
}
