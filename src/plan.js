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
  "Seguimientos en este dispositivo; con cuenta, también en la nube",
  "Avisos al abrir la app si cambia tu posición (con permiso del navegador)",
  "Exportar e importar una copia en archivo JSON",
  "Entrar con enlace mágico por email (sin contraseña ni pagos)",
];

/** Ideas de producto — no disponibles aún. */
export const FEATURES_PREVISTAS = [
  "Avisos push en segundo plano",
  `Más seguimientos con un plan de pago (~${PLAN.premiumPrecioEur} €/mes)`,
];

/** @deprecated Preferir FEATURES_HOY / FEATURES_PREVISTAS */
export const FEATURES_PREMIUM = FEATURES_PREVISTAS;
