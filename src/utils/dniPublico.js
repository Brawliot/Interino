/**
 * Consultas con DNI público de listados (****1234A).
 * Nunca persistimos NIF completo: si el usuario pega 8 dígitos + letra, se reduce a forma pública.
 */

/** ¿Parece NIF/NIE español completo (8 dígitos + letra o X/Y/Z + 7 dígitos + letra)? */
export function pareceNifCompleto(raw) {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, "");
  return /^\d{8}[A-Z]$/.test(s) || /^[XYZ]\d{7}[A-Z]$/.test(s);
}

/**
 * Convierte entrada de usuario a consulta pública segura.
 * - NIF completo → **** + 4 últimos dígitos + letra (formato SESCAM/listados)
 * - Ya parcial / apellidos → trim
 */
export function consultaPublicaDesdeEntrada(raw) {
  const original = String(raw || "").trim();
  if (!original) return "";
  const s = original.toUpperCase().replace(/[\s.-]/g, "");

  const nif = s.match(/^(\d{8})([A-Z])$/);
  if (nif) return `****${nif[1].slice(-4)}${nif[2]}`;

  const nie = s.match(/^([XYZ])(\d{7})([A-Z])$/);
  if (nie) return `****${nie[2].slice(-4)}${nie[3]}`;

  // Solo dígitos finales + letra típico (9885V)
  if (/^\d{3,5}[A-Z]$/.test(s)) return s;

  // Ya viene enmascarado
  if (/^\*{2,}\d+[A-Z]?$/i.test(original.replace(/\s/g, ""))) {
    return original.replace(/\s/g, "").toUpperCase();
  }

  return original;
}

/** DNI parcial apto para guardar (nunca completo). */
export function dniParcialParaGuardar(raw) {
  const q = consultaPublicaDesdeEntrada(raw);
  if (!q) return "";
  if (pareceNifCompleto(raw)) return q;
  // Si es solo nombre, no hay dni
  if (!/\d/.test(q)) return "";
  return q.length > 16 ? q.slice(0, 16) : q;
}
