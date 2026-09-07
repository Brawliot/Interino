/**
 * Plan freemium — beta: todo gratis con límite blando de seguimientos.
 * No integra pagos (Stripe) hasta consulta legal y validación con usuarios.
 */

/** Mientras true, no se aplican cobros (beta pública). */
export const BETA_GRATIS = true;

export const PLAN = {
  id: BETA_GRATIS ? "beta" : "gratis",
  nombre: BETA_GRATIS ? "Beta gratuita" : "Gratis",
  precioEur: 0,
  premiumPrecioEur: 2.99,
  maxSeguimientos: BETA_GRATIS ? 50 : 8,
  maxSeguimientosPremium: 999,
  fundadoresGratisDePorVida: 100,
};

export function esPremium() {
  if (BETA_GRATIS) return false;
  try {
    return localStorage.getItem("interino_premium_v1") === "1";
  } catch {
    return false;
  }
}

export function limiteSeguimientos() {
  if (BETA_GRATIS) return PLAN.maxSeguimientos;
  return esPremium() ? PLAN.maxSeguimientosPremium : PLAN.maxSeguimientos;
}

export function puedeAnadirSeguimiento(cantidadActual) {
  return cantidadActual < limiteSeguimientos();
}

export function mensajeLimiteSeguimientos() {
  if (BETA_GRATIS) {
    return `Beta gratuita: hasta ${PLAN.maxSeguimientos} seguimientos en este dispositivo. Aún no hay pagos.`;
  }
  return `Plan gratis: máximo ${PLAN.maxSeguimientos} seguimientos. Premium previsto (~${PLAN.premiumPrecioEur} €/mes): sin cobros activos ni fecha.`;
}

/** Lo que la app hace hoy (pantalla Más). */
export const FEATURES_HOY = [
  "Favoritos de aspirantes concretos (tú u otros) por DNI público o apellidos",
  "Avisos push configurables por aspirante (posición / fuera del listado)",
  "Buscar en todas las bolsas de la comunidad + simulador de provincia SESCAM",
  "Posición con filtros (lista completa / sin G.P. / con disponibilidad) y quién iba por delante al inicio de curso",
  "Puntos ↔ posición (inversa, umbrales #100/#500/#1000, ranking anónimo) y mapa CLM de oportunidades",
  "Plan de acción, informe PDF orientativo, recomendador de especialidades (educación) y logros locales",
  "Tendencia histórica orientativa (sin predicción de plaza ni IA de llamamiento)",
  "Exportar e importar una copia en archivo JSON",
  "Entrar con enlace mágico por email (sin contraseña ni pagos)",
];

/** Ideas de producto — no disponibles aún. */
export const FEATURES_PREVISTAS = [
  `Más seguimientos con un plan de pago (~${PLAN.premiumPrecioEur} €/mes)`,
];

/** @deprecated Preferir FEATURES_HOY / FEATURES_PREVISTAS */
export const FEATURES_PREMIUM = FEATURES_PREVISTAS;
