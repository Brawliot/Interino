import { createContext, useContext } from "react";
import { deduplicarApariciones } from "./utils/apariciones.js";
import { CCAA_LIST, esGrupoSanitarioMurcia, organismoCcaa } from "./regiones.js";
import { CUERPO_SLUG, GERENCIA_EDUCACION, usaDatosBolsaOrdinaria } from "./educacion.js";
import { codigoCuerpoDesdeGrupo, plazasAfinUi } from "./educacion-afin.js";
import { COLECTIVOS_ADMIN, ORGANISMO_ADMIN } from "./admin-clm.js";
import {
  adminBolsasSinPdf,
  calcularCoberturaEducacion,
  frescuraDesdeManifests,
} from "./cobertura-clm.js";
import { cursoDeFecha, urlBaseArchive } from "./cursosHistoricos.js";
/** Evita que el navegador/PWA sirva JSON viejos de R2 tras un scrape. */
const FETCH_DATOS = { cache: "no-store" };

async function fetchDatos(url, init = {}) {
  return fetch(url, { ...FETCH_DATOS, ...init });
}

/**
 * Base URL para todos los JSON de datos (listados + metadatos).
 * Desarrollo: /data/ → data/public/  |  Producción (R2): VITE_DATA_CATEGORIAS_URL=https://…
 */
export const DATA_CATEGORIAS_BASE_URL = (
  import.meta.env.VITE_DATA_CATEGORIAS_URL || "/data/"
).replace(/\/?$/, "/");

export const DATA_EDUCACION_BASE_URL = (() => {
  const explicit = import.meta.env.VITE_DATA_EDUCACION_URL;
  if (explicit) return explicit.replace(/\/?$/, "/");
  const sanidad = import.meta.env.VITE_DATA_CATEGORIAS_URL;
  if (sanidad) return `${sanidad.replace(/\/?$/, "/")}educacion/`;
  return "/data/educacion/";
})();

/** Bolsa ordinaria completa (listado por puntuación). Fuente distinta a «disponibles». */
export const DATA_EDUCACION_BOLSA_BASE_URL = (() => {
  const explicit = import.meta.env.VITE_DATA_EDUCACION_BOLSA_URL;
  if (explicit) return explicit.replace(/\/?$/, "/");
  const sanidad = import.meta.env.VITE_DATA_CATEGORIAS_URL;
  if (sanidad) return `${sanidad.replace(/\/?$/, "/")}educacion-bolsa/`;
  return "/data/educacion-bolsa/";
})();

export const DATA_ADMIN_CLM_BASE_URL = (() => {
  const explicit = import.meta.env.VITE_DATA_ADMIN_CLM_URL;
  if (explicit) return explicit.replace(/\/?$/, "/");
  const sanidad = import.meta.env.VITE_DATA_CATEGORIAS_URL;
  if (sanidad) return `${sanidad.replace(/\/?$/, "/")}admin-clm/`;
  return "/data/admin-clm/";
})();

/** Educación Murcia (CARM · Maestros). */
export const DATA_EDUCACION_MURCIA_BASE_URL = (() => {
  const explicit = import.meta.env.VITE_DATA_EDUCACION_MURCIA_URL;
  if (explicit) return explicit.replace(/\/?$/, "/");
  const sanidad = import.meta.env.VITE_DATA_CATEGORIAS_URL;
  if (sanidad) return `${sanidad.replace(/\/?$/, "/")}educacion-murcia/`;
  return "/data/educacion-murcia/";
})();

