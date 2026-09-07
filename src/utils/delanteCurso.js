/**
 * Diff de listados: quiénes estaban por delante al inicio de curso y ya no aparecen.
 * Ausencia ≠ adjudicación oficial; copy prudente en UI.
 */

import { gerenciaCorta } from "../datos.jsx";
import { snapshotInicioCurso, opcionesDesdeIndex, cursoDeFecha } from "../cursosHistoricos.js";

function clavePersona(f) {
  const dni = String(f.dniParcial || f.dni_parcial || "").trim();
  if (dni) return `dni:${dni}`;
  const n = String(f.nombreCompleto || f.apellidos_nombre || "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return n ? `nom:${n}` : "";
}

function normalizarFila(f, total) {
  const nombreCompleto = String(f.nombreCompleto || f.apellidos_nombre || "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    nombreCompleto,
    dniParcial: f.dniParcial || f.dni_parcial || "",
    posicion: Number(f.pos ?? f.orden ?? f.posicion) || 0,
    puntos: Number(f.puntos ?? f.comprobado_baremo) || 0,
    total: total || Number(f.total) || 0,
  };
}

/**
 * @param {object[]} filasAntes
 * @param {object[]} filasAhora
 * @param {{ posicion: number, dniParcial?: string, nombreCompleto?: string }} yo
 */
export function clasificarDelanteCurso(filasAntes, filasAhora, yo) {
  const miPos = Number(yo?.posicion) || 0;
  if (miPos <= 1) {
    return { delanteAntes: [], siguen: [], ausentes: [], detrasAhora: [], fechaInicio: null };
  }

  const mapaAhora = new Map();
  for (const f of filasAhora || []) {
    const k = clavePersona(f);
    if (k) mapaAhora.set(k, normalizarFila(f, filasAhora.length));
  }

  const delanteAntes = (filasAntes || [])
    .map((f) => normalizarFila(f, filasAntes.length))
    .filter((f) => f.posicion > 0 && f.posicion < miPos)
    .sort((a, b) => a.posicion - b.posicion);

  const siguen = [];
  const ausentes = [];
  const detrasAhora = [];

  for (const p of delanteAntes) {
    const k = clavePersona(p);
    const hoy = k ? mapaAhora.get(k) : null;
    if (!hoy) {
      ausentes.push(p);
    } else if (hoy.posicion > 0 && hoy.posicion < miPos) {
      siguen.push({ ...p, posicionActual: hoy.posicion });
    } else {
      detrasAhora.push({ ...p, posicionActual: hoy.posicion });
    }
  }

  return { delanteAntes, siguen, ausentes, detrasAhora };
}

/**
 * Carga filas de una gerencia/ámbito desde capa (live o archive).
 */
export async function cargarFilasGerencia(capa, { grupoId, categoria, gerencia, ambito }) {
  if (!capa?.obtenerListadoCompleto) return [];
  try {
    return await capa.obtenerListadoCompleto(grupoId, categoria, gerenciaCorta(gerencia) || gerencia, ambito || "");
  } catch {
    return [];
  }
}

/**
 * Orquesta inicio de curso (archive) vs actual.
 */
export async function analizarDelanteCursoAnterior({
  datos,
  archiveIndex,
  ctx,
  posicionActual,
}) {
  const opciones = opcionesDesdeIndex(archiveIndex, {
    sectorApp: "sanidad",
    ccaaId: ctx.ccaaId || "clm",
  });
  const inicio = snapshotInicioCurso(opciones);
  if (!inicio?.fecha) {
    return { ok: false, motivo: "sin_archive" };
  }

  const capaInicio = datos?.paraSector?.(ctx.ccaaId || "clm", "sanidad", {
    fechaSnapshot: inicio.fecha,
  });
  const capaActual =
    datos?.paraSector?.(ctx.ccaaId || "clm", "sanidad") ||
    datos?.paraCcaa?.(ctx.ccaaId || "clm");

  const [filasAntes, filasAhora] = await Promise.all([
    cargarFilasGerencia(capaInicio, ctx),
    cargarFilasGerencia(capaActual, ctx),
  ]);

  if (!filasAntes.length) return { ok: false, motivo: "sin_listado_inicio" };
  if (!filasAhora.length) return { ok: false, motivo: "sin_listado_actual" };

  // Posición al inicio del curso (del propio candidato)
  const yoClave = clavePersona(ctx.candidato || ctx);
  let posInicio = 0;
  for (const f of filasAntes) {
    if (clavePersona(f) === yoClave) {
      posInicio = Number(f.pos ?? f.orden) || 0;
      break;
    }
  }
  if (!posInicio) return { ok: false, motivo: "no_estabas" };

  const diff = clasificarDelanteCurso(filasAntes, filasAhora, {
    posicion: posInicio,
    ...ctx.candidato,
  });

  return {
    ok: true,
    fechaInicio: inicio.fecha,
    curso: inicio.curso || cursoDeFecha(inicio.fecha),
    posicionInicio: posInicio,
    posicionActual: Number(posicionActual) || 0,
    ...diff,
  };
}
