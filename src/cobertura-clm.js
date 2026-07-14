/** Cobertura de datos CLM y helpers de frescura para la UI. */
import { CUERPO_SLUG } from "./educacion.js";

const METADATA_JSON = new Set(["manifest.json", "categorias.json", "afinidad.json"]);

export function contarListadosManifest(manifest) {
  return (manifest?.archivos || []).filter(
    (a) =>
      a.endsWith(".json") &&
      !a.endsWith(".busqueda.json") &&
      !METADATA_JSON.has(a.split("/").pop()),
  ).length;
}

function relEspecialidad(cuerpoCodigo, esp, slugArchivo) {
  const grupoId = CUERPO_SLUG[cuerpoCodigo];
  if (!grupoId) return null;
  const m = esp.match(/^(\d{3})\s+(.+)$/);
  if (!m) return null;
  return `${grupoId}/${slugArchivo(`${m[1]}-${m[2]}`)}.json`;
}

/** Compara catalogo educacion con manifests disponibles y bolsa. */
export function calcularCoberturaEducacion(categoriasDoc, manifestDisponibles, manifestBolsa, slugArchivo) {
  const archivosD = new Set(manifestDisponibles?.archivos || []);
  const archivosB = new Set(manifestBolsa?.archivos || []);
  let catalogo = 0;
  const faltantesDisponibles = [];
  const faltantesBolsa = [];

  for (const cuerpo of categoriasDoc?.cuerpos || []) {
    for (const esp of cuerpo.especialidades || []) {
      catalogo += 1;
      const rel = relEspecialidad(cuerpo.codigo, esp, slugArchivo);
      if (!rel) continue;
      const base = {
        cuerpo: cuerpo.nombre,
        codigoCuerpo: cuerpo.codigo,
        especialidad: esp,
        rel,
      };
      if (!archivosD.has(rel)) faltantesDisponibles.push(base);
      if (!archivosB.has(rel)) faltantesBolsa.push(base);
    }
  }

  return {
    catalogo,
    disponibles: contarListadosManifest(manifestDisponibles),
    bolsa: contarListadosManifest(manifestBolsa),
    faltantesDisponibles,
    faltantesBolsa,
    urlPortal:
      categoriasDoc?.fuente?.pagina_bolsas ||
      "https://educacion.castillalamancha.es/profesorado/bolsas-de-trabajo",
  };
}

export function adminBolsasSinPdf(categoriasList) {
  return (categoriasList || [])
    .filter((e) => e.sin_pdf_portal)
    .map((e) => ({
      categoria: e.categoria,
      colectivo: e.colectivo,
      nota: e.nota_portal || "Sin PDF de listado en el portal.",
      url: e.url_pagina || null,
    }));
}

export function frescuraDesdeManifests(manifests) {
  return {
    sanidad: manifests.sanidad?.generado || null,
    educacionDisponibles: manifests.educacion?.generado || null,
    educacionBolsa: manifests.educacionBolsa?.generado || null,
    admin: manifests.admin?.generado || null,
  };
}

export function formatearFrescura(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Texto corto de frescura para el sector activo en buscar. */
export function etiquetaFrescuraSector(sectorId, frescura, modoListadoEducacion) {
  if (!frescura) return null;
  if (sectorId === "sanidad") return formatearFrescura(frescura.sanidad);
  if (sectorId === "administracion") return formatearFrescura(frescura.admin);
  if (sectorId === "educacion") {
    if (modoListadoEducacion === "disponibles") return formatearFrescura(frescura.educacionDisponibles);
    return formatearFrescura(frescura.educacionBolsa);
  }
  return null;
}
