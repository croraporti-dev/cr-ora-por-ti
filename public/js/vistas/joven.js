// Vista del joven: sin inicio de sesión. Primero sus datos, luego sus evaluaciones.
import { api } from '../api.js';
import { pintar, esc, conCarga, avisar } from '../ui.js';
import { TIPOS, ANIMOS, queTiene } from '../textos.js';
import { partesChile, cuando, hoyChile, yaPaso } from '../fechas.js';
import { montarTarjetaAvisos } from './avisos.js';

export function vistaBienvenida() {
  pintar(`
    <h1>Te acompañamos en oración</h1>
    <p class="sub">Anota tus pruebas, exámenes y trabajos, y un grupo de la iglesia orará por ti ese día.</p>
    <a class="btn bloque" href="#/mis">Anotar mi prueba</a>
    <p class="chico" style="margin:10px 0 28px;text-align:center">No necesitas cuenta ni contraseña.</p>
    <div class="tarjeta">
      <p style="margin-bottom:12px"><strong>¿Quieres orar por los jóvenes?</strong></p>
      <a class="btn secundario bloque" href="#/login">Entrar para orar</a>
    </div>
  `);
}

const AVISO = `Solo guardamos tu <strong>nombre, celular y el ramo, tipo, fecha y hora</strong> de tus evaluaciones.
<strong>Nunca</strong> guardamos notas ni calificaciones. Tu celular solo lo ve la líder de jóvenes.`;

function formularioPerfil() {
  return `
    <h1>Cuéntanos quién eres</h1>
    <p class="sub">Solo la primera vez. Este celular te recordará.</p>
    <form id="f-perfil" class="tarjeta" novalidate>
      <label class="campo"><span>Nombre</span><input type="text" name="nombre" autocomplete="given-name" maxlength="40" required></label>
      <label class="campo"><span>Apellido</span><input type="text" name="apellido" autocomplete="family-name" maxlength="40" required></label>
      <label class="campo"><span>Celular</span><input type="text" name="telefono" inputmode="tel" autocomplete="tel" placeholder="9 1234 5678" required></label>
      <div class="aviso-privacidad">${AVISO}</div>
      <label class="check"><input type="checkbox" name="aceptaAviso"><span>Leí y acepto el aviso.</span></label>
      <label class="check"><input type="checkbox" name="esMenor"><span>Soy menor de 18 años.</span></label>
      <label class="check" id="c-apoderado" hidden><input type="checkbox" name="apoderado"><span>Mi apoderado está en conocimiento de que uso esta app.</span></label>
      <p class="error" hidden></p>
      <button class="btn bloque">Continuar</button>
    </form>`;
}

function formularioEvaluacion(e) {
  const p = e ? partesChile(e.fechaHora) : { fecha: '', hora: '' };
  const tipo = e?.tipo || 'PRUEBA';
  return `
    <form id="f-eval" class="tarjeta" novalidate ${e ? `data-id="${esc(e.id)}"` : ''}>
      <h2 style="margin-top:0">${e ? 'Editar evaluación' : 'Anotar una evaluación'}</h2>
      <div class="opciones cuatro">
        ${Object.entries(TIPOS).map(([k, t]) => `
          <label class="opcion"><input type="radio" name="tipo" value="${k}" ${k === tipo ? 'checked' : ''}><span>${t.nombre}</span></label>`).join('')}
      </div>
      <label class="campo"><span>Ramo</span><input type="text" name="ramo" maxlength="60" placeholder="Ej: Matemáticas" value="${esc(e?.ramo || '')}" required></label>
      <div class="fila">
        <label class="campo"><span>Fecha</span><input type="date" name="fecha" min="${hoyChile()}" value="${p.fecha}" required></label>
        <label class="campo"><span>Hora</span><input type="time" name="hora" value="${p.hora || '08:00'}" required></label>
      </div>
      <p class="error" hidden></p>
      <button class="btn bloque">${e ? 'Guardar cambios' : 'Anotar'}</button>
      ${e ? '<button type="button" class="btn texto bloque" data-accion="cancelar">Cancelar</button>' : ''}
    </form>`;
}

function tarjetaAnimo(e) {
  return `
    <div class="tarjeta destacada" data-id="${esc(e.id)}">
      <p style="margin-bottom:12px"><strong>¿Cómo te fue en tu ${esc(queTiene(e))}?</strong></p>
      <div class="animos">
        ${Object.entries(ANIMOS).map(([k, a]) => `<button class="btn secundario" data-animo="${k}">${a.texto}</button>`).join('')}
      </div>
    </div>`;
}

function tarjetaMia(e) {
  const oraron = e.oraciones ? `<p class="oraron">${e.oraciones === 1 ? '1 persona oró' : `${e.oraciones} personas oraron`} por ti</p>` : '';
  const animo = e.resultadoAnimo ? `<span class="etiqueta">${ANIMOS[e.resultadoAnimo].texto}</span>` : '';
  return `
    <div class="tarjeta evaluacion" data-id="${esc(e.id)}">
      <div class="ev-titulo">${esc(TIPOS[e.tipo].nombre)} de ${esc(e.ramo)} ${animo}</div>
      <div class="ev-cuando">${esc(cuando(e.fechaHora))}</div>
      ${oraron}
      ${yaPaso(e.fechaHora) ? '' : `
        <div class="acciones">
          <button class="btn texto" data-accion="editar">Editar</button>
          <button class="btn texto peligro-texto" data-accion="borrar">Borrar</button>
        </div>`}
    </div>`;
}

