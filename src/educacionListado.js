export const LS_EDUCACION_LISTADO = "interino-educacion-listado";

export function leerModoListadoEducacion(datos) {
  try {
    const guardado = localStorage.getItem(LS_EDUCACION_LISTADO);
    if (guardado === "bolsa" && datos.educacionBolsaActiva) return "bolsa";
    if (guardado === "disponibles" && datos.educacionDisponiblesActiva) return "disponibles";
    if (guardado === "afin" && datos.educacionAfinActiva) return "afin";
  } catch { /* quota / modo privado */ }
  if (datos.educacionBolsaActiva) return "bolsa";
  if (datos.educacionDisponiblesActiva) return "disponibles";
  if (datos.educacionAfinActiva) return "afin";
  return "disponibles";
}