/** Nombre PDF → slug de archivo (debe coincidir con scraper.slug_archivo). */
export function slugArchivo(categoriaScraper) {
  return categoriaScraper
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\//g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Nombre del portal/PDF → etiqueta legible en UI. */
export function portalAUi(nombreScraper) {
  if (!nombreScraper) return nombreScraper;
  return nombreScraper
    .toLowerCase()
    .split(" ")
    .map((palabra) => {
      if (palabra.includes("/")) {
        const [a, b] = palabra.split("/");
        return `${a.charAt(0).toUpperCase()}${a.slice(1)}/${b || ""}`;
      }
      if (palabra.includes(":")) {
        const [a, b] = palabra.split(":");
        return `${a.charAt(0).toUpperCase()}${a.slice(1)}: ${b.trim().charAt(0).toUpperCase()}${b.trim().slice(1)}`;
      }
      return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    })
    .join(" ");
}

export function gerenciaCorta(gerenciaCompleta) {
  if (!gerenciaCompleta) return "";
  if (gerenciaCompleta.includes("Region de Murcia") || gerenciaCompleta.includes("Región de Murcia")) {
    return "Murcia";
  }
  if (
    gerenciaCompleta.includes("Parapléjicos") ||
    gerenciaCompleta.includes("Paraplejicos") ||
    gerenciaCompleta.includes("Hospital Nacional de Parap")
  ) {
    return "H. Parapléjicos";
  }
  if (
    gerenciaCompleta.includes("Especializada de Toledo") ||
    gerenciaCompleta.includes("Atencion Especializada de Toledo")
  ) {
    return "Toledo AE";
  }
  if (
    gerenciaCompleta.includes("Primaria de Toledo") ||
    gerenciaCompleta.includes("Atencion Primaria de Toledo")
  ) {
    return "Toledo AP";
  }
  const prefijo = "Gerencia de Atencion Integrada de ";
  if (gerenciaCompleta.startsWith(prefijo)) return gerenciaCompleta.slice(prefijo.length);
  return gerenciaCompleta;
}

/** Gerencias únicas (nombres cortos) a partir de un snapshot scrapeado. */
export function gerenciasUnicasDeSnapshot(snapshot) {
  return [...new Set((snapshot?.listados ?? []).map((l) => gerenciaCorta(l.gerencia)))].sort((a, b) =>
    a.localeCompare(b, "es")
  );
}

export function ambitoLegible(ambito) {
  if (!ambito) return "";
  if (ambito === "Atencion Primaria") return "Atención Primaria";
  if (ambito === "Atencion Especializada") return "Atención Especializada";
  return ambito;
}

function puntoMinimoValido(punto) {
  return punto != null && punto > 0;
}

function normalizarTexto(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Coincide si todos los términos encajan en apellidos, nombre o DNI parcial. */
export function coincideBusqueda(fila, consulta) {
  const tokens = normalizarTexto(consulta).split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  const apellidos = normalizarTexto(
    fila.apellidos || `${fila.ap1 || ""} ${fila.ap2 || ""}`.trim()
  );
  const nombre = normalizarTexto(fila.nombreCompleto || "");
  const dni = normalizarTexto((fila.dniParcial || "").replace(/\*/g, ""));
  return tokens.every(
    (token) => apellidos.includes(token) || nombre.includes(token) || dni.includes(token)
  );
}

function formatearNombre(apellidosNombre) {
  return apellidosNombre.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
}

function filaScraperAApp(fila, total) {
  const nombreCompleto = formatearNombre(fila.apellidos_nombre);
  const apellidos = fila.apellidos_nombre.split(",")[0].replace(/\n/g, " ").trim();
  return {
    pos: fila.orden,
    nombreCompleto,
    apellidos,
    puntos: fila.comprobado_baremo,
    total,
    dniParcial: fila.dni_parcial,
    tiposContrato: fila.tipos_contrato,
    grupoPreferente: Boolean(fila.grupo_preferente),
    ambito: fila.ambito,
    gerencia: gerenciaCorta(fila.gerencia),
    gerenciaCompleta: fila.gerencia,
  };
}

/** Construye mapa UI → scraper a partir del inventario del portal. */
export function construirMapasCategorias(categoriasPorGrupo) {
  const uiAScraper = {};
  const scraperAUi = {};
  const porGrupo = {};
  if (!categoriasPorGrupo) return { uiAScraper, scraperAUi, porGrupo };

  for (const [grupoId, info] of Object.entries(categoriasPorGrupo)) {
    const pdfs = info.categorias_pdf || [];
    const uis = pdfs.map(portalAUi);
    porGrupo[grupoId] = { pdfs, uis };
    pdfs.forEach((pdf, i) => {
      uiAScraper[uis[i]] = pdf;
      scraperAUi[pdf] = uis[i];
    });
  }
  return { uiAScraper, scraperAUi, porGrupo };
}

/** Categorías del inventario SESCAM sin PDF publicado en el portal (no mostrar en UI). */
const CATEGORIAS_SIN_PDF_PORTAL = new Set([
  // vacío: emergencias e inspector usan gerencia central (scraper lee gerencias del portal)
]);

function slugGrupoLabel(label) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function claveCategoria(nombre) {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function crearCapaBusqueda({
  ccaaId,
  gruposSanidad,
  archivosDisponibles,
  historico = [],
  rutaListado,
  rutaIndice,
  categoriaScraper,
  listadosDeSnapshot,
  organismo,
  baseUrl = DATA_CATEGORIAS_BASE_URL,
  sector = "sanidad",
}) {
  const cache = new Map();

  function tieneDatosReales(categoriaUi, grupoId) {
    const rel = rutaListado(categoriaUi, grupoId);
    return rel && archivosDisponibles.has(rel);
  }

  function tieneIndiceBusqueda(categoriaUi, grupoId) {
    const rel = rutaIndice?.(categoriaUi, grupoId);
    return rel ? archivosDisponibles.has(rel) : false;
  }

  async function cargarIndiceBusqueda(grupoId, categoriaUi) {
    const rel = rutaIndice?.(categoriaUi, grupoId);
    if (!rel) return null;
    const key = `idx/${rel}`;
    if (cache.has(key)) return cache.get(key);
    const res = await fetchDatos(`${baseUrl}${rel}`);
    if (!res.ok) return null;
    const data = await res.json();
    cache.set(key, data);
    return data;
  }

  async function cargarCategoria(grupoId, categoriaUi) {
    const rel = rutaListado(categoriaUi, grupoId);
    const key = rel;
    if (cache.has(key)) return cache.get(key);
    const res = await fetchDatos(`${baseUrl}${rel}`);
    if (!res.ok) throw new Error(`No se pudo cargar ${baseUrl}${rel} (${res.status})`);
    const data = await res.json();
    cache.set(key, data);
    return data;
  }

  function filasDesdeListados(listados) {
    const filas = [];
    listados.forEach((bloque) => {
      const total = bloque.filas.length;
      bloque.filas.forEach((f) => {
        filas.push(
          filaScraperAApp(
            { ...f, gerencia: bloque.gerencia, ambito: bloque.ambito, categoria: bloque.categoria },
            total
          )
        );
      });
    });
    return filas.sort((a, b) => a.pos - b.pos);
  }

  async function obtenerListadoCompleto(grupoId, categoriaUi, gerenciaCortaFiltro = "", ambitoFiltro = "") {
    const snap = await cargarCategoria(grupoId, categoriaUi);
    const listados = listadosDeSnapshot(snap, categoriaUi, gerenciaCortaFiltro || null, ambitoFiltro);
    return filasDesdeListados(listados);
  }

  async function buscarPersonas(grupoId, categoriaUi, consulta) {
    const q = consulta.trim();
    if (!q) return { personas: [], gerencias: [] };

    const indice = tieneIndiceBusqueda(categoriaUi, grupoId)
      ? await cargarIndiceBusqueda(grupoId, categoriaUi)
      : null;

    if (indice?.personas) {
      const gerencias = indice.gerencias || [];
      const personas = indice.personas
        .filter((p) =>
          coincideBusqueda(
            { apellidos: p.apellidos, nombreCompleto: p.nombreCompleto, dniParcial: p.dniParcial },
            q
          )
        )
        .map((p) => ({
          nombreCompleto: p.nombreCompleto,
          dniParcial: p.dniParcial,
          apariciones: deduplicarApariciones(
            (p.apariciones || []).map((a) => ({
              ...a,
              nombreCompleto: p.nombreCompleto,
              dniParcial: p.dniParcial,
              sector,
              ccaaId,
              categoria: categoriaUi,
              grupoId,
              grupoPreferente: Boolean(a.grupoPreferente ?? a.grupo_preferente),
              tiposContrato: a.tiposContrato || a.tipos_contrato || {},
            }))
          ),
        }));
      return { personas, gerencias };
    }

    const snap = await cargarCategoria(grupoId, categoriaUi);
    const gerenciasEnDatos = [...new Set((snap.listados ?? []).map((l) => gerenciaCorta(l.gerencia)))].sort((a, b) =>
      a.localeCompare(b, "es")
    );
    const filas = filasDesdeListados(listadosDeSnapshot(snap, categoriaUi));
    const porPersona = new Map();
    filas.filter((f) => coincideBusqueda(f, q)).forEach((f) => {
      const clave = f.dniParcial || f.nombreCompleto;
      if (!porPersona.has(clave)) {
        porPersona.set(clave, {
          nombreCompleto: f.nombreCompleto,
          dniParcial: f.dniParcial,
          apariciones: [],
        });
      }
      porPersona.get(clave).apariciones.push({
        sector,
        ccaaId,
        gerencia: f.gerencia,
        ambito: f.ambito,
        posicion: f.pos,
        total: f.total,
        puntos: f.puntos,
        delante: Math.max(0, f.pos - 1),
        categoria: categoriaUi,
        grupoId,
        tiposContrato: f.tiposContrato || {},
        grupoPreferente: Boolean(f.grupoPreferente),
      });
    });
    return {
      personas: [...porPersona.values()].map((p) => ({
        ...p,
        apariciones: deduplicarApariciones(p.apariciones),
      })),
      gerencias: gerenciasEnDatos,
    };
  }

  function historialCorte(categoriaUi, gerenciaCortaFiltro = "", ambitoFiltro = "") {
    const cat = categoriaScraper(categoriaUi);
    let entradas = historico.filter(
      (h) => h.categoria === cat && puntoMinimoValido(h.punto_minimo_admitido)
    );
    if (gerenciaCortaFiltro) {
      entradas = entradas.filter((h) => gerenciaCorta(h.gerencia) === gerenciaCortaFiltro);
    }
    if (ambitoFiltro) {
      entradas = entradas.filter((h) => h.ambito === ambitoFiltro);
    }
    const porFecha = new Map();
    entradas.forEach((e) => {
      const prev = porFecha.get(e.fecha);
      const punto = e.punto_minimo_admitido;
      if (prev == null || punto < prev) porFecha.set(e.fecha, punto);
    });
    return [...porFecha.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, puntos]) => ({
        fecha: new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", { month: "short", year: "numeric" }),
        puntos,
      }));
  }

  async function estadoActualizacion(categoriaUi, grupoId, grupoActivo) {
    if (grupoActivo === false) {
      return { tipo: "sin_activar", texto: "Este grupo aún no tiene listados disponibles. Sin datos todavía." };
    }
    if (!tieneDatosReales(categoriaUi, grupoId)) {
      return { tipo: "sin_datos", texto: "Aún no hay listado disponible para esta categoría." };
    }
    let generado = null;
    try {
      const snap = await cargarCategoria(grupoId, categoriaUi);
      generado = snap.generado;
    } catch {
      return { tipo: "sin_datos", texto: "No se pudo cargar el listado de esta categoría." };
    }
    if (!generado) {
      return { tipo: "desactualizado", texto: "No consta cuándo se actualizó el listado por última vez." };
    }
    const fecha = new Date(generado);
    const dias = Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
    if (dias > 14) {
      return {
        tipo: "desactualizado",
        texto: `El listado más reciente es del ${fecha.toLocaleDateString("es-ES")} (hace ${dias} días). ${organismo} puede haber publicado cambios desde entonces.`,
      };
    }
    const hace = dias === 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`;
    return { tipo: "ok", texto: `Listado actualizado: ${fecha.toLocaleString("es-ES")} (${hace}).` };
  }

  async function gerenciasDeCategoria(grupoId, categoriaUi) {
    try {
      const snap = await cargarCategoria(grupoId, categoriaUi);
      return [...new Set((snap.listados ?? []).map((l) => gerenciaCorta(l.gerencia)))].sort((a, b) =>
        a.localeCompare(b, "es")
      );
    } catch {
      return [];
    }
  }

  /** Todas las categorías/grupos activos de esta capa (comunidad × sector). */
  async function buscarGlobal(consulta) {
    const q = consulta.trim();
    if (!q) return { personas: [], gerencias: [] };
    const porPersona = new Map();
    for (const g of gruposSanidad) {
      if (!g.activo) continue;
      for (const cat of g.categorias || []) {
        if (!tieneDatosReales(cat, g.id)) continue;
        // eslint-disable-next-line no-await-in-loop
        const res = await buscarPersonas(g.id, cat, q);
        for (const p of res.personas || []) {
          const clave = p.dniParcial || p.nombreCompleto;
          const enriquecidas = (p.apariciones || []).map((a) => ({
            ...a,
            categoria: a.categoria || cat,
            grupoId: a.grupoId || g.id,
            sector: a.sector || sector,
            ccaaId: a.ccaaId || ccaaId,
          }));
          const prev = porPersona.get(clave);
          if (prev) {
            prev.apariciones = deduplicarApariciones([...prev.apariciones, ...enriquecidas]);
          } else {
            porPersona.set(clave, {
              nombreCompleto: p.nombreCompleto,
              dniParcial: p.dniParcial,
              apariciones: deduplicarApariciones(enriquecidas),
            });
          }
        }
      }
    }
    return { personas: [...porPersona.values()], gerencias: [] };
  }

  return {
    ccaaId,
    sector,
    gruposSanidad,
    tieneDatosReales,
    tieneIndiceBusqueda,
    cargarCategoria,
    gerenciasDeCategoria,
    obtenerListadoCompleto,
    buscarPersonas,
    buscarGlobal,
    historialCorte,
    estadoActualizacion,
    archivosDisponibles,
  };
}

export function crearCapaDatosClm(historico, manifest, categoriasPorGrupo, opciones = {}) {
  const baseUrl = String(opciones.baseUrl || DATA_CATEGORIAS_BASE_URL).replace(/\/?$/, "/");
  const modoHistorico = opciones.modoHistorico || null;
  const { uiAScraper, scraperAUi } = construirMapasCategorias(categoriasPorGrupo);
  const archivosDisponibles = new Set(manifest?.archivos || []);

  function esListadoCategoria(archivo) {
    return archivo.endsWith(".json") && !archivo.endsWith(".busqueda.json");
  }

  function categoriaScraper(categoriaUi) {
    return uiAScraper[categoriaUi] ?? categoriaUi.toUpperCase();
  }

  function grupoTieneDatos(grupoId) {
    const prefix = `${grupoId}/`;
    for (const archivo of archivosDisponibles) {
      if (archivo.startsWith(prefix) && esListadoCategoria(archivo)) return true;
    }
    return false;
  }

  const gruposSanidad = categoriasPorGrupo
    ? Object.entries(categoriasPorGrupo).map(([id, info]) => ({
          id,
          nombre: {
            diplomado: "Personal Sanitario Diplomado",
            licenciados: "Personal Sanitario Licenciado",
            tecnico: "Personal Sanitario Técnico",
            gestion: "Personal de Gestión y Servicios",
            facultativo: "Personal Facultativo",
          }[id] || id,
          activo: id === "facultativo" ? false : grupoTieneDatos(id),
          categorias:
            id === "facultativo"
              ? []
              : (info.categorias_pdf || [])
                  .filter((pdf) => !CATEGORIAS_SIN_PDF_PORTAL.has(pdf))
                  .map(portalAUi),
          nota:
            id === "facultativo"
              ? info.nota ||
                "El portal SESCAM no publica categorías de facultativo en el listado estático (dropdown vacío). Cuando existan PDFs, aparecerán aquí."
              : null,
        }))
    : [];

  const capa = crearCapaBusqueda({
    ccaaId: "clm",
    gruposSanidad,
    archivosDisponibles,
    historico: modoHistorico ? [] : historico,
    organismo: organismoCcaa("clm"),
    baseUrl,
    categoriaScraper,
    rutaListado: (categoriaUi) => {
      const cat = categoriaScraper(categoriaUi);
      const gid = gruposSanidad.find((g) => g.categorias.includes(categoriaUi))?.id || "diplomado";
      return `${gid}/${slugArchivo(cat)}.json`;
    },
    rutaIndice: (categoriaUi) => {
      const cat = categoriaScraper(categoriaUi);
      for (const g of gruposSanidad) {
        if (g.categorias.includes(categoriaUi)) {
          return `${g.id}/${slugArchivo(cat)}.busqueda.json`;
        }
      }
      return `diplomado/${slugArchivo(cat)}.busqueda.json`;
    },
    listadosDeSnapshot: (snapshot, categoriaUi, gerenciaCortaFiltro, ambitoFiltro) => {
      const cat = categoriaScraper(categoriaUi);
      let listados = (snapshot?.listados ?? []).filter((l) => l.categoria === cat);
      if (gerenciaCortaFiltro) {
        listados = listados.filter((l) => gerenciaCorta(l.gerencia) === gerenciaCortaFiltro);
      }
      if (ambitoFiltro) {
        listados = listados.filter((l) => l.ambito === ambitoFiltro);
      }
      return listados;
    },
  });

  function grupoDeCategoriaUi(categoriaUi) {
    return gruposSanidad.find((g) => g.categorias.includes(categoriaUi))?.id || "diplomado";
  }

  return {
    ...capa,
    baseUrl,
    modoHistorico,
    uiAScraper,
    scraperAUi,
    categoriaUiDesdeScraper: (nombre) => scraperAUi[nombre] ?? portalAUi(nombre),
    tieneDatosReales: (categoriaUi, grupoId) => {
      const gid = grupoId || grupoDeCategoriaUi(categoriaUi);
      const cat = categoriaScraper(categoriaUi);
      const rel = `${gid}/${slugArchivo(cat)}.json`;
      return archivosDisponibles.has(rel);
    },
    tieneIndiceBusqueda: (categoriaUi, grupoId) => {
      const gid = grupoId || grupoDeCategoriaUi(categoriaUi);
      const cat = categoriaScraper(categoriaUi);
      return archivosDisponibles.has(`${gid}/${slugArchivo(cat)}.busqueda.json`);
    },
    cargarCategoria: async (grupoId, categoriaUi) => {
      const gid = grupoId || grupoDeCategoriaUi(categoriaUi);
      const cat = categoriaScraper(categoriaUi);
      const rel = `${gid}/${slugArchivo(cat)}.json`;
      const res = await fetchDatos(`${baseUrl}${rel}`);
      if (!res.ok) throw new Error(`No se pudo cargar ${baseUrl}${rel} (${res.status})`);
      return res.json();
    },
    buscarPersonas: async (grupoId, categoriaUi, consulta) => {
      const gid = grupoId || grupoDeCategoriaUi(categoriaUi);
      return capa.buscarPersonas(gid, categoriaUi, consulta);
    },
    buscarGlobal: (consulta) => capa.buscarGlobal(consulta),
    obtenerListadoCompleto: async (grupoId, categoriaUi, gerencia, ambito) => {
      const gid = grupoId || grupoDeCategoriaUi(categoriaUi);
      return capa.obtenerListadoCompleto(gid, categoriaUi, gerencia, ambito);
    },
    gerenciasDeCategoria: async (grupoId, categoriaUi) => {
      const gid = grupoId || grupoDeCategoriaUi(categoriaUi);
      return capa.gerenciasDeCategoria(gid, categoriaUi);
    },
    estadoActualizacion: async (categoriaUi, grupoId, grupoActivo) => {
      if (modoHistorico?.fecha) {
        const curso = modoHistorico.curso ? `curso ${modoHistorico.curso}` : "histórico";
        return {
          tipo: "ok",
          texto: `Consulta histórica (${curso}, snapshot ${modoHistorico.fecha}). No es el listado en vivo; los seguimientos siguen anclados a datos actuales.`,
        };
      }
      return capa.estadoActualizacion(categoriaUi, grupoId, grupoActivo);
    },
  };
}

function crearCapaDatosMurcia(manifest, categoriasMurcia) {
  const archivosDisponibles = new Set(manifest?.archivos || []);
  const sanidad = (categoriasMurcia || []).filter((c) => esGrupoSanitarioMurcia(c.grupo));

  const porGrupo = new Map();
  sanidad.forEach((item) => {
    if (!porGrupo.has(item.grupo)) porGrupo.set(item.grupo, []);
    porGrupo.get(item.grupo).push(item.categoria);
  });

  const gruposSanidad = [...porGrupo.entries()]
    .map(([nombre, cats]) => {
      const id = slugGrupoLabel(nombre);
      const ordenadas = [...cats].sort((a, b) => a.localeCompare(b, "es"));
      const activo = ordenadas.some((c) => archivosDisponibles.has(`murcia/${slugArchivo(c)}.json`));
      return { id, nombre, activo, categorias: ordenadas };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  function categoriaScraper(categoriaUi) {
    return claveCategoria(categoriaUi);
  }

  return crearCapaBusqueda({
    ccaaId: "mur",
    gruposSanidad,
    archivosDisponibles,
    historico: [],
    organismo: organismoCcaa("mur"),
    categoriaScraper,
    rutaListado: (categoriaUi) => `murcia/${slugArchivo(categoriaUi)}.json`,
    rutaIndice: (categoriaUi) => `murcia/${slugArchivo(categoriaUi)}.busqueda.json`,
    listadosDeSnapshot: (snapshot, categoriaUi, gerenciaCortaFiltro, ambitoFiltro) => {
      const cat = categoriaScraper(categoriaUi);
      let listados = (snapshot?.listados ?? []).filter(
        (l) => claveCategoria(l.categoria) === cat || claveCategoria(snapshot?.categoria || "") === cat
      );
      if (gerenciaCortaFiltro) {
        listados = listados.filter((l) => gerenciaCorta(l.gerencia) === gerenciaCortaFiltro);
      }
      if (ambitoFiltro) {
        listados = listados.filter((l) => l.ambito === ambitoFiltro);
      }
      return listados;
    },
  });
}

function crearCapaDatosEducacionMurcia(manifest, opciones = {}) {
  const baseUrl = opciones.baseUrl || DATA_EDUCACION_MURCIA_BASE_URL;
  const archivosDisponibles = new Set(
    (manifest?.archivos || []).map((a) => String(a).replace(/^educacion-murcia\//, ""))
  );

  const metaPorCategoria = new Map();
  const categorias = [];

  for (const rel of archivosDisponibles) {
    if (!rel.startsWith("maestros/") || !rel.endsWith(".json") || rel.endsWith(".busqueda.json")) {
      continue;
    }
    const file = rel.slice("maestros/".length, -".json".length);
    const dash = file.indexOf("-");
    if (dash < 0) continue;
    const codigo = file.slice(0, dash).toUpperCase();
    const nombreSlug = file.slice(dash + 1).replace(/-/g, " ");
    const categoriaUi = portalAUi(nombreSlug);
    categorias.push(categoriaUi);
    metaPorCategoria.set(categoriaUi, { rel, codigo, categoriaUi });
  }

  const categoriasUnicas = [...new Set(categorias)].sort((a, b) => a.localeCompare(b, "es"));
  const gruposSanidad = categoriasUnicas.length
    ? [
        {
          id: "maestros",
          nombre: "Maestros (Infantil y Primaria)",
          activo: true,
          categorias: categoriasUnicas,
        },
      ]
    : [];

  return crearCapaBusqueda({
    ccaaId: "mur",
    sector: "educacion",
    gruposSanidad,
    archivosDisponibles,
    historico: [],
    organismo: "CARM Educación",
    baseUrl,
    categoriaScraper: (categoriaUi) => claveCategoria(categoriaUi),
    rutaListado: (categoriaUi) => metaPorCategoria.get(categoriaUi)?.rel || null,
    rutaIndice: () => null,
    listadosDeSnapshot: (snapshot, categoriaUi, _gerencia, ambitoFiltro) => {
      let listados = snapshot?.listados ?? [];
      if (ambitoFiltro) {
        listados = listados.filter((l) => l.ambito === ambitoFiltro);
      }
      // Si no hay filtro, devolver todos los bloques
      if (!listados.length && snapshot?.listados) listados = snapshot.listados;
      return listados;
    },
  });
}

function crearCapaDatosMadrid(inventario, manifestMadrid = { archivos: [] }) {
  const archivosDisponibles = new Set(manifestMadrid?.archivos || []);
  const gruposSanidad = (inventario?.grupos || []).map((g) => {
    const categorias = g.categorias || [];
    const activo = categorias.some((c) =>
      archivosDisponibles.has(`madrid/${slugArchivo(c)}.json`),
    );
    return {
      id: g.id,
      nombre: g.nombre,
      activo,
      categorias,
    };
  });

  return crearCapaBusqueda({
    ccaaId: "mad",
    gruposSanidad,
    archivosDisponibles,
    historico: [],
    organismo: organismoCcaa("mad"),
    categoriaScraper: (categoriaUi) => claveCategoria(categoriaUi),
    rutaListado: (categoriaUi) => `madrid/${slugArchivo(claveCategoria(categoriaUi))}.json`,
    rutaIndice: (categoriaUi) =>
      `madrid/${slugArchivo(claveCategoria(categoriaUi))}.busqueda.json`,
    listadosDeSnapshot: (snapshot, categoriaUi, _gerencia, ambitoFiltro) => {
      let listados = snapshot?.listados ?? [];
      if (ambitoFiltro) {
        listados = listados.filter((l) => l.ambito === ambitoFiltro);
      }
      return listados;
    },
  });
}

function nombreCuerpoUi(nombre) {
  if (!nombre) return nombre;
  return portalAUi(nombre.replace(/^PROFESORES\s+/i, "Profesores "));
}

function posicionEducacion(fila, tipoListado = "disponibles") {
  if (usaDatosBolsaOrdinaria(tipoListado)) {
    return Number(fila?.bolsa_orden ?? fila?.orden ?? 0) || 0;
  }
  return Number(fila?.orden ?? fila?.bolsa_orden ?? 0) || 0;
}

function filaEducacionAApp(fila, total, tipoListado = "disponibles") {
  const nombreCompleto = formatearNombre(fila.apellidos_nombre);
  const apellidos = fila.apellidos_nombre.split(",")[0].replace(/\n/g, " ").trim();
  const pos = posicionEducacion(fila, tipoListado);
  return {
    pos,
    nombreCompleto,
    apellidos,
    puntos: null,
    total,
    dniParcial: fila.dni_parcial,
    tipo_bolsa: fila.tipo_bolsa,
    bolsa_codigo: fila.bolsa_codigo ?? fila.tipo_bolsa_codigo,
    acceso: fila.acceso,
    orden_lista: fila.orden,
    bolsa_orden: fila.bolsa_orden,
    provincias: fila.provincias || [],
    idiomas: fila.idiomas,
    tipoListado,
  };
}

export function crearCapaDatosEducacionClm(manifest, categoriasDoc, opciones = {}) {
  const baseUrl = opciones.baseUrl || DATA_EDUCACION_BASE_URL;
  const tipoListado = opciones.tipoListado || "disponibles";
  const afinidadDoc = opciones.afinidadDoc || null;
  const archivosDisponibles = new Set(manifest?.archivos || []);
  const cache = new Map();
  const metaPorCategoria = new Map();

  function slugEspecialidad(codigo, nombre) {
    return slugArchivo(`${codigo}-${nombre}`);
  }

  const gruposSanidad = [];
  for (const cuerpo of categoriasDoc?.cuerpos || []) {
    const grupoId = CUERPO_SLUG[cuerpo.codigo];
    if (!grupoId) continue;
    const categorias = [];
    for (const esp of cuerpo.especialidades || []) {
      const m = esp.match(/^(\d{3})\s+(.+)$/);
      if (!m) continue;
      const [, codigo, nombreRaw] = m;
      const rel = `${grupoId}/${slugEspecialidad(codigo, nombreRaw)}.json`;
      if (!archivosDisponibles.has(rel)) continue;
      const categoriaUi = portalAUi(nombreRaw);
      categorias.push(categoriaUi);
      metaPorCategoria.set(`${grupoId}\0${categoriaUi}`, {
        grupoId,
        categoriaUi,
        rel,
        relIdx: rel.replace(/\.json$/, ".busqueda.json"),
        codigo,
        nombre: nombreRaw,
      });
    }
    if (categorias.length) {
      gruposSanidad.push({
        id: grupoId,
        nombre: nombreCuerpoUi(cuerpo.nombre),
        activo: true,
        categorias: [...new Set(categorias)].sort((a, b) => a.localeCompare(b, "es")),
      });
    }
  }

  function metaDe(categoriaUi, grupoId) {
    if (grupoId) {
      const directa = metaPorCategoria.get(`${grupoId}\0${categoriaUi}`);
      if (directa) return directa;
    }
    for (const g of gruposSanidad) {
      if (g.categorias.includes(categoriaUi)) {
        return metaPorCategoria.get(`${g.id}\0${categoriaUi}`);
      }
    }
    return null;
  }

  function tieneDatosReales(categoriaUi, grupoId) {
    const meta = metaDe(categoriaUi, grupoId);
    return meta ? archivosDisponibles.has(meta.rel) : false;
  }

  async function cargarJson(rel) {
    if (!rel) throw new Error("Sin ruta");
    if (cache.has(rel)) return cache.get(rel);
    const res = await fetchDatos(`${baseUrl}${rel}`);
    if (!res.ok) throw new Error(`No se pudo cargar ${baseUrl}${rel} (${res.status})`);
    const data = await res.json();
    cache.set(rel, data);
    return data;
  }

  async function cargarCategoria(grupoId, categoriaUi) {
    const meta = metaDe(categoriaUi, grupoId);
    if (!meta) throw new Error("Categoría sin datos");
    return cargarJson(meta.rel);
  }

  async function gerenciasDeCategoria() {
    return [];
  }

  async function obtenerListadoCompleto(grupoId, categoriaUi) {
    const snap = await cargarCategoria(grupoId, categoriaUi);
    const total = snap.personas?.length || 0;
    return (snap.personas || [])
      .map((f) => filaEducacionAApp(f, total, tipoListado))
      .sort((a, b) => a.pos - b.pos);
  }

  async function buscarEnIndiceMeta(meta, dniParcial, nombreCompleto) {
    if (!meta || !archivosDisponibles.has(meta.rel)) return null;
    let candidatos = [];
    try {
      const indice = await cargarJson(meta.relIdx);
      candidatos = indice.personas || [];
    } catch {
      const snap = await cargarJson(meta.rel);
      candidatos = (snap.personas || []).map((p) => ({
        nombreCompleto: formatearNombre(p.apellidos_nombre),
        dniParcial: p.dni_parcial,
        apellidos: p.apellidos_nombre.split(",")[0].replace(/\n/g, " ").trim(),
        orden: p.orden,
        bolsa_orden: p.bolsa_orden,
        bolsa_codigo: p.bolsa_codigo ?? p.tipo_bolsa_codigo,
        acceso: p.acceso,
        tipo_bolsa: p.tipo_bolsa,
        provincias: p.provincias || [],
        idiomas: p.idiomas,
      }));
    }
    const match = candidatos.find((p) =>
      dniParcial && p.dniParcial
        ? p.dniParcial === dniParcial
        : p.nombreCompleto === nombreCompleto
    );
    if (!match) return null;
    let total = candidatos.length;
    try {
      const snap = await cargarCategoria(meta.grupoId, meta.categoriaUi);
      total = snap.personas?.length || total;
    } catch {
      /* índice sin snapshot completo */
    }
    return { fila: match, total, meta };
  }

  function aparicionDesdeFila(meta, fila, total, viaBolsa) {
    const pos = posicionEducacion(fila, tipoListado);
    return {
      sector: "educacion",
      categoria: meta.categoriaUi,
      grupoId: meta.grupoId,
      ccaaId: "clm",
      gerencia: GERENCIA_EDUCACION,
      ambito: "",
      posicion: pos,
      bolsa_orden: fila.bolsa_orden,
      orden_lista: fila.orden,
      total,
      delante: Math.max(0, pos - 1),
      tipo_bolsa: fila.tipo_bolsa,
      bolsa_codigo: fila.bolsa_codigo,
      acceso: fila.acceso,
      tipoListado,
      provincias: fila.provincias || [],
      idiomas: fila.idiomas,
      viaBolsa,
    };
  }

  async function ampliarConBolsasRelacionadas(persona, metaOrigen) {
    if (tipoListado !== "afin") {
      return persona;
    }
    const apariciones = persona.apariciones.length
      ? [{ ...persona.apariciones[0], viaBolsa: "propia" }]
      : [];
    const visitado = new Set(apariciones.map((a) => `${a.grupoId}\0${a.categoria}`));
    const dni = persona.dniParcial;
    const nombre = persona.nombreCompleto;

    const metasRelacionadas = [...metaPorCategoria.values()].filter(
      (m) => m.grupoId === metaOrigen.grupoId && m !== metaOrigen
    );

    const extras = await Promise.all(
      metasRelacionadas.map((meta) => buscarEnIndiceMeta(meta, dni, nombre))
    );
    for (const hit of extras) {
      if (!hit) continue;
      const clave = `${hit.meta.grupoId}\0${hit.meta.categoriaUi}`;
      if (visitado.has(clave)) continue;
      visitado.add(clave);
      apariciones.push(aparicionDesdeFila(hit.meta, hit.fila, hit.total, "inscrita"));
    }

    const { _fila, ...limpia } = persona;
    return { ...limpia, apariciones };
  }

  function plazasAfinPara(categoriaUi, grupoId) {
    const meta = metaDe(categoriaUi, grupoId);
    if (!meta || !afinidadDoc) return [];
    const cuerpoCodigo = codigoCuerpoDesdeGrupo(meta.grupoId, CUERPO_SLUG);
    if (!cuerpoCodigo) return [];
    const inscritas = new Set([categoriaUi]);
    return plazasAfinUi(afinidadDoc, cuerpoCodigo, meta).filter((nombre) => {
      if (inscritas.has(nombre)) return false;
      inscritas.add(nombre);
      return true;
    });
  }

  async function buscarPersonas(grupoId, categoriaUi, consulta) {
    const q = consulta.trim();
    if (!q) return { personas: [], gerencias: [] };
    const meta = metaDe(categoriaUi, grupoId);
    if (!meta || !archivosDisponibles.has(meta.rel)) {
      return { personas: [], gerencias: [] };
    }

    const snap = await cargarCategoria(grupoId, categoriaUi);
    const total = snap.personas?.length || 0;

    let candidatos = [];
    try {
      const indice = await cargarJson(meta.relIdx);
      candidatos = indice.personas || [];
    } catch {
      candidatos = (snap.personas || []).map((p) => ({
        nombreCompleto: formatearNombre(p.apellidos_nombre),
        dniParcial: p.dni_parcial,
        apellidos: p.apellidos_nombre.split(",")[0].replace(/\n/g, " ").trim(),
        orden: p.orden,
        bolsa_orden: p.bolsa_orden,
        provincias: p.provincias || [],
        tipo_bolsa: p.tipo_bolsa,
        idiomas: p.idiomas,
      }));
    }

    const personasBase = candidatos
      .filter((p) =>
        coincideBusqueda(
          { apellidos: p.apellidos, nombreCompleto: p.nombreCompleto, dniParcial: p.dniParcial },
          q
        )
      )
      .map((p) => {
        const pos = posicionEducacion(p, tipoListado);
        return {
        nombreCompleto: p.nombreCompleto,
        dniParcial: p.dniParcial,
        categoria: categoriaUi,
        grupoId: meta.grupoId,
        _fila: p,
        apariciones: [
          {
            sector: "educacion",
            categoria: categoriaUi,
            grupoId: meta.grupoId,
            ccaaId: "clm",
            gerencia: GERENCIA_EDUCACION,
            ambito: "",
            posicion: pos,
            bolsa_orden: p.bolsa_orden,
            orden_lista: p.orden,
            total,
            delante: Math.max(0, pos - 1),
            tipo_bolsa: p.tipo_bolsa,
            bolsa_codigo: p.bolsa_codigo,
            acceso: p.acceso,
            tipoListado,
            provincias: p.provincias || [],
            idiomas: p.idiomas,
            ...(tipoListado === "afin" ? { viaBolsa: "propia" } : {}),
          },
        ],
      };
      });

    const personas =
      tipoListado === "afin"
        ? await Promise.all(personasBase.map((p) => ampliarConBolsasRelacionadas(p, meta)))
        : personasBase;

    return { personas, gerencias: [] };
  }

  async function estadoActualizacion(categoriaUi, grupoId, grupoActivo) {
    const etiquetaFuente =
      tipoListado === "bolsa_ordinaria"
        ? "bolsa ordinaria (listado completo por puntuación)"
        : tipoListado === "afin"
          ? "bolsas afines (posiciones en bolsa ordinaria)"
          : "aspirantes disponibles para sustituciones";
    if (grupoActivo === false) {
      return { tipo: "sin_activar", texto: "Este grupo aún no tiene listados disponibles. Sin datos todavía." };
    }
    if (!tieneDatosReales(categoriaUi, grupoId)) {
      return { tipo: "sin_datos", texto: `Aún no tenemos ${etiquetaFuente} para esta especialidad.` };
    }
    let generado = null;
    let curso = null;
    try {
      const snap = await cargarCategoria(grupoId, categoriaUi);
      generado = snap.generado;
      curso = snap.fuente?.curso;
    } catch {
      return { tipo: "sin_datos", texto: "No se pudo cargar el listado de esta especialidad." };
    }
    if (!generado) {
      return { tipo: "desactualizado", texto: "No consta cuándo se actualizó el listado por última vez." };
    }
    const fecha = new Date(generado);
    const dias = Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
    const cursoTxt = curso ? ` · curso ${curso}` : "";
    if (usaDatosBolsaOrdinaria(tipoListado)) {
      const hace = dias === 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`;
      const prefijo =
        tipoListado === "afin"
          ? "Posiciones en bolsa ordinaria (base para bolsas afines)"
          : "Bolsa ordinaria";
      return {
        tipo: dias > 60 ? "desactualizado" : "ok",
        texto: `${prefijo} ${fecha.toLocaleString("es-ES")} (${hace})${cursoTxt}. Se publica en junio/julio con la renovación anual.`,
      };
    }
    if (dias > 14) {
      return {
        tipo: "desactualizado",
        texto: `Listado de disponibles del ${fecha.toLocaleDateString("es-ES")} (hace ${dias} días). Educación CLM publica uno nuevo cada semana de adjudicación.`,
      };
    }
    const hace = dias === 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`;
    return { tipo: "ok", texto: `Disponibles actualizados ${fecha.toLocaleString("es-ES")} (${hace}).` };
  }

  return {
    ccaaId: "clm",
    sector: "educacion",
    tipoListado,
    baseUrl,
    gruposSanidad,
    archivosDisponibles,
    tieneDatosReales,
    tieneIndiceBusqueda: tieneDatosReales,
    cargarCategoria,
    gerenciasDeCategoria,
    obtenerListadoCompleto,
    buscarPersonas,
    plazasAfinPara,
    afinidadDoc,
    historialCorte: () => [],
    estadoActualizacion,
  };
}

/** @deprecated Usar crearCapaDatosClm o datos.paraCcaa() */
export function crearCapaDatos(historico, manifest, categoriasPorGrupo) {
  return crearCapaDatosClm(historico, manifest, categoriasPorGrupo);
}

function resolverGrupoMulti(gruposSanidad, capas, grupoIdOrComposite) {
  if (!grupoIdOrComposite) return null;
  if (String(grupoIdOrComposite).includes("::")) {
    const [ccaaId, grupoId] = String(grupoIdOrComposite).split("::");
    return {
      capa: capas.find((c) => c.ccaaId === ccaaId),
      grupoId,
      ccaaId,
    };
  }
  const g = gruposSanidad.find(
    (x) => x.id === grupoIdOrComposite || x.grupoId === grupoIdOrComposite
  );
  if (g) {
    return {
      capa: capas.find((c) => c.ccaaId === g.ccaaId),
      grupoId: g.grupoId,
      ccaaId: g.ccaaId,
    };
  }
  return { capa: capas[0], grupoId: grupoIdOrComposite, ccaaId: capas[0]?.ccaaId };
}

/** Fusiona varias capas regionales para búsqueda en una o varias CCAA. */
export function crearCapaDatosMulti(capas, ccaaIds) {
  const ccaaPorId = Object.fromEntries(CCAA_LIST.map((c) => [c.id, c]));
  const multi = ccaaIds.length > 1;

  const gruposSanidad = [];
  for (const capa of capas) {
    for (const g of capa.gruposSanidad || []) {
      const ccaaNombre = ccaaPorId[capa.ccaaId]?.nombre || capa.ccaaId;
      gruposSanidad.push({
        ...g,
        ccaaId: capa.ccaaId,
        ccaaNombre,
        grupoId: g.id,
        id: multi ? `${capa.ccaaId}::${g.id}` : g.id,
        nombre: multi ? `${ccaaNombre} · ${g.nombre}` : g.nombre,
      });
    }
  }

  const resolver = (grupoIdOrComposite) =>
    resolverGrupoMulti(gruposSanidad, capas, grupoIdOrComposite);

  const capaMulti = {
    ccaaIds,
    ccaaId: ccaaIds[0],
    multi,
    capas,
    gruposSanidad,

    tieneDatosReales(categoriaUi, grupoIdOrComposite) {
      const r = resolver(grupoIdOrComposite);
      if (!r?.capa) return false;
      return r.capa.tieneDatosReales(categoriaUi, r.grupoId);
    },

    tieneIndiceBusqueda(categoriaUi, grupoIdOrComposite) {
      const r = resolver(grupoIdOrComposite);
      if (!r?.capa?.tieneIndiceBusqueda) return false;
      return r.capa.tieneIndiceBusqueda(categoriaUi, r.grupoId);
    },

    async buscarPersonas(grupoIdOrComposite, categoriaUi, consulta) {
      const r = resolver(grupoIdOrComposite);
      if (!r?.capa) return { personas: [], gerencias: [] };
      const res = await r.capa.buscarPersonas(r.grupoId, categoriaUi, consulta);
      const ccaaNombre = ccaaPorId[r.ccaaId]?.nombre;
      return {
        ...res,
        personas: res.personas.map((p) => ({
          ...p,
          ccaaId: r.ccaaId,
          ccaaNombre,
          grupoId: r.grupoId,
          categoria: categoriaUi,
          apariciones: p.apariciones.map((a) => ({
            ...a,
            ccaaId: r.ccaaId,
            ccaaNombre,
            grupoId: r.grupoId,
            categoria: categoriaUi,
          })),
        })),
      };
    },

    historialCorte(categoriaUi, gerenciaCortaFiltro = "", ambitoFiltro = "", grupoIdOrComposite) {
      const r = resolver(grupoIdOrComposite);
      if (!r?.capa?.historialCorte) return [];
      return r.capa.historialCorte(categoriaUi, gerenciaCortaFiltro, ambitoFiltro);
    },

    async estadoActualizacion(categoriaUi, grupoIdOrComposite, grupoActivo) {
      const r = resolver(grupoIdOrComposite);
      if (!r?.capa) return { tipo: "sin_datos", texto: "Sin datos." };
      return r.capa.estadoActualizacion(categoriaUi, r.grupoId, grupoActivo);
    },

    async gerenciasDeCategoria(grupoIdOrComposite, categoriaUi) {
      const r = resolver(grupoIdOrComposite);
      if (!r?.capa) return [];
      return r.capa.gerenciasDeCategoria(r.grupoId, categoriaUi);
    },

    async cargarCategoria(grupoIdOrComposite, categoriaUi) {
      const r = resolver(grupoIdOrComposite);
      if (!r?.capa?.cargarCategoria) throw new Error("Sin datos");
      return r.capa.cargarCategoria(r.grupoId, categoriaUi);
    },

    async obtenerListadoCompleto(grupoIdOrComposite, categoriaUi, gerencia, ambito) {
      const r = resolver(grupoIdOrComposite);
      if (!r?.capa) return [];
      return r.capa.obtenerListadoCompleto(r.grupoId, categoriaUi, gerencia, ambito);
    },

    async buscarGlobal(consulta) {
      const q = consulta.trim();
      if (!q) return { personas: [], gerencias: [] };

      const porPersona = new Map();
      for (const g of gruposSanidad) {
        if (!g.activo) continue;
        for (const cat of g.categorias) {
          if (!capaMulti.tieneDatosReales(cat, g.id)) continue;
          const res = await capaMulti.buscarPersonas(g.id, cat, q);
          for (const p of res.personas) {
            const clave = p.dniParcial || p.nombreCompleto;
            const prev = porPersona.get(clave);
            if (prev) {
              prev.apariciones = deduplicarApariciones([...prev.apariciones, ...p.apariciones]);
            } else {
              porPersona.set(clave, { ...p });
            }
          }
        }
      }
      return { personas: [...porPersona.values()], gerencias: [] };
    },
  };

  return capaMulti;
}

function crearCapaEducacionVacia() {
  return {
    ccaaId: "clm",
    sector: "educacion",
    tipoListado: "disponibles",
    gruposSanidad: [],
    archivosDisponibles: new Set(),
    tieneDatosReales: () => false,
    tieneIndiceBusqueda: () => false,
    async buscarPersonas() {
      return { personas: [], gerencias: [] };
    },
    async obtenerListadoCompleto() {
      return [];
    },
    async gerenciasDeCategoria() {
      return [];
    },
    async cargarCategoria() {
      throw new Error("Sin datos de educación");
    },
    historialCorte: () => [],
    async estadoActualizacion() {
      return {
        tipo: "sin_datos",
        texto: "Aún no hay listados de educación disponibles. Vuelve más tarde o consulta el portal de Educación CLM.",
      };
    },
  };
}

function filaAdminAApp(fila, total, provincia) {
  const nombreCompleto = formatearNombre(fila.apellidos_nombre);
  const apellidos = fila.apellidos_nombre.split(",")[0].replace(/\n/g, " ").trim();
  return {
    pos: fila.orden,
    nombreCompleto,
    apellidos,
    puntos: null,
    total,
    dniParcial: "",
    sub_bolsa: fila.sub_bolsa,
    num_bolsa: fila.num_bolsa,
    provincia,
    gerencia: provincia,
    ambito: fila.sub_bolsa,
  };
}

function personasAdminDeSnapshot(snapshot) {
  const out = [];
  for (const [sub, list] of Object.entries(snapshot?.sub_bolsas || {})) {
    for (const p of list || []) {
      out.push({ ...p, sub_bolsa: p.sub_bolsa || sub });
    }
  }
  return out;
}

export function crearCapaDatosAdminClm(manifest, categoriasList, opciones = {}) {
  const baseUrl = opciones.baseUrl || DATA_ADMIN_CLM_BASE_URL;
  const archivosDisponibles = new Set(manifest?.archivos || []);
  const cache = new Map();
  const metaPorProvincia = new Map();
  const metaPorCategoria = new Map();
  const gruposMap = {
    funcionario: { nombre: COLECTIVOS_ADMIN.funcionario, categorias: new Set() },
    laboral: { nombre: COLECTIVOS_ADMIN.laboral, categorias: new Set() },
  };

  for (const entry of categoriasList || []) {
    if (entry.error) continue;
    const colectivo = entry.colectivo;
    if (!gruposMap[colectivo]) continue;
    const categoriaUi = portalAUi(entry.categoria);
    const slugCat = slugArchivo(entry.categoria);
    const catKey = `${colectivo}\0${categoriaUi}`;

    for (const pdf of entry.pdfs || []) {
      if (!pdf.provincia) continue;
      const slugProv = slugArchivo(pdf.provincia);
      const rel = `${colectivo}/${slugCat}/${slugProv}.json`;
      if (!archivosDisponibles.has(rel)) continue;

      gruposMap[colectivo].categorias.add(categoriaUi);
      metaPorProvincia.set(`${colectivo}\0${categoriaUi}\0${pdf.provincia}`, {
        colectivo,
        categoriaUi,
        provincia: pdf.provincia,
        rel,
        cuerpo: entry.cuerpo,
        grupo: entry.grupo,
      });

      if (!metaPorCategoria.has(catKey)) {
        metaPorCategoria.set(catKey, {
          colectivo,
          categoriaUi,
          provincias: [],
          cuerpo: entry.cuerpo,
          grupoProfesional: entry.grupo,
        });
      }
      const catMeta = metaPorCategoria.get(catKey);
      if (!catMeta.provincias.some((p) => p.provincia === pdf.provincia)) {
        catMeta.provincias.push({ provincia: pdf.provincia, rel });
      }
    }
  }

  const gruposSanidad = [];
  for (const [id, g] of Object.entries(gruposMap)) {
    if (g.categorias.size) {
      gruposSanidad.push({
        id,
        nombre: g.nombre,
        activo: true,
        categorias: [...g.categorias].sort((a, b) => a.localeCompare(b, "es")),
      });
    }
  }

  function metaCategoria(colectivo, categoriaUi) {
    return metaPorCategoria.get(`${colectivo}\0${categoriaUi}`);
  }

  function metaProvincia(colectivo, categoriaUi, provincia) {
    return metaPorProvincia.get(`${colectivo}\0${categoriaUi}\0${provincia}`);
  }

  function tieneDatosReales(categoriaUi, grupoId) {
    return Boolean(metaCategoria(grupoId, categoriaUi)?.provincias?.length);
  }

  async function cargarJson(rel) {
    if (!rel) throw new Error("Sin ruta");
    if (cache.has(rel)) return cache.get(rel);
    const res = await fetchDatos(`${baseUrl}${rel}`);
    if (!res.ok) throw new Error(`No se pudo cargar ${baseUrl}${rel} (${res.status})`);
    const data = await res.json();
    cache.set(rel, data);
    return data;
  }

  async function cargarCategoria(grupoId, categoriaUi, provincia) {
    const meta = provincia
      ? metaProvincia(grupoId, categoriaUi, provincia)
      : metaCategoria(grupoId, categoriaUi)?.provincias?.[0];
    if (!meta) throw new Error("Categoría sin datos");
    const rel = meta.rel || metaProvincia(grupoId, categoriaUi, meta.provincia)?.rel;
    return cargarJson(rel);
  }

  async function gerenciasDeCategoria(grupoId, categoriaUi) {
    const meta = metaCategoria(grupoId, categoriaUi);
    return (meta?.provincias || [])
      .map((p) => p.provincia)
      .sort((a, b) => a.localeCompare(b, "es"));
  }

  async function obtenerListadoCompleto(grupoId, categoriaUi, gerenciaProvincia) {
    const meta = metaCategoria(grupoId, categoriaUi);
    if (!meta) return [];
    const provincia = gerenciaProvincia || meta.provincias[0]?.provincia;
    const relMeta = metaProvincia(grupoId, categoriaUi, provincia);
    if (!relMeta) return [];
    const snap = await cargarJson(relMeta.rel);
    const personas = personasAdminDeSnapshot(snap);
    const total = personas.length;
    return personas
      .map((f) => filaAdminAApp(f, total, provincia))
      .sort((a, b) => a.pos - b.pos);
  }

  async function buscarPersonas(grupoId, categoriaUi, consulta) {
    const q = consulta.trim();
    if (!q) return { personas: [], gerencias: [] };
    const meta = metaCategoria(grupoId, categoriaUi);
    if (!meta) return { personas: [], gerencias: [] };

    const porPersona = new Map();
    for (const { provincia, rel } of meta.provincias) {
      const snap = await cargarJson(rel);
      const personas = personasAdminDeSnapshot(snap);
      const total = personas.length;

      for (const p of personas) {
        const apellidos = p.apellidos_nombre.split(",")[0].replace(/\n/g, " ").trim();
        const nombreCompleto = formatearNombre(p.apellidos_nombre);
        if (!coincideBusqueda({ apellidos, nombreCompleto, dniParcial: "" }, q)) continue;

        const clave = nombreCompleto.toUpperCase();
        const aparicion = {
          sector: "administracion",
          categoria: categoriaUi,
          grupoId,
          ccaaId: "clm",
          gerencia: provincia,
          provincia,
          ambito: p.sub_bolsa,
          sub_bolsa: p.sub_bolsa,
          posicion: p.orden,
          num_bolsa: p.num_bolsa,
          total,
          delante: Math.max(0, p.orden - 1),
        };

        const prev = porPersona.get(clave);
        if (prev) {
          prev.apariciones.push(aparicion);
        } else {
          porPersona.set(clave, {
            nombreCompleto,
            dniParcial: "",
            categoria: categoriaUi,
            grupoId,
            apariciones: [aparicion],
          });
        }
      }
    }

    return {
      personas: [...porPersona.values()],
      gerencias: meta.provincias.map((p) => p.provincia),
    };
  }

  async function estadoActualizacion(categoriaUi, grupoId, grupoActivo) {
    if (grupoActivo === false) {
      return { tipo: "sin_activar", texto: "Este colectivo aún no tiene listados disponibles." };
    }
    if (!tieneDatosReales(categoriaUi, grupoId)) {
      return { tipo: "sin_datos", texto: "Aún no tenemos listados para esta categoría." };
    }
    const meta = metaCategoria(grupoId, categoriaUi);
    let generado = null;
    try {
      const snap = await cargarJson(meta.provincias[0].rel);
      generado = snap.generado;
    } catch {
      return { tipo: "sin_datos", texto: "No se pudo cargar el listado de esta categoría." };
    }
    if (!generado) {
      return { tipo: "desactualizado", texto: "No consta cuándo se actualizó el listado por última vez." };
    }
    const fecha = new Date(generado);
    const dias = Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
    const hace = dias === 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`;
    return {
      tipo: dias > 30 ? "desactualizado" : "ok",
      texto: `Listado actualizado ${fecha.toLocaleString("es-ES")} (${hace}). Fuente: Portal de Empleo Público de CLM.`,
    };
  }

  return {
    ccaaId: "clm",
    sector: "administracion",
    organismo: ORGANISMO_ADMIN,
    baseUrl,
    gruposSanidad,
    archivosDisponibles,
    tieneDatosReales,
    tieneIndiceBusqueda: tieneDatosReales,
    cargarCategoria,
    gerenciasDeCategoria,
    obtenerListadoCompleto,
    buscarPersonas,
    historialCorte: () => [],
    estadoActualizacion,
  };
}