export async function vistaMis() {
  const vista = pintar('<p class="cargando">Cargando…</p>');
  let datos;
  try {
    datos = await api('/joven');
  } catch (err) {
    vista.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    return;
  }
  if (!datos.joven) return mostrarPerfil(vista);
  mostrarEvaluaciones(vista, datos);
}

function mostrarPerfil(vista) {
  vista.innerHTML = formularioPerfil();
  const f = vista.querySelector('#f-perfil');
  f.esMenor.addEventListener('change', () => { vista.querySelector('#c-apoderado').hidden = !f.esMenor.checked; });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    conCarga(f.querySelector('button'), f.querySelector('.error'), async () => {
      await api('/joven/perfil', {
        metodo: 'POST',
        datos: {
          nombre: f.nombre.value, apellido: f.apellido.value, telefono: f.telefono.value,
          aceptaAviso: f.aceptaAviso.checked, esMenor: f.esMenor.checked, apoderado: f.apoderado.checked
        }
      });
      vistaMis();
    });
  });
}

function mostrarEvaluaciones(contenedor, { joven, evaluaciones }) {
  const pendientesAnimo = evaluaciones.filter((e) => yaPaso(e.fechaHora) && !e.resultadoAnimo);
  const proximas = evaluaciones.filter((e) => !yaPaso(e.fechaHora));
  const pasadas = evaluaciones.filter((e) => yaPaso(e.fechaHora) && e.resultadoAnimo);

  // Contenedor nuevo en cada render, para no acumular listeners en #vista.
  contenedor.innerHTML = '<div></div>';
  const vista = contenedor.firstElementChild;
  vista.innerHTML = `
    <h1>Hola, ${esc(joven.nombre)}</h1>
    <p class="sub">Anota tus pruebas y oraremos por ti ese día.</p>
    ${pendientesAnimo.map(tarjetaAnimo).join('')}
    <div id="caja-form">${formularioEvaluacion()}</div>
    <h2>Tus próximas evaluaciones</h2>
    ${proximas.length ? proximas.map(tarjetaMia).join('') : '<p class="vacio">Aún no tienes evaluaciones anotadas.</p>'}
    ${pasadas.length ? `<h2>Recientes</h2>${pasadas.map(tarjetaMia).join('')}` : ''}
    <h2>Avisos</h2>
    <div id="caja-avisos"></div>
    <button class="btn texto" id="no-soy">¿No eres ${esc(joven.nombre)}?</button>
  `;
  montarTarjetaAvisos(vista.querySelector('#caja-avisos'), { modo: 'joven' });

  const porId = Object.fromEntries(evaluaciones.map((e) => [e.id, e]));
  const cajaForm = vista.querySelector('#caja-form');

  function conectarFormulario() {
    const f = cajaForm.querySelector('#f-eval');
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const id = f.dataset.id;
      const datos = { tipo: f.tipo.value, ramo: f.ramo.value, fecha: f.fecha.value, hora: f.hora.value };
      conCarga(f.querySelector('button'), f.querySelector('.error'), async () => {
        await api(id ? `/joven/evaluaciones/${id}` : '/joven/evaluaciones', { metodo: id ? 'PUT' : 'POST', datos });
        avisar(id ? 'Cambios guardados' : 'Anotada. Oraremos por ti.');
        vistaMis();
      });
    });
    f.querySelector('[data-accion=cancelar]')?.addEventListener('click', () => {
      cajaForm.innerHTML = formularioEvaluacion();
      conectarFormulario();
    });
  }
  conectarFormulario();

  vista.addEventListener('click', async (ev) => {
    const boton = ev.target.closest('button');
    const tarjeta = boton?.closest('[data-id]');
    if (!boton || !tarjeta || tarjeta.matches('form')) return;
    const e = porId[tarjeta.dataset.id];

    if (boton.dataset.animo) {
      await conCarga(boton, null, async () => {
        await api(`/joven/evaluaciones/${e.id}/animo`, { metodo: 'POST', datos: { animo: boton.dataset.animo } });
        avisar('Gracias por contarnos');
        vistaMis();
      });
    } else if (boton.dataset.accion === 'editar') {
      cajaForm.innerHTML = formularioEvaluacion(e);
      conectarFormulario();
      cajaForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (boton.dataset.accion === 'borrar') {
      if (!confirm(`¿Borrar tu ${queTiene(e)}?`)) return;
      await conCarga(boton, null, async () => {
        await api(`/joven/evaluaciones/${e.id}`, { metodo: 'DELETE' });
        avisar('Evaluación borrada');
        vistaMis();
      });
    }
  });

  vista.querySelector('#no-soy').addEventListener('click', async () => {
    await api('/joven/olvidar', { metodo: 'POST' }).catch(() => {});
    vistaMis();
  });
}
