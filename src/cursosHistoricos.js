/**
 * Catálogo de cursos / fechas a partir de archive/index.json (R2).
 * Curso escolar CLM: 1 jul YYYY → 30 jun YYYY+1 → etiqueta "YYYY/YY+1".
 */

/** @param {string} fechaIso YYYY-MM-DD */
export function cursoDeFecha(fechaIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fechaIso || "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const startYear = month >= 7 ? y : y - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}/${endShort}`;
}

/** Sector de app → nombre(s) en archive/index.json */
export function sectoresArchivePara(sectorApp, ccaaId = "clm") {
  if (sectorApp === "sanidad") {
    if (ccaaId === "mur") return ["murcia"];
    if (ccaaId === "mad") return ["madrid"];
    return ["sanidad"];
  }
  if (sectorApp === "educacion") {
    if (ccaaId === "mur") return ["educacion-murcia"];
    return ["educacion-bolsa", "educacion"];
  }
  if (sectorApp === "administracion") return ["admin-clm"];
  return [];
}

/**
 * @param {object|null} index — archive/index.json
 * @param {{ sectorApp?: string, ccaaId?: string }} [filtros]
 * @returns {{ fecha: string, curso: string, sectores: string[], label: string }[]}
 */
export function opcionesDesdeIndex(index, filtros = {}) {
  const fechasMap = index?.fechas || {};
  const sectorApp = filtros.sectorApp || "sanidad";
  const ccaaId = filtros.ccaaId || "clm";
  const wanted = new Set(sectoresArchivePara(sectorApp, ccaaId));

  const out = [];
  for (const [fecha, meta] of Object.entries(fechasMap)) {
    const secs = meta?.sectores || [];
    if (wanted.size && !secs.some((s) => wanted.has(s))) continue;
    const curso = cursoDeFecha(fecha);
    if (!curso) continue;
    const d = new Date(`${fecha}T12:00:00`);
    const fechaLbl = Number.isNaN(d.getTime())
      ? fecha
      : d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
    out.push({
      fecha,
      curso,
      sectores: secs,
      label: `Curso ${curso} · ${fechaLbl}`,
    });
  }
  return out.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Agrupa opciones por curso (la fecha más reciente de cada curso). */
export function resumirPorCurso(opciones) {
  const map = new Map();
  for (const o of opciones || []) {
    const prev = map.get(o.curso);
    if (!prev || o.fecha > prev.fecha) map.set(o.curso, o);
  }
  return [...map.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/**
 * Prefijo R2 live → base URL del snapshot.
 * @param {string} dataBase — DATA_CATEGORIAS_BASE_URL
 * @param {string} fecha
 * @param {string} archiveSector — sanidad | murcia | educacion-bolsa | …
 */
export function urlBaseArchive(dataBase, fecha, archiveSector = "sanidad") {
  const root = String(dataBase || "/").replace(/\/?$/, "/");
  if (!archiveSector || archiveSector === "sanidad") {
    return `${root}archive/${fecha}/`;
  }
  return `${root}archive/${fecha}/${archiveSector}/`;
}