function crearCapaAdminVacia() {
  return {
    ccaaId: "clm",
    sector: "administracion",
    gruposSanidad: [],
    archivosDisponibles: new Set(),
    tieneDatosReales: () => false,
    tieneIndiceBusqueda: () => false,
    async buscarPersonas() {
      return { personas: [], gerencias: [] };
    },
    async obtenerListadoCompleto() {
      return [];
    },
    async gerenciasDeCategoria() {
      return [];
    },
    async cargarCategoria() {
      throw new Error("Sin datos de administración");
    },
    historialCorte: () => [],
    async estadoActualizacion() {
      return {
        tipo: "sin_datos",
        texto: "Aún no hay listados de administración disponibles. Vuelve más tarde o consulta el portal de Empleo Público.",
      };
    },
  };
}

function tieneArchivosListado(manifest) {
  return (manifest?.archivos || []).some(
    (a) => a.endsWith(".json") && !a.endsWith(".busqueda.json"),
  );
}

const jsonMemo = new Map();
const packLoaded = new Map();
const packInflight = new Map();
/** Flags/frescura descubiertos en segundo plano (sin montar capas pesadas). */
let metaDescubierta = {
  murciaActiva: false,
  madridActiva: false,
  educacionActiva: false,
  educacionMurciaActiva: false,
  educacionBolsaActiva: false,
  educacionAfinActiva: false,
  educacionDisponiblesActiva: false,
  administracionActiva: false,
  coberturaEducacion: null,
  adminSinPdf: [],
  frescura: { sanidad: null, educacionDisponibles: null, educacionBolsa: null, admin: null },
  numGerenciasClm: null,
  archiveIndex: null,
  descubierto: false,
};

