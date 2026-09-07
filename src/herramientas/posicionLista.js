import { gerenciaCorta } from "../datos.jsx";

/** Posición estimada si te insertas con `puntos` en un listado ordenado por baremo. */
export function posicionEnFilas(filas, puntos) {
  if (!filas?.length) return { posicion: null, total: 0, corte: null, distanciaCorte: null };
  const total = filas.length;
  const ordenadas = [...filas].sort((a, b) => b.puntos - a.puntos || a.pos - b.pos);
  const mayores = ordenadas.filter((f) => f.puntos > puntos).length;
  const posicion = mayores + 1;
  const corte = ordenadas[ordenadas.length - 1].puntos;
  return {
    posicion,
    total,
    corte,
    distanciaCorte: Math.round((puntos - corte) * 100) / 100,
  };
}

/** Puntos del inscrito que ocupa exactamente la posición N (1-based). */
export function puntosEnPosicion(filas, posicionObjetivo) {
  const n = Number(posicionObjetivo) || 0;
  if (!filas?.length || n < 1) return { ok: false, motivo: "sin_datos" };
  const ordenadas = [...filas].sort((a, b) => b.puntos - a.puntos || a.pos - b.pos);
  if (n > ordenadas.length) {
    return {
      ok: false,
      motivo: "fuera_rango",
      total: ordenadas.length,
      mensaje: `Solo hay ${ordenadas.length} personas en este listado.`,
    };
  }
  const fila = ordenadas[n - 1];
  return {
    ok: true,
    posicion: n,
    total: ordenadas.length,
    puntos: Number(fila.puntos) || 0,
  };
}

/**
 * Puntos mínimos orientativos para entrar en el puesto N
 * (puntos del actual N-ésimo; empates → puede hacer falta superar).
 */
export function puntosParaPosicion(filas, posicionObjetivo) {
  const r = puntosEnPosicion(filas, posicionObjetivo);
  if (!r.ok) return r;
  return {
    ...r,
    puntosMinimos: r.puntos,
    avisoEmpates: "Si hay empates de baremo, puede hacer falta superar ese umbral.",
  };
}

export const UMBRALES_POSICION = [100, 500, 1000];

/** Umbrales anónimos #100 / #500 / #1000. */
export function umbralesIntercambio(filas, umbrales = UMBRALES_POSICION) {
  return (umbrales || []).map((n) => ({
    posicion: n,
    ...puntosEnPosicion(filas, n),
  }));
}

/** Percentiles de la distribución de puntos (anónimo). */
export function percentilesPuntos(filas, qs = [0.1, 0.25, 0.5, 0.75, 0.9]) {
  if (!filas?.length) return [];
  const pts = [...filas].map((f) => Number(f.puntos) || 0).sort((a, b) => a - b);
  return qs.map((q) => {
    const idx = Math.min(pts.length - 1, Math.max(0, Math.floor(q * (pts.length - 1))));
    return { q, label: `P${Math.round(q * 100)}`, puntos: pts[idx] };
  });
}

/**
 * Sitúa una puntuación en el ranking anónimo del listado.
 */
export function rankingAnonimo(filas, puntos) {
  const est = posicionEnFilas(filas, puntos);
  if (!est.posicion || !est.total) return null;
  const percentil = Math.round((1 - est.posicion / est.total) * 100);
  return {
    posicion: est.posicion,
    total: est.total,
    delante: Math.max(0, est.posicion - 1),
    detras: Math.max(0, est.total - est.posicion),
    percentil,
    puntos: Number(puntos) || 0,
  };
}

/** Normaliza filas de app (pos/puntos) desde listado completo. */
export function filasAPuntos(filas) {
  return (filas || []).map((f) => ({
    pos: Number(f.pos ?? f.orden ?? f.posicion) || 0,
    puntos: Number(f.puntos ?? f.comprobado_baremo) || 0,
  }));
}

/** Analiza todas las gerencias de un snapshot para una categoría. */
export function analizarPorGerencias(snapshot, puntos, obtenerCorte) {
  const listados = snapshot?.listados ?? [];
  const porGerencia = new Map();

  for (const bloque of listados) {
    const g = gerenciaCorta(bloque.gerencia);
    const filas = (bloque.filas || []).map((f) => ({
      pos: f.orden,
      puntos: f.comprobado_baremo,
    }));
    const est = posicionEnFilas(filas, puntos);
    const corteHist = obtenerCorte?.(g, bloque.ambito);
    const corte = corteHist ?? est.corte;
    const distancia = corte != null ? Math.round((puntos - corte) * 100) / 100 : est.distanciaCorte;

    const prev = porGerencia.get(g);
    const entrada = {
      gerencia: g,
      gerenciaCompleta: bloque.gerencia,
      ambito: bloque.ambito,
      ...est,
      corte,
      distanciaCorte: distancia,
      inscritos: est.total,
    };

    if (!prev || (entrada.posicion != null && entrada.posicion < (prev.mejorPosicion ?? 999999))) {
      porGerencia.set(g, {
        gerencia: g,
        mejorPosicion: entrada.posicion,
        totalInscritos: entrada.total,
        corte: entrada.corte,
        distanciaCorte: entrada.distanciaCorte,
        ambito: entrada.ambito,
        detalleAmbitos: [...(prev?.detalleAmbitos || []).filter((d) => d.ambito !== bloque.ambito), entrada],
      });
    } else if (prev) {
      prev.detalleAmbitos = [...(prev.detalleAmbitos || []), entrada];
      prev.totalInscritos = Math.max(prev.totalInscritos, entrada.total);
    }
  }

  return [...porGerencia.values()].sort((a, b) => {
    const da = a.distanciaCorte ?? -9999;
    const db = b.distanciaCorte ?? -9999;
    if (db !== da) return db - da;
    return (a.mejorPosicion ?? 9999) - (b.mejorPosicion ?? 9999);
  });
}

export function analizarGerenciaDestino(snapshot, puntos, gerenciaDestino, obtenerCorte) {
  const listados = (snapshot?.listados ?? []).filter((l) => gerenciaCorta(l.gerencia) === gerenciaDestino);
  if (!listados.length) return null;
  return listados.map((bloque) => {
    const filas = (bloque.filas || []).map((f) => ({ pos: f.orden, puntos: f.comprobado_baremo }));
    const est = posicionEnFilas(filas, puntos);
    const corteHist = obtenerCorte?.(gerenciaDestino, bloque.ambito);
    const corte = corteHist ?? est.corte;
    return {
      ambito: bloque.ambito,
      ...est,
      corte,
      distanciaCorte: corte != null ? Math.round((puntos - corte) * 100) / 100 : est.distanciaCorte,
    };
  });
}

export function colorOportunidad(distancia) {
  if (distancia == null) return { bg: "#E8E2D2", text: "#5B6355", label: "Sin dato" };
  if (distancia >= 50) return { bg: "#E3EADB", text: "#3C6B4A", label: "Buena" };
  if (distancia >= 0) return { bg: "#F7E9D9", text: "#B5562F", label: "Ajustada" };
  return { bg: "#F0D8D8", text: "#8B3A3A", label: "Por debajo" };
}
