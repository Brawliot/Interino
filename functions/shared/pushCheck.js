/**
 * Comprueba seguimientos contra índices .busqueda.json en R2 y prepara avisos.
 * Preferencias: frecuencia de comprobación + tipo de aviso (posición / adjudicación).
 */

export function slugArchivo(categoriaScraper) {
  return String(categoriaScraper || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\//g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const FRECUENCIAS = [
  { id: "diaria", label: "Cada día", dias: 1 },
  { id: "cada_3_dias", label: "Cada 3 días", dias: 3 },
  { id: "semanal", label: "Cada semana", dias: 7 },
];

const FRECUENCIA_IDS = new Set(FRECUENCIAS.map((f) => f.id));

export function prefsNormalizadas(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const frecuencia = FRECUENCIA_IDS.has(src.frecuencia) ? src.frecuencia : "diaria";
  return {
    frecuencia,
    avisosPosicion: src.avisosPosicion !== false,
    avisosAdjudicacion: src.avisosAdjudicacion !== false,
  };
}

/** ¿Toca comprobar según frecuencia y last_checked_at? */
export function tocaComprobar(prefs, lastCheckedAt, nowMs = Date.now()) {
  const p = prefsNormalizadas(prefs);
  const dias = FRECUENCIAS.find((f) => f.id === p.frecuencia)?.dias ?? 1;
  if (!lastCheckedAt) return true;
  const t = new Date(lastCheckedAt).getTime();
  if (!Number.isFinite(t)) return true;
  const margenMs = 60 * 60 * 1000; // 1 h de holgura (cron diario)
  return nowMs - t >= dias * 24 * 60 * 60 * 1000 - margenMs;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function gerenciaCorta(g) {
  const s = String(g || "");
  if (!s) return "";
  if (/murcia/i.test(s)) return "Murcia";
  if (/parapl[eé]jicos/i.test(s)) return "Parapléjicos";
  const m = s.match(/^([^,(]+)/);
  return (m ? m[1] : s).trim();
}

function mismaGerencia(a, b) {
  const ca = gerenciaCorta(a);
  const cb = gerenciaCorta(b);
  if (!ca && !cb) return true;
  return ca === cb || a === b || String(a || "").includes(cb) || String(b || "").includes(ca);
}

function mismoAmbito(a, b) {
  return String(a || "") === String(b || "");
}

function mismaPersona(persona, cand) {
  const dni = (persona?.dniParcial || "").trim();
  const dniC = (cand?.dniParcial || "").trim();
  if (dni && dniC && dni === dniC) return true;
  const n = (persona?.nombreCompleto || "").trim().toLowerCase();
  const nC = (cand?.nombreCompleto || "").trim().toLowerCase();
  return Boolean(n && nC && n === nC);
}

function clasificarCambio(anterior, actual) {
  if (!actual || !num(actual.posicion)) return "desconocido";
  const ap = num(anterior?.posicion);
  const bp = num(actual.posicion);
  if (!ap) return "desconocido";
  if (bp < ap) return "subio";
  if (bp > ap) return "bajo";
  return "igual";
}

/** Bases R2 por sector (misma convención que la app). */
export function baseUrlSector(r2PublicBase, sector) {
  const base = String(r2PublicBase || "").replace(/\/?$/, "/");
  const s = sector || "sanidad";
  if (s === "educacion") return `${base}educacion/`;
  if (s === "educacion-bolsa" || s === "educacionBolsa") return `${base}educacion-bolsa/`;
  if (s === "administracion" || s === "admin") return `${base}admin-clm/`;
  return base;
}

export function urlsBusqueda(r2PublicBase, seguimiento) {
  const sector = seguimiento.sector || "sanidad";
  const base = baseUrlSector(r2PublicBase, sector);
  const gid = seguimiento.grupoId || "";
  const slug = slugArchivo(seguimiento.categoria);
  if (!slug) return [];
  const out = [];
  if (gid) {
    out.push(`${base}${gid}/${slug}.busqueda.json`);
    out.push(`${base}${gid}/${slug}.json`);
  }
  if (seguimiento.ccaaId === "mur" || gid === "murcia") {
    out.push(`${base}murcia/${slug}.busqueda.json`);
  }
  return out;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function posicionDesdeIndice(data, seguimiento) {
  const persona = seguimiento.persona || {
    nombreCompleto: seguimiento.candidato?.nombreCompleto,
    dniParcial: seguimiento.candidato?.dniParcial,
  };
  const personas = data?.personas;
  if (!Array.isArray(personas)) return null;

  const cand = personas.find((p) => mismaPersona(persona, p));
  if (!cand) return null;

  const apariciones = cand.apariciones || [];
  let hit =
    apariciones.find(
      (a) => mismaGerencia(a.gerencia, seguimiento.gerencia) && mismoAmbito(a.ambito, seguimiento.ambito),
    ) || null;
  if (!hit && apariciones.length === 1) hit = apariciones[0];
  if (!hit && !seguimiento.gerencia && apariciones.length) {
    hit = apariciones.reduce((best, a) =>
      !best || num(a.posicion) < num(best.posicion) ? a : best,
    );
  }
  if (!hit) return null;
  return {
    posicion: num(hit.posicion ?? hit.pos),
    puntos: num(hit.puntos),
    total: num(hit.total),
  };
}

function posicionDesdeListados(data, seguimiento) {
  const persona = seguimiento.persona || {
    nombreCompleto: seguimiento.candidato?.nombreCompleto,
    dniParcial: seguimiento.candidato?.dniParcial,
  };
  const listados = data?.listados;
  if (!Array.isArray(listados)) return null;

  for (const bloque of listados) {
    if (seguimiento.gerencia && !mismaGerencia(bloque.gerencia, seguimiento.gerencia)) continue;
    if (seguimiento.ambito && !mismoAmbito(bloque.ambito, seguimiento.ambito)) continue;
    const filas = bloque.filas || [];
    const total = filas.length;
    for (const f of filas) {
      const cand = {
        nombreCompleto: f.apellidos_nombre || f.nombreCompleto,
        dniParcial: f.dni_parcial || f.dniParcial,
      };
      if (!mismaPersona(persona, cand)) continue;
      return {
        posicion: num(f.pos ?? f.posicion),
        puntos: num(f.puntos),
        total,
      };
    }
  }
  return null;
}

/**
 * @returns {{ cambio: string, anterior: object, actual: object|null, seguimiento: object }}
 */
export async function evaluarSeguimiento(r2PublicBase, raw) {
  const s = raw && typeof raw === "object" ? raw : null;
  if (!s) {
    return { cambio: "desconocido", anterior: { posicion: 0 }, actual: null, seguimiento: raw };
  }

  const anterior = {
    posicion: num(s.snapshot?.posicion ?? s.candidato?.posicion),
    puntos: num(s.snapshot?.puntos ?? s.candidato?.puntos),
  };

  const urls = urlsBusqueda(r2PublicBase, s);
  let actual = null;
  let listadoCargado = false;
  for (const url of urls) {
    // eslint-disable-next-line no-await-in-loop
    const data = await fetchJson(url);
    if (!data) continue;
    listadoCargado = true;
    actual = posicionDesdeIndice(data, s) || posicionDesdeListados(data, s);
    if (actual) break;
  }

  if (!actual) {
    // Listado OK pero la persona ya no está → posible adjudicación / desactivación.
    if (listadoCargado && anterior.posicion > 0 && s.ultimoCambio !== "adjudicado") {
      const ahora = new Date().toISOString();
      const seguimiento = {
        ...s,
        snapshot: {
          ...s.snapshot,
          posicion: 0,
          puntos: anterior.puntos,
          total: s.snapshot?.total || 0,
          actualizadoEn: ahora,
          desaparecidoEn: ahora,
        },
        ultimoCambio: "adjudicado",
      };
      return { cambio: "adjudicado", anterior, actual: null, seguimiento };
    }
    return { cambio: "desconocido", anterior, actual: null, seguimiento: s };
  }

  const cambio = clasificarCambio(anterior, actual);
  const seguimiento = {
    ...s,
    snapshot: {
      ...s.snapshot,
      posicion: actual.posicion,
      puntos: actual.puntos,
      total: actual.total,
      actualizadoEn: new Date().toISOString(),
      desaparecidoEn: null,
    },
    ultimoCambio: cambio,
  };
  return { cambio, anterior, actual, seguimiento };
}

/**
 * Construye el texto del push según prefs (posición y/o adjudicación).
 * @returns {{ title: string, body: string, tag: string } | null}
 */
export function textoAviso(resultados, prefsRaw) {
  const prefs = prefsNormalizadas(prefsRaw);
  const pos = prefs.avisosPosicion
    ? (resultados || []).filter((r) => r.cambio === "subio" || r.cambio === "bajo")
    : [];
  const adj = prefs.avisosAdjudicacion
    ? (resultados || []).filter((r) => r.cambio === "adjudicado")
    : [];

  if (!pos.length && !adj.length) return null;

  if (adj.length && !pos.length) {
    if (adj.length === 1) {
      const r = adj[0];
      const nombre =
        r.seguimiento?.alias ||
        r.seguimiento?.persona?.nombreCompleto ||
        r.seguimiento?.candidato?.nombreCompleto ||
        "Un seguimiento";
      const cat = r.seguimiento?.categoria || "lista";
      return {
        title: "Ya no aparece en el listado",
        body: `${nombre} ha desaparecido de ${cat} (posible adjudicación o desactivación). Compruébalo en el portal oficial.`,
        tag: "interino-adjudicado",
      };
    }
    return {
      title: "Seguimientos fuera del listado",
      body: `${adj.length} personas ya no aparecen en sus listas. Ábrelo en Interino y confirma en el portal.`,
      tag: "interino-adjudicados",
    };
  }

  if (pos.length && !adj.length) {
    if (pos.length === 1) {
      const r = pos[0];
      const nombre =
        r.seguimiento?.alias ||
        r.seguimiento?.persona?.nombreCompleto ||
        r.seguimiento?.candidato?.nombreCompleto ||
        "Seguimiento";
      const cat = r.seguimiento?.categoria || "lista";
      const verbo = r.cambio === "subio" ? "ha subido" : "ha bajado";
      return {
        title: "Cambio en un seguimiento",
        body: `${nombre}: posición ${verbo} de #${r.anterior.posicion} a #${r.actual.posicion} (${cat}).`,
        tag: "interino-cambio",
      };
    }
    return {
      title: "Cambios en seguimientos",
      body: `${pos.length} listas han cambiado de posición. Ábrelas en Interino.`,
      tag: "interino-cambios",
    };
  }

  return {
    title: "Novedades en seguimientos",
    body: `${pos.length} cambio${pos.length === 1 ? "" : "s"} de posición y ${adj.length} fuera del listado. Ábrelo en Interino.`,
    tag: "interino-mixto",
  };
}