async function fetchJsonOptional(url) {
  if (jsonMemo.has(url)) return jsonMemo.get(url);
  const promise = (async () => {
    try {
      const res = await fetchDatos(url);
      if (!res.ok) return { ok: false, status: res.status, data: null };
      return { ok: true, status: res.status, data: await res.json() };
    } catch {
      return { ok: false, status: 0, data: null };
    }
  })();
  jsonMemo.set(url, promise);
  return promise;
}

async function fetchJsonRequired(url, label) {
  const r = await fetchJsonOptional(url);
  if (!r.ok) throw new Error(`No se pudo cargar ${label} (${r.status})`);
  return r.data;
}

async function cargarPackSanidadClm() {
  const base = DATA_CATEGORIAS_BASE_URL;
  const [historico, manifestRes, catsRes] = await Promise.all([
    fetchJsonRequired(`${base}historico.json`, "historico.json"),
    fetchJsonOptional(`${base}manifest.json`),
    fetchJsonOptional(`${base}categorias_por_grupo.json`),
  ]);
  const manifest = manifestRes.ok ? manifestRes.data : { archivos: [] };
  const categoriasPorGrupo = catsRes.ok ? catsRes.data : null;
  return {
    capa: crearCapaDatosClm(historico, manifest, categoriasPorGrupo),
    manifest,
    historico,
    categoriasPorGrupo,
  };
}

