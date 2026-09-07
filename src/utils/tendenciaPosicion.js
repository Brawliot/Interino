/**
 * Tendencia / proyección de posición a partir de una serie temporal.
 * Heurística lineal (no ML): honesta y orientativa.
 */

export const MIN_PUNTOS_PREDICCION = 3;

function diaDeFecha(fecha) {
  if (!fecha || fecha === "actual") return Date.now() / 86_400_000;
  const t = Date.parse(`${fecha}T12:00:00`);
  return Number.isFinite(t) ? t / 86_400_000 : NaN;
}

/** Regresión lineal simple y = a + b x */
export function regresionLineal(xs, ys) {
  const n = xs.length;
  if (n < 2) return { a: 0, b: 0, r2: 0 };
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
    sxx += xs[i] * xs[i];
    syy += ys[i] * ys[i];
    sxy += xs[i] * ys[i];
  }
  const den = n * sxx - sx * sx;
  const b = den === 0 ? 0 : (n * sxy - sx * sy) / den;
  const a = (sy - b * sx) / n;
  const yMean = sy / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = a + b * xs[i];
    ssTot += (ys[i] - yMean) ** 2;
    ssRes += (ys[i] - pred) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { a, b, r2: Math.max(0, Math.min(1, r2)) };
}

/**
 * @param {{ fecha: string, posicion: number }[]} serie — ordenada o no
 */
export function analizarTendenciaPosicion(serie) {
  const limpia = (serie || [])
    .filter((p) => Number(p.posicion) > 0 && Number.isFinite(diaDeFecha(p.fecha)))
    .map((p) => ({ ...p, _dia: diaDeFecha(p.fecha) }))
    .sort((a, b) => a._dia - b._dia);

  if (limpia.length < MIN_PUNTOS_PREDICCION) {
    return {
      ok: false,
      motivo: "pocos_datos",
      n: limpia.length,
      min: MIN_PUNTOS_PREDICCION,
    };
  }

  const x0 = limpia[0]._dia;
  const xs = limpia.map((p) => p._dia - x0);
  const ys = limpia.map((p) => Number(p.posicion));
  const { a, b, r2 } = regresionLineal(xs, ys);
  const ultimo = limpia[limpia.length - 1];
  const spanDias = Math.max(1, ultimo._dia - limpia[0]._dia);
  // puestos por día (negativo = mejora)
  const velocidadDia = b;
  const velocidadMes = b * 30;

  let direccion = "estable";
  if (velocidadMes <= -1) direccion = "mejorando";
  else if (velocidadMes >= 1) direccion = "empeorando";

  let confianza = "baja";
  if (limpia.length >= 6 && r2 >= 0.6) confianza = "alta";
  else if (limpia.length >= 4 && r2 >= 0.35) confianza = "media";

  const proyectarDias = (dias) => {
    const x = ultimo._dia - x0 + dias;
    return Math.max(1, Math.round(a + b * x));
  };

  return {
    ok: true,
    n: limpia.length,
    r2,
    direccion,
    confianza,
    velocidadDia,
    velocidadMes,
    posicionActual: Number(ultimo.posicion),
    spanDias,
    proyectarDias,
    proyecciones: [
      { dias: 30, posicion: proyectarDias(30), label: "+30 días" },
      { dias: 60, posicion: proyectarDias(60), label: "+60 días" },
      { dias: 90, posicion: proyectarDias(90), label: "+90 días" },
    ],
  };
}

export function textoDireccion(analisis) {
  if (!analisis?.ok) return null;
  const conf =
    analisis.confianza === "alta"
      ? "confianza relativa alta"
      : analisis.confianza === "media"
        ? "confianza media"
        : "confianza baja";
  if (analisis.direccion === "mejorando") {
    const v = Math.abs(analisis.velocidadMes);
    return {
      tipo: "mejorando",
      texto: `Tendencia a mejorar (~${v.toFixed(1)} puestos/mes). ${conf} (R²=${analisis.r2.toFixed(2)}).`,
    };
  }
  if (analisis.direccion === "empeorando") {
    const v = Math.abs(analisis.velocidadMes);
    return {
      tipo: "empeorando",
      texto: `Tendencia a empeorar (~${v.toFixed(1)} puestos/mes). ${conf} (R²=${analisis.r2.toFixed(2)}).`,
    };
  }
  return {
    tipo: "estable",
    texto: `Posición relativamente estable. ${conf} (R²=${analisis.r2.toFixed(2)}).`,
  };
}

/**
 * Si la posición mejora a ritmo constante, estima días hasta un puesto objetivo.
 * No predice plazas ni llamamientos.
 */
export function diasHastaPosicionObjetivo(analisis, posicionObjetivo) {
  const meta = Number(posicionObjetivo) || 0;
  if (!analisis?.ok || meta < 1) return null;
  const actual = analisis.posicionActual;
  if (actual <= meta) {
    return { ok: true, dias: 0, yaAlcanzado: true, meta };
  }
  if (!(analisis.velocidadDia < 0)) {
    return { ok: false, motivo: "sin_mejora", meta };
  }
  const gap = actual - meta;
  const dias = Math.ceil(gap / Math.abs(analisis.velocidadDia));
  if (!Number.isFinite(dias) || dias > 3650) {
    return { ok: false, motivo: "inestable", meta };
  }
  return { ok: true, dias, yaAlcanzado: false, meta, meses: Math.round((dias / 30) * 10) / 10 };
}

/** Compara puntos actuales con el último corte histórico (orientativo). */
export function situacionVsCorte(puntosActual, cortePuntos) {
  if (cortePuntos == null || !Number.isFinite(Number(cortePuntos))) return null;
  const pts = Number(puntosActual) || 0;
  const corte = Number(cortePuntos);
  const gap = Math.round((pts - corte) * 100) / 100;
  return {
    corte,
    gap,
    porEncima: gap >= 0,
  };
}
