// Textos compartidos de la interfaz.
export const TIPOS = {
  PRUEBA: { nombre: 'Prueba', emoji: '📝' },
  EXAMEN: { nombre: 'Examen', emoji: '🎓' },
  TRABAJO: { nombre: 'Trabajo', emoji: '📂' },
  OTRO: { nombre: 'Otro', emoji: '📌' }
};

export const ANIMOS = {
  BIEN: { texto: 'Bien', emoji: '😊' },
  MAS_O_MENOS: { texto: 'Más o menos', emoji: '😐' },
  NECESITA_ORACION: { texto: 'Necesito oración', emoji: '🙏' }
};

// "prueba de Matemáticas"
export function queTiene(e) {
  return `${TIPOS[e.tipo].nombre.toLowerCase()} de ${e.ramo}`;
}
