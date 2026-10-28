// Cliente mínimo para la API. El header X-CR-App protege contra CSRF.
export async function api(ruta, { metodo = 'GET', datos } = {}) {
  const opciones = { method: metodo, credentials: 'same-origin', headers: { 'X-CR-App': '1' } };
  if (datos !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(datos);
  }
  let res;
  try {
    res = await fetch(`/api${ruta}`, opciones);
  } catch {
    throw new Error('No hay conexión. Revisa tu internet e inténtalo de nuevo.');
  }
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(cuerpo.error || 'Algo salió mal. Inténtalo de nuevo.');
    error.status = res.status;
    throw error;
  }
  return cuerpo;
}

// sessionStorage puede fallar en modo privado; nunca debe romper la app.
export const memoria = {
  leer(clave) {
    try { return sessionStorage.getItem(clave); } catch { return null; }
  },
  guardar(clave, valor) {
    try { sessionStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ }
  }
};
