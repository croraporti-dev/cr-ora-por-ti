// Textos compartidos de la interfaz.
export const TIPOS = {
  PRUEBA: { nombre: 'Prueba' },
  EXAMEN: { nombre: 'Examen' },
  TRABAJO: { nombre: 'Trabajo' },
  OTRO: { nombre: 'Otro' }
};

export const ANIMOS = {
  BIEN: { texto: 'Bien', etiqueta: 'Le fue bien' },
  MAS_O_MENOS: { texto: 'Más o menos', etiqueta: 'Más o menos' },
  NECESITA_ORACION: { texto: 'Necesito oración', etiqueta: 'Pide oración' }
};

// "Prueba", o lo que escribió el joven si eligió "Otro" (ej: "Disertación").
export function nombreTipo(e) {
  if (e.tipo === 'OTRO') return e.tipoOtro || 'Evaluación';
  return TIPOS[e.tipo].nombre;
}

// "prueba de Matemáticas"
export function queTiene(e) {
  return `${nombreTipo(e).toLowerCase()} de ${e.ramo}`;
}
