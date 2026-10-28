import { api } from '../api.js';
import { pintar, esc, conCarga, avisar, NOMBRE_ROL } from '../ui.js';

// Pantalla provisoria de la Etapa 1: la agenda llega en la Etapa 2.
export function vistaInicio({ user }) {
  pintar(`
    <h1>Hola, ${esc(user.nombre)} 👋</h1>
    <p class="sub">Entraste como <strong>${NOMBRE_ROL[user.rol]}</strong>.</p>
    <div class="tarjeta"><p>Pronto verás aquí la agenda de oración.</p></div>
  `);
}

export async function vistaLider() {
  const vista = pintar(`
    <h1>Panel de la líder</h1>
    <div class="tarjeta">
      <h2 style="margin-top:0">Código de invitación</h2>
      <p class="chico">Compártelo solo con jóvenes y personas del grupo. Si se filtra, genera uno nuevo: el anterior deja de funcionar.</p>
      <p class="codigo-invitacion" id="codigo">…</p>
      <div style="display:grid;gap:10px">
        <button class="btn secundario" id="copiar">Copiar código</button>
        <button class="btn peligro" id="nuevo">Generar un código nuevo</button>
      </div>
    </div>
  `);
  const caja = vista.querySelector('#codigo');
  try {
    caja.textContent = (await api('/lider/invitacion')).codigo;
  } catch (err) {
    caja.textContent = '—';
    avisar(err.message);
  }
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
}
