/**
 * Contrato de seguimientos + refresco al abrir la app.
 * Identidad fija; snapshot (posición/puntos) se actualiza al refrescar.
 */

import { gerenciaCorta } from "./datos.jsx";
import { notificarLocal, notificacionesHabilitadasEnDispositivo } from "./notificaciones.js";

export { LS_SEGUIMIENTOS } from "./seguimientos-backup.js";

function nuevoId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `seg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Normaliza legado `{ categoria, gerencia, candidato }` al contrato actual. */
export function normalizarSeguimiento(raw) {
  if (!raw || typeof raw !== "object") return null;
  const c = raw.candidato || raw.persona || {};
  const nombreCompleto = String(c.nombreCompleto || raw.persona?.nombreCompleto || "").trim();
  const dniParcial = String(c.dniParcial || raw.persona?.dniParcial || "").trim();
  if (!nombreCompleto && !dniParcial) return null;

  const snapshot = {
    posicion: num(raw.snapshot?.posicion ?? c.posicion ?? c.pos),
    puntos: num(raw.snapshot?.puntos ?? c.puntos),
    total: num(raw.snapshot?.total ?? c.total),
    actualizadoEn: raw.snapshot?.actualizadoEn || raw.actualizadoEn || null,
  };

  const sector =
    raw.sector ||
    c.sector ||
    (raw.modoListado || c.tipoListado ? "educacion" : null) ||
    (/educaci|maestro|primaria|secundaria|infantil|\bfp\b|eoii|ordenaria/i.test(
      String(raw.categoria || c.categoria || ""),
    )
      ? "educacion"
      : null) ||
    (/educaci/i.test(String(raw.gerencia || c.gerencia || "")) ? "educacion" : null) ||
    (/admin|funcionario|laboral/i.test(String(raw.categoria || c.categoria || ""))
      ? "administracion"
      : null) ||
    "sanidad";

  const base = {
    id: raw.id || nuevoId(),
    ccaaId: raw.ccaaId || c.ccaaId || "clm",
    sector,
    grupoId: raw.grupoId || c.grupoId || "",
    categoria: raw.categoria || c.categoria || "",
    gerencia: raw.gerencia ?? c.gerencia ?? "",
    ambito: raw.ambito ?? c.ambito ?? "",
    modoListado: raw.modoListado || null,
    persona: { nombreCompleto, dniParcial },
    snapshot,
    ultimoCambio: raw.ultimoCambio || null,
  };

  return {
    ...base,
    // Compat UI actual (PantallaSeguimientos lee candidato.*)
    candidato: {
      ...c,
      nombreCompleto,
      dniParcial,
      posicion: snapshot.posicion,
      puntos: snapshot.puntos,
      total: snapshot.total,
      gerencia: base.gerencia,
      ambito: base.ambito,
      categoria: base.categoria,
      grupoId: base.grupoId,
      ccaaId: base.ccaaId,
      sector: base.sector,
    },
  };
}

export function crearSeguimiento({
  categoria,
  gerencia,
  ambito = "",
  grupoId = "",
  ccaaId = "clm",
  sector = "sanidad",
  modoListado = null,
  resultado,
}) {
  const nombreCompleto = String(resultado?.nombreCompleto || "").trim();
  const dniParcial = String(resultado?.dniParcial || "").trim();
  const snapshot = {
    posicion: num(resultado?.posicion ?? resultado?.pos),
    puntos: num(resultado?.puntos),
    total: num(resultado?.total),
    actualizadoEn: new Date().toISOString(),
  };
  return normalizarSeguimiento({
    id: nuevoId(),
    ccaaId: ccaaId || resultado?.ccaaId || "clm",
    sector: sector || resultado?.sector || "sanidad",
    grupoId: grupoId || resultado?.grupoId || "",
    categoria: categoria || resultado?.categoria || "",
    gerencia: gerencia ?? resultado?.gerencia ?? "",
    ambito: ambito || resultado?.ambito || "",
    modoListado,
    persona: { nombreCompleto, dniParcial },
    snapshot,
    candidato: resultado,
  });
}

export function clasificarCambio(anterior, actual) {
  if (!actual || !num(actual.posicion)) return "desconocido";
  const ap = num(anterior?.posicion);
  const bp = num(actual.posicion);
  if (!ap) return "desconocido";
  if (bp < ap) return "subio";
  if (bp > ap) return "bajo";
  return "igual";
}

function mismaGerencia(a, b) {
  const ca = gerenciaCorta(a || "");
  const cb = gerenciaCorta(b || "");
  if (!ca && !cb) return true;
  return ca === cb || a === b;
}

function mismoAmbito(a, b) {
  return String(a || "") === String(b || "");
}

function mismaPersona(persona, cand) {
  const dni = (persona.dniParcial || "").trim();
  const dniC = (cand.dniParcial || "").trim();
  if (dni && dniC && dni === dniC) return true;
  const n = (persona.nombreCompleto || "").trim().toLowerCase();
  const nC = (cand.nombreCompleto || "").trim().toLowerCase();
  return Boolean(n && nC && n === nC);
}

function consultaDePersona(persona) {
  return (persona.dniParcial || persona.nombreCompleto || "").trim();
}

function resolverCapa(datos, s) {
  const ccaaId = s.ccaaId || "clm";
  const sector = s.sector || "sanidad";
  if (typeof datos.paraSector === "function") {
    return datos.paraSector(ccaaId, sector, {
      modoListadoEducacion: s.modoListado || undefined,
    });
  }
  return datos.paraCcaa?.(ccaaId) || null;
}

/**
 * Reconsulta listados y compara con el snapshot guardado.
 * @param {object} seguimiento
 * @param {{ datos: object }} ctx
 */
export async function refrescarSeguimiento(seguimiento, ctx) {
  const s = normalizarSeguimiento(seguimiento);
  if (!s) {
    return {
      ok: false,
      motivo: "invalido",
      cambio: "desconocido",
      anterior: { posicion: 0, puntos: 0 },
      actual: null,
      seguimientoActualizado: seguimiento,
    };
  }

  const anterior = {
    posicion: s.snapshot.posicion,
    puntos: s.snapshot.puntos,
  };

  const capa = resolverCapa(ctx.datos, s);
  if (!capa?.buscarPersonas || !capa?.tieneDatosReales?.(s.categoria, s.grupoId)) {
    return {
      ok: false,
      motivo: "sin_datos",
      cambio: "desconocido",
      anterior,
      actual: null,
      seguimientoActualizado: s,
    };
  }

  const q = consultaDePersona(s.persona);
  if (!q) {
    return {
      ok: false,
      motivo: "sin_persona",
      cambio: "desconocido",
      anterior,
      actual: null,
      seguimientoActualizado: s,
    };
  }

  let personas = [];
  try {
    const res = await capa.buscarPersonas(s.grupoId, s.categoria, q);
    personas = res?.personas || [];
  } catch {
    return {
      ok: false,
      motivo: "error_red",
      cambio: "desconocido",
      anterior,
      actual: null,
      seguimientoActualizado: s,
    };
  }

  const cand = personas.find((p) => mismaPersona(s.persona, p));
  if (!cand) {
    return {
      ok: false,
      motivo: "no_encontrado",
      cambio: "desconocido",
      anterior,
      actual: null,
      seguimientoActualizado: s,
    };
  }

  const apariciones = cand.apariciones || [];
  let hit =
    apariciones.find(
      (a) => mismaGerencia(a.gerencia, s.gerencia) && mismoAmbito(a.ambito, s.ambito),
    ) || null;

  // Educación / Murcia regional: a menudo una sola aparición
  if (!hit && apariciones.length === 1) hit = apariciones[0];
  if (!hit && !s.gerencia && apariciones.length) {
    hit = apariciones.reduce((best, a) =>
      !best || num(a.posicion) < num(best.posicion) ? a : best,
    );
  }
  if (!hit) {
    return {
      ok: false,
      motivo: "no_encontrado",
      cambio: "desconocido",
      anterior,
      actual: null,
      seguimientoActualizado: s,
    };
  }

  const actual = {
    posicion: num(hit.posicion ?? hit.pos),
    puntos: num(hit.puntos),
    total: num(hit.total),
    actualizadoEn: new Date().toISOString(),
  };
  const cambio = clasificarCambio(anterior, actual);

  const seguimientoActualizado = normalizarSeguimiento({
    ...s,
    snapshot: actual,
    ultimoCambio: cambio,
    candidato: {
      ...s.candidato,
      ...hit,
      nombreCompleto: cand.nombreCompleto || s.persona.nombreCompleto,
      dniParcial: cand.dniParcial || s.persona.dniParcial,
      posicion: actual.posicion,
      puntos: actual.puntos,
      total: actual.total,
    },
  });

  return {
    ok: true,
    cambio,
    anterior,
    actual,
    seguimientoActualizado,
  };
}

export async function refrescarTodosSeguimientos(lista, ctx) {
  const out = [];
  for (const raw of lista || []) {
    // Secuencial para no martillar R2 con N categorías a la vez
    // eslint-disable-next-line no-await-in-loop
    out.push(await refrescarSeguimiento(raw, ctx));
  }
  return out;
}

export function notificarCambiosSeguimientos(resultados) {
  const relevantes = (resultados || []).filter(
    (r) => r.ok && (r.cambio === "subio" || r.cambio === "bajo"),
  );
  if (!relevantes.length || !notificacionesHabilitadasEnDispositivo()) return 0;

  if (relevantes.length === 1) {
    const r = relevantes[0];
    const s = r.seguimientoActualizado;
    const verbo = r.cambio === "subio" ? "ha subido" : "ha bajado";
    notificarLocal(
      "Cambio en un seguimiento",
      `${s.persona.nombreCompleto}: posición ${verbo} de #${r.anterior.posicion} a #${r.actual.posicion} (${s.categoria}).`,
    );
  } else {
    notificarLocal(
      "Cambios en seguimientos",
      `${relevantes.length} listas han cambiado de posición. Ábrelas en Interino para ver el detalle.`,
    );
  }
  return relevantes.length;
}