async function cargarPackSanidadMur() {
  const base = DATA_CATEGORIAS_BASE_URL;
  const [catsRes, manRes, manRoot] = await Promise.all([
    fetchJsonOptional(`${base}murcia/categorias.json`),
    fetchJsonOptional(`${base}murcia/manifest.json`),
    fetchJsonOptional(`${base}manifest.json`),
  ]);
  const categoriasMurcia = catsRes.ok ? catsRes.data : [];
  let manifestMurcia = manRes.ok ? manRes.data : { archivos: [] };
  if (!manifestMurcia.archivos?.length && manRoot.ok && manRoot.data?.archivos?.length) {
    manifestMurcia = {
      ...manifestMurcia,
      archivos: manRoot.data.archivos.filter((a) => a.startsWith("murcia/")),
    };
  }
  return {
    capa: crearCapaDatosMurcia(manifestMurcia, categoriasMurcia),
    activa: catsRes.ok && tieneArchivosListado(manifestMurcia),
    manifest: manifestMurcia,
  };
}

async function cargarPackSanidadMad() {
  const base = DATA_CATEGORIAS_BASE_URL;
  const [catsRes, manRes] = await Promise.all([
    fetchJsonOptional(`${base}madrid/categorias_sanidad.json`),
    fetchJsonOptional(`${base}madrid/manifest.json`),
  ]);
  const inventario = catsRes.ok ? catsRes.data : { grupos: [] };
  const manifest = manRes.ok ? manRes.data : { archivos: [] };
  return {
    capa: crearCapaDatosMadrid(inventario, manifest),
    activa: catsRes.ok && tieneArchivosListado(manifest),
    manifest,
  };
}

