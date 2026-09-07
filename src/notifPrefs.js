/** Preferencias locales de avisos (frecuencia + tipos). Se sincronizan con /api/push/subscribe. */

export const LS_NOTIF_PREFS = "interino_notif_prefs_v1";

export const FRECUENCIAS = [
  { id: "diaria", label: "Cada día", dias: 1 },
  { id: "cada_3_dias", label: "Cada 3 días", dias: 3 },
  { id: "semanal", label: "Cada semana", dias: 7 },
];

const FRECUENCIA_IDS = new Set(FRECUENCIAS.map((f) => f.id));

export function prefsNormalizadas(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const frecuencia = FRECUENCIA_IDS.has(src.frecuencia) ? src.frecuencia : "diaria";
  return {
    frecuencia,
    avisosPosicion: src.avisosPosicion !== false,
    avisosAdjudicacion: src.avisosAdjudicacion !== false,
  };
}

export function leerPrefsNotif() {
  try {
    const raw = localStorage.getItem(LS_NOTIF_PREFS);
    if (!raw) return prefsNormalizadas({});
    return prefsNormalizadas(JSON.parse(raw));
  } catch {
    return prefsNormalizadas({});
  }
}

export function guardarPrefsNotif(prefs) {
  const next = prefsNormalizadas(prefs);
  try {
    localStorage.setItem(LS_NOTIF_PREFS, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}
