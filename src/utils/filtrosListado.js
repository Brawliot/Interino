/**
 * Recalcula posición filtrando filas del listado (SESCAM).
 * - grupoPreferente: columna G.P. del PDF (no es «promoción interna» de otras CCAA).
 * - disponibles: al menos un tipo de contrato marcado (heurística de «activo» para llamamiento).
 */

export function tieneDisponibilidadContrato(fila) {
  const tc = fila?.tiposContrato || fila?.tipos_contrato;
  if (!tc || typeof tc !== "object") return true; // sin dato → no excluir
  const vals = Object.values(tc);
  if (!vals.length) return true;
  return vals.some(Boolean);
}

export function esGrupoPreferente(fila) {
  return Boolean(fila?.grupoPreferente ?? fila?.grupo_preferente);
}

/**
 * @param {object[]} filas — filas de app (pos/puntos) o scraper (orden/comprobado_baremo)
 * @param {{ excluirPreferentes?: boolean, soloDisponibles?: boolean }} filtros
 */
export function filtrarFilasListado(filas, filtros = {}) {
  let out = [...(filas || [])];
  if (filtros.excluirPreferentes) {
    out = out.filter((f) => !esGrupoPreferente(f));
  }
  if (filtros.soloDisponibles) {
    out = out.filter((f) => tieneDisponibilidadContrato(f));
  }
  return out;
}

function puntosDe(f) {
  return Number(f.puntos ?? f.comprobado_baremo) || 0;
}

function ordenDe(f) {
  return Number(f.pos ?? f.orden ?? f.posicion) || 0;
}

/**
 * Posición de una persona dentro de un subconjunto filtrado (reordenando por puntos).
 * @returns {{ posicion: number, total: number, delante: number, oficial: number } | null}
 */
export function posicionEnSubconjunto(filas, persona, filtros = {}) {
  const filtradas = filtrarFilasListado(filas, filtros);
  if (!filtradas.length) return null;

  const dni = String(persona?.dniParcial || "").trim();
  const nombre = String(persona?.nombreCompleto || "").trim().toLowerCase();

  const ordenadas = [...filtradas].sort(
    (a, b) => puntosDe(b) - puntosDe(a) || ordenDe(a) - ordenDe(b),
  );

  const idx = ordenadas.findIndex((f) => {
    const fd = String(f.dniParcial || f.dni_parcial || "").trim();
    const fn = String(f.nombreCompleto || f.apellidos_nombre || "")
      .replace(/\s*\n\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (dni && fd && dni === fd) return true;
    return Boolean(nombre && fn && nombre === fn);
  });
  if (idx < 0) return null;

  const oficial = ordenDe(ordenadas[idx]) || idx + 1;
  return {
    posicion: idx + 1,
    total: ordenadas.length,
    delante: idx,
    oficial,
  };
}

/** Etiquetas honestas para CLM sanidad (no inventamos «promoción interna»). */
export const MODOS_POSICION_CLM = [
  {
    id: "oficial",
    label: "Lista completa (oficial)",
    desc: "Como publica el SESCAM: incluye grupo preferente y sin filtro de contratos.",
  },
  {
    id: "sin_preferentes",
    label: "Sin grupo preferente (G.P.)",
    desc: "Recalcula el puesto excluyendo a quienes tienen marca G.P. en el PDF. No es promoción interna.",
  },
  {
    id: "solo_disponibles",
    label: "Solo con disponibilidad marcada",
    desc: "Heurística: solo filas con al menos un tipo de contrato marcado. No hay columna «desactivado» oficial.",
  },
];

export function filtrosDeModo(modoId) {
  if (modoId === "sin_preferentes") return { excluirPreferentes: true };
  if (modoId === "solo_disponibles") return { soloDisponibles: true };
  return {};
}
