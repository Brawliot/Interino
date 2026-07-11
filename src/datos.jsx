import { createContext, useContext } from "react";
import { deduplicarApariciones } from "./utils/apariciones.js";
import { CCAA_LIST, esGrupoSanitarioMurcia, organismoCcaa } from "./regiones.js";

/**
 * Base URL para todos los JSON de datos (listados + metadatos).
 * Desarrollo: /data/  |  Producción (R2): VITE_DATA_CATEGORIAS_URL=https://…
 */
export const DATA_CATEGORIAS_BASE_URL = (
  import.meta.env.VITE_DATA_CATEGORIAS_URL || "/data/"
).replace(/\/?$/, "/");

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
  if (gerenciaCompleta.includes("Primaria de Toledo")) return "Toledo";
  if (gerenciaCompleta.includes("Especializada de Toledo")) return "Toledo AE";
  const prefijo = "Gerencia de Atencion Integrada de ";
  if (gerenciaCompleta.startsWith(prefijo)) return gerenciaCompleta.slice(prefijo.length);
  return gerenciaCompleta;
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
  "ENFERMERO/A DE EMERGENCIAS",
  "ENFERMERO/A INSPECTOR/A DE SERVICIOS SANITARIOS Y PRESTACIONES",
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
    const res = await fetch(`${DATA_CATEGORIAS_BASE_URL}${rel}`);
    if (!res.ok) return null;
    const data = await res.json();
    cache.set(key, data);
    return data;
  }

  async function cargarCategoria(grupoId, categoriaUi) {
    const rel = rutaListado(categoriaUi, grupoId);
    const key = rel;
    if (cache.has(key)) return cache.get(key);
    const res = await fetch(`${DATA_CATEGORIAS_BASE_URL}${rel}`);
    if (!res.ok) throw new Error(`No se pudo cargar ${DATA_CATEGORIAS_BASE_URL}${rel} (${res.status})`);
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
        gerencia: f.gerencia,
        ambito: f.ambito,
        posicion: f.pos,
        total: f.total,
        puntos: f.puntos,
        delante: f.pos - 1,
        nombreCompleto: f.nombreCompleto,
        dniParcial: f.dniParcial,
        tiposContrato: f.tiposContrato,
      });
    });
    const personas = [...porPersona.values()].map((p) => ({
      ...p,
      apariciones: deduplicarApariciones(p.apariciones),
    }));
    return { personas, gerencias: gerenciasEnDatos };
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
      return { tipo: "sin_activar", texto: "Este grupo aún no tiene listados scrapeados. Sin datos todavía." };
    }
    if (!tieneDatosReales(categoriaUi, grupoId)) {
      return { tipo: "sin_datos", texto: "Aún no tenemos listado scrapeado para esta categoría." };
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
        texto: `El snapshot más reciente es del ${fecha.toLocaleDateString("es-ES")} (hace ${dias} días). ${organismo} puede haber publicado cambios desde entonces.`,
      };
    }
    const hace = dias === 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`;
    return { tipo: "ok", texto: `Snapshot del listado: ${fecha.toLocaleString("es-ES")} (${hace}).` };
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

  return {
    ccaaId,
    gruposSanidad,
    tieneDatosReales,
    tieneIndiceBusqueda,
    cargarCategoria,
    gerenciasDeCategoria,
    obtenerListadoCompleto,
    buscarPersonas,
    historialCorte,
    estadoActualizacion,
    archivosDisponibles,
  };
}

export function crearCapaDatosClm(historico, manifest, categoriasPorGrupo) {
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
    ? Object.entries(categoriasPorGrupo)
        .filter(([id]) => id !== "facultativo")
        .map(([id, info]) => ({
          id,
          nombre: {
            diplomado: "Personal Sanitario Diplomado",
            licenciados: "Personal Sanitario Licenciado",
            tecnico: "Personal Sanitario Técnico",
            gestion: "Personal de Gestión y Servicios",
          }[id] || id,
          activo: grupoTieneDatos(id),
          categorias: (info.categorias_pdf || [])
            .filter((pdf) => !CATEGORIAS_SIN_PDF_PORTAL.has(pdf))
            .map(portalAUi),
        }))
    : [];

  const capa = crearCapaBusqueda({
    ccaaId: "clm",
    gruposSanidad,
    archivosDisponibles,
    historico,
    organismo: organismoCcaa("clm"),
    categoriaScraper,
    rutaListado: (categoriaUi) => {
      const cat = categoriaScraper(categoriaUi);
      return `${"diplomado"}/${slugArchivo(cat)}.json`.replace(/^diplomado\//, () => {
        for (const g of gruposSanidad) {
          if (g.categorias.includes(categoriaUi)) return `${g.id}/${slugArchivo(cat)}.json`;
        }
        return `diplomado/${slugArchivo(cat)}.json`;
      });
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

  // Corregir rutas CLM: resolver grupo real por categoría
  function grupoDeCategoriaUi(categoriaUi) {
    return gruposSanidad.find((g) => g.categorias.includes(categoriaUi))?.id || "diplomado";
  }

  return {
    ...capa,
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
      const res = await fetch(`${DATA_CATEGORIAS_BASE_URL}${rel}`);
      if (!res.ok) throw new Error(`No se pudo cargar ${DATA_CATEGORIAS_BASE_URL}${rel} (${res.status})`);
      return res.json();
    },
    buscarPersonas: async (grupoId, categoriaUi, consulta) => {
      const gid = grupoId || grupoDeCategoriaUi(categoriaUi);
      return capa.buscarPersonas(gid, categoriaUi, consulta);
    },
    obtenerListadoCompleto: async (grupoId, categoriaUi, gerencia, ambito) => {
      const gid = grupoId || grupoDeCategoriaUi(categoriaUi);
      return capa.obtenerListadoCompleto(gid, categoriaUi, gerencia, ambito);
    },
    gerenciasDeCategoria: async (grupoId, categoriaUi) => {
      const gid = grupoId || grupoDeCategoriaUi(categoriaUi);
      return capa.gerenciasDeCategoria(gid, categoriaUi);
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

function crearCapaDatosMadrid(inventario) {
  const archivosDisponibles = new Set();
  const gruposSanidad = (inventario?.grupos || []).map((g) => ({
    id: g.id,
    nombre: g.nombre,
    activo: false,
    categorias: g.categorias,
  }));

  return crearCapaBusqueda({
    ccaaId: "mad",
    gruposSanidad,
    archivosDisponibles,
    historico: [],
    organismo: organismoCcaa("mad"),
    categoriaScraper: (categoriaUi) => claveCategoria(categoriaUi),
    rutaListado: () => null,
    rutaIndice: () => null,
    listadosDeSnapshot: () => [],
  });
}

/** @deprecated Usar crearCapaDatosClm o datos.paraCcaa() */
export function crearCapaDatos(historico, manifest, categoriasPorGrupo) {
  return crearCapaDatosClm(historico, manifest, categoriasPorGrupo);
}

export async function cargarDatos() {
  const base = DATA_CATEGORIAS_BASE_URL;
  const [historicoRes, manifestRes, catsRes, murCatsRes, murManifestRes, madCatsRes] = await Promise.all([
    fetch(`${base}historico.json`),
    fetch(`${base}manifest.json`),
    fetch(`${base}categorias_por_grupo.json`),
    fetch(`${base}murcia/categorias.json`),
    fetch(`${base}murcia/manifest.json`),
    fetch(`${base}madrid/categorias_sanidad.json`),
  ]);
  if (!historicoRes.ok) throw new Error(`No se pudo cargar historico.json (${historicoRes.status})`);
  const historico = await historicoRes.json();
  const manifest = manifestRes.ok ? await manifestRes.json() : { archivos: [] };
  const categoriasPorGrupo = catsRes.ok ? await catsRes.json() : null;
  const categoriasMurcia = murCatsRes.ok ? await murCatsRes.json() : [];
  const manifestMurcia = murManifestRes.ok ? await murManifestRes.json() : { archivos: [] };
  const inventarioMadrid = madCatsRes.ok ? await madCatsRes.json() : { grupos: [] };

  const capas = {
    clm: crearCapaDatosClm(historico, manifest, categoriasPorGrupo),
    mur: crearCapaDatosMurcia(manifestMurcia, categoriasMurcia),
    mad: crearCapaDatosMadrid(inventarioMadrid),
  };
  const clm = capas.clm;

  return {
    regiones: CCAA_LIST,
    paraCcaa: (ccaaId) => capas[ccaaId] || capas.clm,
    ...clm,
  };
}

const DatosContext = createContext(null);
const CcaaCapaContext = createContext(null);

export function DatosProvider({ datos, children }) {
  return <DatosContext.Provider value={datos}>{children}</DatosContext.Provider>;
}

export function CcaaCapaProvider({ capa, children }) {
  return <CcaaCapaContext.Provider value={capa}>{children}</CcaaCapaContext.Provider>;
}

export function useDatos() {
  const ctx = useContext(DatosContext);
  if (!ctx) throw new Error("useDatos debe usarse dentro de DatosProvider");
  return ctx;
}

/** Capa de datos de la CCAA activa (búsqueda/listados). Por defecto CLM. */
export function useCapaDatos() {
  const capa = useContext(CcaaCapaContext);
  const root = useDatos();
  return capa || root;
}
