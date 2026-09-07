/**
 * Coordenadas aproximadas (viewBox 0–100) de gerencias SESCAM en CLM.
 * Nombres alineados con gerenciaCorta() de la app.
 */
export const GERENCIAS_GEO = {
  Guadalajara: { x: 72, y: 18, provincia: "Guadalajara" },
  Cuenca: { x: 78, y: 42, provincia: "Cuenca" },
  Albacete: { x: 72, y: 62, provincia: "Albacete" },
  Almansa: { x: 85, y: 68, provincia: "Albacete" },
  Hellin: { x: 78, y: 78, provincia: "Albacete" },
  Villarrobledo: { x: 62, y: 58, provincia: "Albacete" },
  "Ciudad Real": { x: 48, y: 62, provincia: "Ciudad Real" },
  "Alcazar de San Juan": { x: 52, y: 52, provincia: "Ciudad Real" },
  Manzanares: { x: 48, y: 70, provincia: "Ciudad Real" },
  Valdepenas: { x: 52, y: 78, provincia: "Ciudad Real" },
  Puertollano: { x: 38, y: 72, provincia: "Ciudad Real" },
  Tomelloso: { x: 58, y: 58, provincia: "Ciudad Real" },
  Toledo: { x: 42, y: 38, provincia: "Toledo" },
  "Toledo AE": { x: 45, y: 34, provincia: "Toledo" },
  "Talavera de la Reina": { x: 28, y: 36, provincia: "Toledo" },
  Parapléjicos: { x: 40, y: 32, provincia: "Toledo" },
};

/** Silueta simplificada de Castilla-La Mancha (viewBox 0 0 100 100). */
export const CLM_PATH =
  "M18,28 L32,18 L48,14 L62,12 L78,16 L88,28 L92,42 L90,58 L84,72 L76,86 L60,92 L42,90 L28,82 L18,68 L14,48 Z";

export function geoDeGerencia(nombreCorto) {
  return GERENCIAS_GEO[nombreCorto] || null;
}
