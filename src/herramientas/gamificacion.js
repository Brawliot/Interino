/**
 * Logros locales (gamificación light, sin ranking social público).
 */

export const LS_LOGROS = "interino_logros_v1";

export const CATALOGO_LOGROS = [
  { id: "primer_favorito", titulo: "Primer favorito", desc: "Guardaste tu primer aspirante." },
  { id: "cinco_favoritos", titulo: "Cinco en el radar", desc: "Tienes 5 o más favoritos." },
  { id: "notif_on", titulo: "Avisos activos", desc: "Activaste notificaciones en el dispositivo." },
  { id: "baremo_usado", titulo: "Baremo explorado", desc: "Usaste el simulador de baremo." },
  { id: "mapa_usado", titulo: "Mapa visitado", desc: "Abriste el mapa de oportunidades." },
  { id: "plan_usado", titulo: "Plan generado", desc: "Generaste un plan de acción." },
  { id: "pdf_export", titulo: "Informe listo", desc: "Abriste un informe para imprimir/PDF." },
  { id: "multi_bolsa", titulo: "Radar comunitario", desc: "Buscaste en todas las bolsas de la comunidad." },
];

export function leerLogros() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_LOGROS) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function desbloquearLogro(id) {
  const prev = leerLogros();
  if (prev[id]) return { nuevo: false, logros: prev };
  const next = { ...prev, [id]: new Date().toISOString() };
  try {
    localStorage.setItem(LS_LOGROS, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return { nuevo: true, logros: next };
}

export function syncLogrosDesdeEstado({ numFavoritos, notifOn }) {
  if (numFavoritos >= 1) desbloquearLogro("primer_favorito");
  if (numFavoritos >= 5) desbloquearLogro("cinco_favoritos");
  if (notifOn) desbloquearLogro("notif_on");
}
