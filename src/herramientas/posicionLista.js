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
