// Utilidades de interfaz compartidas por las vistas.
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function pintar(html) {
  const vista = document.getElementById('vista');
  vista.innerHTML = html;
  return vista;
}

let temporizador;
export function avisar(mensaje) {
  const el = document.getElementById('aviso');
  el.textContent = mensaje;
  el.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { el.hidden = true; }, 3500);
}

// Ejecuta una acción async desactivando el botón y mostrando el error en `cajaError`.
export async function conCarga(boton, cajaError, accion) {
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Un momento…';
  if (cajaError) cajaError.hidden = true;
  try {
    return await accion();
  } catch (err) {
    if (cajaError) {
      cajaError.textContent = err.message;
      cajaError.hidden = false;
    } else {
      avisar(err.message);
    }
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

export const NOMBRE_ROL = { JOVEN: 'Joven', ORANTE: 'Orante', LIDER: 'Líder' };
