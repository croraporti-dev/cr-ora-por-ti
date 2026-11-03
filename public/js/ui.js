// Utilidades de interfaz compartidas por las vistas.
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Quien espera el primer pintado de la pantalla siguiente (para la transición entre pantallas).
let alPintar = null;
export function esperarPintado() {
  return new Promise((resolve) => { alPintar = resolve; });
}

export function pintar(html) {
  const vista = document.getElementById('vista');
  vista.innerHTML = html;
  alPintar?.();
  alPintar = null;
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

// Aviso con un botón (por ejemplo "Deshacer"). Devuelve una promesa: true si lo tocan antes de `ms`.
export function avisarConAccion(mensaje, textoBoton, ms = 6000) {
  const el = document.getElementById('aviso');
  clearTimeout(temporizador);
  el.innerHTML = '';
  const texto = document.createElement('span');
  texto.textContent = mensaje;
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'toast-accion';
  boton.textContent = textoBoton;
  el.append(texto, boton);
  el.classList.add('con-accion');
  el.hidden = false;
  return new Promise((resolve) => {
    const terminar = (valor) => {
      clearTimeout(temporizador);
      el.hidden = true;
      el.classList.remove('con-accion');
      resolve(valor);
    };
    boton.addEventListener('click', () => terminar(true), { once: true });
    temporizador = setTimeout(() => terminar(false), ms);
  });
}

// Menú de tres puntos: se abre hacia la izquierda, salvo que no quepa (botón cerca del borde izquierdo).
export function ubicarMenu(lista) {
  lista.classList.remove('hacia-derecha');
  if (lista.hidden) return;
  if (lista.getBoundingClientRect().left < 8) lista.classList.add('hacia-derecha');
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

// Diálogo para entregar un enlace: compartir por WhatsApp, copiar o cerrar.
export function mostrarEnlace({ titulo, texto, enlace, mensaje }) {
  const dialogo = document.createElement('dialog');
  dialogo.className = 'dialogo';
  dialogo.innerHTML = `
    <h2>${esc(titulo)}</h2>
    <p>${esc(texto)}</p>
    <p class="enlace-invitacion">${esc(enlace)}</p>
    <div style="display:grid;gap:10px">
      <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`${mensaje} ${enlace}`)}">Enviar por WhatsApp</a>
      <button type="button" class="btn secundario" data-copiar>Copiar enlace</button>
      <button type="button" class="btn texto" data-cerrar>Cerrar</button>
    </div>`;
  dialogo.addEventListener('click', async (e) => {
    if (e.target.closest('[data-copiar]')) {
      try {
        await navigator.clipboard.writeText(enlace);
        avisar('Enlace copiado');
      } catch {
        avisar('No se pudo copiar; mantén presionado el enlace para copiarlo.');
      }
    } else if (e.target.closest('[data-cerrar]') || e.target === dialogo) {
      dialogo.close();
    }
  });
  dialogo.addEventListener('close', () => dialogo.remove());
  document.body.append(dialogo);
  dialogo.showModal();
}

// Confirmación con el diseño de la app (en vez del confirm() del navegador).
// Devuelve una promesa: true si acepta, false si cancela, toca fuera o presiona Esc.
export function confirmar(mensaje, { titulo = '¿Estás seguro?', aceptar = 'Aceptar', cancelar = 'Cancelar', peligro = false } = {}) {
  return new Promise((resolve) => {
    const dialogo = document.createElement('dialog');
    dialogo.className = 'dialogo';
    dialogo.innerHTML = `
      <h2>${esc(titulo)}</h2>
      <p>${esc(mensaje)}</p>
      <div class="dialogo-botones">
        <button type="button" class="btn secundario" data-valor="no">${esc(cancelar)}</button>
        <button type="button" class="btn ${peligro ? 'peligro-solido' : ''}" data-valor="si">${esc(aceptar)}</button>
      </div>`;
    dialogo.addEventListener('click', (e) => {
      const boton = e.target.closest('button[data-valor]');
      if (boton) dialogo.close(boton.dataset.valor);
      else if (e.target === dialogo) dialogo.close('no'); // toque fuera del recuadro
    });
    dialogo.addEventListener('close', () => {
      resolve(dialogo.returnValue === 'si');
      dialogo.remove();
    });
    document.body.append(dialogo);
    dialogo.showModal();
    dialogo.querySelector('[data-valor="no"]').focus();
  });
}
