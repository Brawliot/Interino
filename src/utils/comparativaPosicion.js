/**
 * Comparativa de posición entre dos momentos (live o archive).
 */

import { gerenciaCorta } from "../datos.jsx";

export function deltaPosicion(posAntes, posDespues) {
  const a = Number(posAntes);
  const b = Number(posDespues);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
  // Número de puesto: bajar de #10 a #7 es mejorar → delta negativo en "puestos"
  return b - a;
}

export function textoDelta(delta) {
  if (delta == null) return null;
  if (delta === 0) return { tipo: "igual", texto: "Misma posición" };
  if (delta < 0) {
    const n = Math.abs(delta);
    return { tipo: "subio", texto: `Ha subido ${n} puesto${n === 1 ? "" : "s"}` };
  }
  return { tipo: "bajo", texto: `Ha bajado ${delta} puesto${delta === 1 ? "" : "s"}` };
}

function mismaPersona(persona, cand) {
  const dni = String(persona?.dniParcial || "").trim();
  const dniC = String(cand?.dniParcial || "").trim();
  if (dni && dniC && dni === dniC) return true;
  const n = String(persona?.nombreCompleto || "").trim().toLowerCase();
  const nC = String(cand?.nombreCompleto || "").trim().toLowerCase();
  return Boolean(n && nC && n === nC);
}

function mismaAparicion(a, gerencia, ambito) {
  const gOk = !gerencia || gerenciaCorta(a.gerencia) === gerenciaCorta(gerencia) || a.gerencia === gerencia;
  const ambOk = String(a.ambito || "") === String(ambito || "");
  return gOk && ambOk;
}

/**
 * @returns {Promise<{ ok: boolean, posicion?: number, puntos?: number, total?: number, motivo?: string }>}
 */
export async function resolverPosicionEnCapa(capa, ctx) {
  const { grupoId, categoria, persona, gerencia, ambito } = ctx || {};
  const q = String(persona?.dniParcial || persona?.nombreCompleto || "").trim();
  if (!q) return { ok: false, motivo: "sin_persona" };
  if (!capa?.buscarPersonas) return { ok: false, motivo: "sin_capa" };

  let personas = [];
  try {
    const res = await capa.buscarPersonas(grupoId, categoria, q);
    personas = res?.personas || [];
  } catch {
    return { ok: false, motivo: "error_red" };
  }

  const cand = personas.find((p) => mismaPersona(persona, p));
  if (!cand) return { ok: false, motivo: "no_encontrado" };

  const apariciones = cand.apariciones || [];
  let hit = apariciones.find((a) => mismaAparicion(a, gerencia, ambito));
  if (!hit && apariciones.length === 1) hit = apariciones[0];
  if (!hit && !gerencia && apariciones.length) {
    hit = apariciones.reduce((best, a) =>
      !best || Number(a.posicion) < Number(best.posicion) ? a : best,
    );
  }
  if (!hit) return { ok: false, motivo: "no_encontrado" };

  return {
    ok: true,
    posicion: Number(hit.posicion ?? hit.pos) || 0,
    puntos: Number(hit.puntos) || 0,
    total: Number(hit.total) || 0,
  };
}

export function etiquetaFechaOpcion(fecha, { esActual = false } = {}) {
  if (esActual || !fecha) return "Actual (en vivo)";
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Serie temporal de posiciones (solo puntos encontrados).
 * @param {{ fecha: string, label?: string, posicion: number, puntos?: number, total?: number }[]} puntos
 */
export function normalizarSerieEvolucion(puntos) {
  return (puntos || [])
    .filter((p) => Number(p.posicion) > 0)
    .sort((a, b) => {
      if (a.fecha === "actual") return 1;
      if (b.fecha === "actual") return -1;
      return String(a.fecha).localeCompare(String(b.fecha));
    });
}

/**
 * Carga posiciones en varias fechas de archive (+ opcional punto actual).
 */
export async function construirSerieEvolucion({
  datos,
  opciones = [],
  ctx,
  live = null,
  maxPuntos = 12,
}) {
  const fechas = [...(opciones || [])]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(-Math.max(1, maxPuntos));

  const resultados = await Promise.all(
    fechas.map(async (o) => {
      const capa = datos?.paraSector?.("clm", "sanidad", { fechaSnapshot: o.fecha });
      const r = await resolverPosicionEnCapa(capa, ctx);
      if (!r.ok) return null;
      return {
        fecha: o.fecha,
        label: etiquetaFechaOpcion(o.fecha),
        curso: o.curso || null,
        posicion: r.posicion,
        puntos: r.puntos,
        total: r.total,
      };
    }),
  );

  const serie = resultados.filter(Boolean);
  if (live && Number(live.posicion) > 0) {
    serie.push({
      fecha: "actual",
      label: "Actual",
      curso: null,
      posicion: Number(live.posicion),
      puntos: Number(live.puntos) || 0,
      total: Number(live.total) || 0,
    });
  }
  return normalizarSerieEvolucion(serie);
}
