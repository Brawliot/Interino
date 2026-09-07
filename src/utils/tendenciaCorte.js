// Nº mínimo de publicaciones guardadas para atrevernos a estimar tendencia.
export const MIN_HISTORICO_TENDENCIA = 3;

// clasifica si la persona está "en zona de riesgo" de ser llamada pronto, según la velocidad real de bajada del corte
export function zonaRiesgo(puntosCandidato, historial) {
  const corteActual = historial[historial.length - 1].puntos;
  const distancia = puntosCandidato - corteActual;
  if (distancia >= 0) return { nivel: "llamado", convocatorias: 0, velocidad: null };
  // con menos publicaciones que el mínimo no se estima tendencia: sin datos, sin cuento
  if (historial.length < MIN_HISTORICO_TENDENCIA) return { nivel: "sin_historico", convocatorias: null, velocidad: null };
  const deltas = [];
  for (let i = 1; i < historial.length; i++) deltas.push(historial[i - 1].puntos - historial[i].puntos);
  const velocidad = deltas.reduce((a, b) => a + b, 0) / deltas.length; // puntos que baja el corte por convocatoria, de media
  const convocatorias = velocidad > 0 ? Math.ceil(Math.abs(distancia) / velocidad) : null;
  if (convocatorias !== null && convocatorias <= 2) return { nivel: "alto", convocatorias, velocidad };
  if (convocatorias !== null && convocatorias <= 5) return { nivel: "medio", convocatorias, velocidad };
  return { nivel: "bajo", convocatorias, velocidad };
}
