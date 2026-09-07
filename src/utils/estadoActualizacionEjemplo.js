import { grupoDeCategoria } from "./grupoDeCategoria.js";

export function estadoActualizacionEjemplo(categoria, gruposSanidad) {
  const grupo = grupoDeCategoria(categoria, gruposSanidad);
  if (grupo && !grupo.activo) {
    return { tipo: "sin_activar", texto: "Este grupo aún no tiene listados disponibles. Sin datos todavía." };
  }
  return { tipo: "ok", texto: "Datos orientativos de ejemplo." };
}