async function cargarPackEducacionClm() {
  const eduBase = DATA_EDUCACION_BASE_URL;
  const eduBolsaBase = DATA_EDUCACION_BOLSA_BASE_URL;
  const [eduManifestRes, eduCatsRes, eduBolsaManifestRes, eduAfinidadRes] = await Promise.all([
    fetchJsonOptional(`${eduBase}manifest.json`),
    fetchJsonOptional(`${eduBase}categorias.json`),
    fetchJsonOptional(`${eduBolsaBase}manifest.json`),
    fetchJsonOptional(`${eduBase}afinidad.json`),
  ]);
  const manifestEducacion = eduManifestRes.ok ? eduManifestRes.data : { archivos: [] };
  const manifestEducacionBolsa = eduBolsaManifestRes.ok ? eduBolsaManifestRes.data : { archivos: [] };
  const categoriasEducacion = eduCatsRes.ok ? eduCatsRes.data : null;
  const afinidadEducacion = eduAfinidadRes.ok ? eduAfinidadRes.data : null;
  const educacionDisponiblesActiva =
    tieneArchivosListado(manifestEducacion) && Boolean(categoriasEducacion);
  const educacionBolsaActiva =
    tieneArchivosListado(manifestEducacionBolsa) && Boolean(categoriasEducacion);
  const educacionAfinActiva = educacionBolsaActiva && Boolean(afinidadEducacion);
  const educacionDisponiblesClm =
    educacionDisponiblesActiva && categoriasEducacion
      ? crearCapaDatosEducacionClm(manifestEducacion, categoriasEducacion, {
          baseUrl: eduBase,
          tipoListado: "disponibles",
        })
      : null;
  const educacionBolsaClm =
    educacionBolsaActiva && categoriasEducacion
      ? crearCapaDatosEducacionClm(manifestEducacionBolsa, categoriasEducacion, {
          baseUrl: eduBolsaBase,
          tipoListado: "bolsa_ordinaria",
        })
      : null;
  const educacionAfinClm =
    educacionAfinActiva && categoriasEducacion
      ? crearCapaDatosEducacionClm(manifestEducacionBolsa, categoriasEducacion, {
          baseUrl: eduBolsaBase,
          tipoListado: "afin",
          afinidadDoc: afinidadEducacion,
        })
      : null;
  return {
    educacionDisponiblesClm,
    educacionBolsaClm,
    educacionAfinClm,
    educacionClm: educacionBolsaClm || educacionAfinClm || educacionDisponiblesClm,
    educacionDisponiblesActiva,
    educacionBolsaActiva,
    educacionAfinActiva,
    educacionActiva: educacionDisponiblesActiva || educacionBolsaActiva,
    coberturaEducacion: categoriasEducacion
      ? calcularCoberturaEducacion(
          categoriasEducacion,
          manifestEducacion,
          manifestEducacionBolsa,
          slugArchivo,
        )
      : null,
    manifestEducacion,
    manifestEducacionBolsa,
  };
}

