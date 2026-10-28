// Pantalla de quien se sumó por el enlace y espera aprobación: no ve nada del grupo.
import { pintar, conCarga, avisar } from '../ui.js';

export function vistaPendiente({ alRevisar }) {
  const vista = pintar(`
    <h1>Solicitud enviada</h1>
    <div class="tarjeta">
      <p style="margin-bottom:12px">Gracias por querer orar por los jóvenes. Alguien del equipo revisará tu solicitud.</p>
      <p class="chico" style="margin-bottom:16px">Cuando te aprueben te avisaremos por correo y aquí verás la agenda de oración.</p>
      <button class="btn secundario bloque" id="revisar">Revisar de nuevo</button>
    </div>
    <p class="chico">¿Tienes una prueba o trabajo? <a href="#/mis">Anótalo aquí</a>.</p>
  `);
  vista.querySelector('#revisar').addEventListener('click', (e) =>
    conCarga(e.currentTarget, null, async () => {
      if (await alRevisar()) avisar('Tu solicitud sigue pendiente');
    })
  );
}
