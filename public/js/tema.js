// Tema de la app: 'auto' sigue al celular; 'light' u 'dark' lo fija en este dispositivo.
// index.html lo aplica antes de pintar (para que no parpadee); aquí se cambia desde Ajustes.
const CLAVE = 'cr_tema';
// Mismo color que la barra de arriba de la app, para que la barra del celular no resalte.
const COLOR_BARRA = { light: '#ffffff', dark: '#151e2e' };

export function leerTema() {
  try {
    const t = localStorage.getItem(CLAVE);
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

export function aplicarTema(tema) {
  try {
    if (tema === 'auto') localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, tema);
  } catch { /* sin almacenamiento: vale solo mientras esté abierta */ }
  const raiz = document.documentElement;
  if (tema === 'auto') delete raiz.dataset.theme;
  else raiz.dataset.theme = tema;
  // La barra del navegador acompaña al tema elegido.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.content = tema === 'auto' ? COLOR_BARRA[m.media.includes('dark') ? 'dark' : 'light'] : COLOR_BARRA[tema];
  });
}