async function cargarPackEducacionMur() {
  const eduMurBase = DATA_EDUCACION_MURCIA_BASE_URL;
  const manRes = await fetchJsonOptional(`${eduMurBase}manifest.json`);
  const manifest = manRes.ok ? manRes.data : { archivos: [] };
  const activa = tieneArchivosListado(manifest);
  return {
    educacionMurcia: activa
      ? crearCapaDatosEducacionMurcia(manifest, { baseUrl: eduMurBase })
      : null,
    educacionMurciaActiva: activa,
    manifest,
  };
}

async function cargarPackAdminClm() {
  const adminBase = DATA_ADMIN_CLM_BASE_URL;
  const [manRes, catsRes] = await Promise.all([
    fetchJsonOptional(`${adminBase}manifest.json`),
    fetchJsonOptional(`${adminBase}categorias.json`),
  ]);
  const manifestAdmin = manRes.ok ? manRes.data : { archivos: [] };
  const categoriasAdmin = catsRes.ok ? catsRes.data : [];
  const administracionActiva =
    tieneArchivosListado(manifestAdmin) &&
    Array.isArray(categoriasAdmin) &&
    categoriasAdmin.length > 0;
  return {
    administracionClm: administracionActiva
      ? crearCapaDatosAdminClm(manifestAdmin, categoriasAdmin, { baseUrl: adminBase })
      : null,
    administracionActiva,
    adminSinPdf: adminBolsasSinPdf(categoriasAdmin),
    manifestAdmin,
  };
}

const PACK_LOADERS = {
  "sanidad-clm": cargarPackSanidadClm,
  "sanidad-mur": cargarPackSanidadMur,
  "sanidad-mad": cargarPackSanidadMad,
  "educacion-clm": cargarPackEducacionClm,
  "educacion-mur": cargarPackEducacionMur,
  "admin-clm": cargarPackAdminClm,
};

export function packSanidadDeCcaa(ccaaId) {
  if (ccaaId === "mur") return "sanidad-mur";
  if (ccaaId === "mad") return "sanidad-mad";
  return "sanidad-clm";
}

/** Packs de metadatos/capas necesarios para un contexto de UI o seguimientos. */
export function packsParaContexto({
  ccaaIds = [],
  sector = "sanidad",
  seguimientos = [],
} = {}) {
  const packs = new Set();
  const ids = [...new Set((ccaaIds || []).filter(Boolean))];
  if (!ids.length) ids.push("clm");

  const addSector = (ccaaId, sectorId) => {
    if (sectorId === "educacion") {
      packs.add(ccaaId === "mur" ? "educacion-mur" : "educacion-clm");
      return;
    }
    if (sectorId === "administracion") {
      packs.add("admin-clm");
      return;
    }
    packs.add(packSanidadDeCcaa(ccaaId));
  };

  for (const id of ids) addSector(id, sector || "sanidad");

  for (const s of seguimientos || []) {
    addSector(s.ccaaId || "clm", s.sector || "sanidad");
  }

  return [...packs];
}

async function asegurarPackId(packId) {
  if (!PACK_LOADERS[packId]) return null;
  if (packLoaded.has(packId)) return packLoaded.get(packId);
  if (packInflight.has(packId)) return packInflight.get(packId);
  const promise = PACK_LOADERS[packId]()
    .then((payload) => {
      packLoaded.set(packId, payload);
      packInflight.delete(packId);
      return payload;
    })
    .catch((err) => {
      packInflight.delete(packId);
      throw err;
    });
  packInflight.set(packId, promise);
  return promise;
}

function ensamblarDatos({ listo = true, errorPack = null } = {}) {
  const clmPack = packLoaded.get("sanidad-clm");
  const murPack = packLoaded.get("sanidad-mur");
  const madPack = packLoaded.get("sanidad-mad");
  const eduPack = packLoaded.get("educacion-clm");
  const eduMurPack = packLoaded.get("educacion-mur");
  const adminPack = packLoaded.get("admin-clm");

  const capas = {
    clm: clmPack?.capa || crearCapaDatosClm({}, { archivos: [] }, null),
    mur: murPack?.capa || crearCapaDatosMurcia({ archivos: [] }, []),
    mad: madPack?.capa || crearCapaDatosMadrid({ grupos: [] }, { archivos: [] }),
  };

  const educacionDisponiblesClm = eduPack?.educacionDisponiblesClm || null;
  const educacionBolsaClm = eduPack?.educacionBolsaClm || null;
  const educacionAfinClm = eduPack?.educacionAfinClm || null;
  const educacionClm = eduPack?.educacionClm || null;
  const educacionMurcia = eduMurPack?.educacionMurcia || null;
  const administracionClm = adminPack?.administracionClm || null;

  const murciaActiva = murPack?.activa ?? metaDescubierta.murciaActiva;
  const madridActiva = madPack?.activa ?? metaDescubierta.madridActiva;
  const educacionDisponiblesActiva =
    eduPack?.educacionDisponiblesActiva ?? metaDescubierta.educacionDisponiblesActiva;
  const educacionBolsaActiva =
    eduPack?.educacionBolsaActiva ?? metaDescubierta.educacionBolsaActiva;
  const educacionAfinActiva =
    eduPack?.educacionAfinActiva ?? metaDescubierta.educacionAfinActiva;
  const educacionActiva =
    eduPack?.educacionActiva ?? metaDescubierta.educacionActiva;
  const educacionMurciaActiva =
    eduMurPack?.educacionMurciaActiva ?? metaDescubierta.educacionMurciaActiva;
  const administracionActiva =
    adminPack?.administracionActiva ?? metaDescubierta.administracionActiva;

  const frescura = {
    sanidad:
      clmPack?.manifest?.generado ||
      metaDescubierta.frescura?.sanidad ||
      null,
    educacionDisponibles:
      eduPack?.manifestEducacion?.generado ||
      metaDescubierta.frescura?.educacionDisponibles ||
      null,
    educacionBolsa:
      eduPack?.manifestEducacionBolsa?.generado ||
      metaDescubierta.frescura?.educacionBolsa ||
      null,
    admin:
      adminPack?.manifestAdmin?.generado || metaDescubierta.frescura?.admin || null,
  };

  const packsCargados = Object.fromEntries([...packLoaded.keys()].map((k) => [k, true]));
  const packsCargando = [...packInflight.keys()];

  return {
    listo,
    errorPack,
    packsCargados,
    packsCargando,
    regiones: CCAA_LIST,
    numGerenciasClm: metaDescubierta.numGerenciasClm,
    educacionActiva,
    educacionMurciaActiva,
    educacionBolsaActiva,
    educacionAfinActiva,
    educacionDisponiblesActiva,
    educacionClm,
    educacionMurcia,
    educacionBolsaClm,
    educacionAfinClm,
    educacionDisponiblesClm,
    administracionActiva,
    administracionClm,
    murciaActiva,
    madridActiva,
    coberturaEducacion: eduPack?.coberturaEducacion ?? metaDescubierta.coberturaEducacion,
    adminSinPdf: adminPack?.adminSinPdf ?? metaDescubierta.adminSinPdf,
    frescura,
    paraCcaa: (ccaaId) => capas[ccaaId] || capas.clm,
    paraSector: (ccaaId, sectorId, opciones = {}) => {
      const fechaSnap = opciones.fechaSnapshot || null;
      if (
        fechaSnap &&
        sectorId === "sanidad" &&
        (ccaaId === "clm" || !ccaaId) &&
        clmPack?.historico != null
      ) {
        return crearCapaDatosClm(clmPack.historico, clmPack.manifest, clmPack.categoriasPorGrupo, {
          baseUrl: urlBaseArchive(DATA_CATEGORIAS_BASE_URL, fechaSnap, "sanidad"),
          modoHistorico: { fecha: fechaSnap, curso: cursoDeFecha(fechaSnap) },
        });
      }
      if (sectorId === "educacion" && ccaaId === "mur") {
        return educacionMurcia || crearCapaEducacionVacia();
      }
      if (sectorId === "educacion" && ccaaId === "clm") {
        const modo = opciones.modoListadoEducacion;
        if (modo === "disponibles" && educacionDisponiblesClm) return educacionDisponiblesClm;
        if (modo === "bolsa" && educacionBolsaClm) return educacionBolsaClm;
        if (modo === "afin" && educacionAfinClm) return educacionAfinClm;
        return educacionBolsaClm || educacionAfinClm || educacionDisponiblesClm || crearCapaEducacionVacia();
      }
      if (sectorId === "administracion" && ccaaId === "clm") {
        return administracionClm || crearCapaAdminVacia();
      }
      return capas[ccaaId] || capas.clm;
    },
    archiveIndex: metaDescubierta.archiveIndex || null,
    paraCcaas: (ccaaIds) => {
      const ids = [...new Set(ccaaIds)].filter((id) => capas[id]);
      if (ids.length === 0) return capas.clm;
      if (ids.length === 1) return capas[ids[0]];
      return crearCapaDatosMulti(
        ids.map((id) => capas[id]),
        ids,
      );
    },
    ...capas.clm,
  };
}

