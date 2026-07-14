/**
 * Plan freemium — beta: todo gratis; estructura lista para activar limites tras legal.
 * No integra pagos (Stripe) hasta consulta legal y validacion con usuarios.
 */

/** Mientras true, no se aplican limites de pago (beta publica). */
export const BETA_GRATIS = true;

export const PLAN = {
  id: BETA_GRATIS ? "beta" : "gratis",
  nombre: BETA_GRATIS ? "Beta gratuita" : "Gratis",
  precioEur: BETA_GRATIS ? 0 : 0,
  premiumPrecioEur: 2.99,
  maxSeguimientos: BETA_GRATIS ? 50 : 8,
  maxSeguimientosPremium: 999,
  fundadoresGratisDePorVida: 100,
};

export function esPremium() {
  if (BETA_GRATIS) return true;
  try {
    return localStorage.getItem("interino_premium_v1") === "1";
  } catch {
    return false;
  }
}

export function limiteSeguimientos() {
  return esPremium() ? PLAN.maxSeguimientosPremium : PLAN.maxSeguimientos;
}

export function puedeAnadirSeguimiento(cantidadActual) {
  return cantidadActual < limiteSeguimientos();
}

export function mensajeLimiteSeguimientos() {
  if (BETA_GRATIS) {
    return `Beta: hasta ${PLAN.maxSeguimientos} seguimientos gratis. Premium (${PLAN.premiumPrecioEur} €) cuando activemos cobros tras consulta legal.`;
  }
  return `Plan gratis: max. ${PLAN.maxSeguimientos} seguimientos. Premium: ${PLAN.premiumPrecioEur} €/mes (proximamente).`;
}

export const FEATURES_PREMIUM = [
  "Seguimientos ilimitados",
  "Notificaciones cuando cambie tu posicion (push en segundo plano)",
  "Historico extendido de corte y tendencia",
  "Sincronizacion en la nube entre dispositivos",
];