/** Shell inmediato para pintar la UI sin esperar a R2. */
export function crearDatosPendientes() {
  return ensamblarDatos({ listo: false });
}

/**
 * Carga solo el pack de sanidad de la CCAA inicial (por defecto CLM).
 * El resto se pide con fusionarPacks / descubrirDisponibilidad.
 */
export async function cargarDatosIniciales({ ccaaId = "clm" } = {}) {
  const packId = packSanidadDeCcaa(ccaaId === "mur" || ccaaId === "mad" ? ccaaId : "clm");
  const [archiveRes] = await Promise.all([
    fetchJsonOptional(`${DATA_CATEGORIAS_BASE_URL}archive/index.json`),
    asegurarPackId(packId),
  ]);
  if (archiveRes.ok) metaDescubierta = { ...metaDescubierta, archiveIndex: archiveRes.data };
  return ensamblarDatos({ listo: true });
}

/** Compat: arranque mínimo (sanidad CLM). Preferir cargarDatosIniciales. */
export async function cargarDatos() {
  return cargarDatosIniciales({ ccaaId: "clm" });
}

/**
 * Une packs que falten al estado actual y devuelve un nuevo objeto `datos`.
 * Reutiliza JSON ya pedidos (p. ej. tras descubrirDisponibilidad).
 */
export async function fusionarPacks(_datosActuales, packIds = []) {
  const ids = [...new Set(packIds)].filter((id) => PACK_LOADERS[id]);
  if (!ids.length) return ensamblarDatos({ listo: _datosActuales?.listo !== false });
  try {
    await Promise.all(ids.map((id) => asegurarPackId(id)));
    return ensamblarDatos({ listo: true });
  } catch (e) {
    return ensamblarDatos({
      listo: _datosActuales?.listo === true,
      errorPack: e.message || "Error al cargar listados",
    });
  }
}

/**
 * En segundo plano: flags de sectores + frescura + numGerencias.
 * Prefetch de JSON para que fusionarPacks monte capas sin red extra.
 */
export async function descubrirDisponibilidad(datosActuales) {
  const base = DATA_CATEGORIAS_BASE_URL;
  const eduBase = DATA_EDUCACION_BASE_URL;
  const eduBolsaBase = DATA_EDUCACION_BOLSA_BASE_URL;
  const eduMurBase = DATA_EDUCACION_MURCIA_BASE_URL;
  const adminBase = DATA_ADMIN_CLM_BASE_URL;

  const [
    murCatsRes,
    murManRes,
    madCatsRes,
    madManRes,
    eduManRes,
    eduCatsRes,
    eduBolsaManRes,
    eduAfinRes,
    eduMurManRes,
    adminManRes,
    adminCatsRes,
    archiveIdxRes,
  ] = await Promise.all([
    fetchJsonOptional(`${base}murcia/categorias.json`),
    fetchJsonOptional(`${base}murcia/manifest.json`),
    fetchJsonOptional(`${base}madrid/categorias_sanidad.json`),
    fetchJsonOptional(`${base}madrid/manifest.json`),
    fetchJsonOptional(`${eduBase}manifest.json`),
    fetchJsonOptional(`${eduBase}categorias.json`),
    fetchJsonOptional(`${eduBolsaBase}manifest.json`),
    fetchJsonOptional(`${eduBase}afinidad.json`),
    fetchJsonOptional(`${eduMurBase}manifest.json`),
    fetchJsonOptional(`${adminBase}manifest.json`),
    fetchJsonOptional(`${adminBase}categorias.json`),
    fetchJsonOptional(`${base}archive/index.json`),
  ]);
  let manifestMurcia = murManRes.ok ? murManRes.data : { archivos: [] };
  if (!manifestMurcia.archivos?.length) {
    const root = await fetchJsonOptional(`${base}manifest.json`);
    if (root.ok && root.data?.archivos?.length) {
      manifestMurcia = {
        ...manifestMurcia,
        archivos: root.data.archivos.filter((a) => a.startsWith("murcia/")),
      };
    }
  }

  const manifestEducacion = eduManRes.ok ? eduManRes.data : { archivos: [] };
  const manifestEducacionBolsa = eduBolsaManRes.ok ? eduBolsaManRes.data : { archivos: [] };
  const categoriasEducacion = eduCatsRes.ok ? eduCatsRes.data : null;
  const afinidadEducacion = eduAfinRes.ok ? eduAfinRes.data : null;
  const educacionDisponiblesActiva =
    tieneArchivosListado(manifestEducacion) && Boolean(categoriasEducacion);
  const educacionBolsaActiva =
    tieneArchivosListado(manifestEducacionBolsa) && Boolean(categoriasEducacion);
  const educacionAfinActiva = educacionBolsaActiva && Boolean(afinidadEducacion);
  const manifestEducacionMurcia = eduMurManRes.ok ? eduMurManRes.data : { archivos: [] };
  const manifestAdmin = adminManRes.ok ? adminManRes.data : { archivos: [] };
  const categoriasAdmin = adminCatsRes.ok ? adminCatsRes.data : [];
  const manifestMadrid = madManRes.ok ? madManRes.data : { archivos: [] };

  let numGerenciasClm = metaDescubierta.numGerenciasClm;
  try {
    const enfRes = await fetchJsonOptional(`${base}diplomado/enfermero-a.json`);
    if (enfRes.ok && enfRes.data) {
      numGerenciasClm = gerenciasUnicasDeSnapshot(enfRes.data).length;
    }
  } catch {
    /* opcional */
  }

  const clmMan = packLoaded.get("sanidad-clm")?.manifest;

  metaDescubierta = {
    murciaActiva: murCatsRes.ok && tieneArchivosListado(manifestMurcia),
    madridActiva: madCatsRes.ok && tieneArchivosListado(manifestMadrid),
    educacionDisponiblesActiva,
    educacionBolsaActiva,
    educacionAfinActiva,
    educacionActiva: educacionDisponiblesActiva || educacionBolsaActiva,
    educacionMurciaActiva: tieneArchivosListado(manifestEducacionMurcia),
    administracionActiva:
      tieneArchivosListado(manifestAdmin) &&
      Array.isArray(categoriasAdmin) &&
      categoriasAdmin.length > 0,
    coberturaEducacion: categoriasEducacion
      ? calcularCoberturaEducacion(
          categoriasEducacion,
          manifestEducacion,
          manifestEducacionBolsa,
          slugArchivo,
        )
      : null,
    adminSinPdf: adminBolsasSinPdf(categoriasAdmin),
    frescura: frescuraDesdeManifests({
      sanidad: clmMan || { generado: null },
      educacion: manifestEducacion,
      educacionBolsa: manifestEducacionBolsa,
      admin: manifestAdmin,
    }),
    numGerenciasClm,
    archiveIndex: archiveIdxRes.ok ? archiveIdxRes.data : metaDescubierta.archiveIndex,
    descubierto: true,
  };

  return ensamblarDatos({ listo: datosActuales?.listo !== false });
}

const DatosContext = createContext(null);
const CcaaCapaContext = createContext(null);
const AsegurarPacksContext = createContext(null);

export function DatosProvider({ datos, children }) {
  return <DatosContext.Provider value={datos}>{children}</DatosContext.Provider>;
}

export function AsegurarPacksProvider({ value, children }) {
  return (
    <AsegurarPacksContext.Provider value={value}>{children}</AsegurarPacksContext.Provider>
  );
}

export function CcaaCapaProvider({ capa, children }) {
  return <CcaaCapaContext.Provider value={capa}>{children}</CcaaCapaContext.Provider>;
}

export function useDatos() {
  const ctx = useContext(DatosContext);
  if (!ctx) throw new Error("useDatos debe usarse dentro de DatosProvider");
  return ctx;
}

export function useAsegurarPacks() {
  return useContext(AsegurarPacksContext);
}

/** Capa de datos de la CCAA activa (búsqueda/listados). Por defecto CLM. */
export function useCapaDatos() {
  const capa = useContext(CcaaCapaContext);
  const root = useDatos();
  return capa || root;
}
