import { createContext, useContext } from "react";
import { deduplicarApariciones } from "./utils/apariciones.js";

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

export function crearCapaDatos(historico, manifest, categoriasPorGrupo) {
  const { uiAScraper, scraperAUi } = construirMapasCategorias(categoriasPorGrupo);
  const archivosDisponibles = new Set(manifest?.archivos || []);
  const cache = new Map();

  function rutaRelativa(grupoId, categoriaScraper) {
    return `${grupoId}/${slugArchivo(categoriaScraper)}.json`;
  }

  function rutaIndiceBusqueda(grupoId, categoriaScraper) {
    return `${grupoId}/${slugArchivo(categoriaScraper)}.busqueda.json`;
  }

  function esListadoCategoria(archivo) {
    return archivo.endsWith(".json") && !archivo.endsWith(".busqueda.json");
  }

  function categoriaScraper(categoriaUi) {
    return uiAScraper[categoriaUi] ?? categoriaUi.toUpperCase();
  }

  function categoriaUiDesdeScraper(nombre) {
    return scraperAUi[nombre] ?? portalAUi(nombre);
  }

  function tieneDatosReales(categoriaUi, grupoId) {
    const cat = categoriaScraper(categoriaUi);
    const rel = rutaRelativa(grupoId, cat);
    return archivosDisponibles.has(rel) && esListadoCategoria(rel);
  }

  function tieneIndiceBusqueda(categoriaUi, grupoId) {
    const cat = categoriaScraper(categoriaUi);
    return archivosDisponibles.has(rutaIndiceBusqueda(grupoId, cat));
  }

  function grupoTieneDatos(grupoId) {
    const prefix = `${grupoId}/`;
    for (const archivo of archivosDisponibles) {
      if (archivo.startsWith(prefix) && esListadoCategoria(archivo)) return true;
    }
    return false;
  }

  async function cargarIndiceBusqueda(grupoId, categoriaUi) {
    const cat = categoriaScraper(categoriaUi);
    const key = `idx/${grupoId}/${cat}`;
    if (cache.has(key)) return cache.get(key);
    const rel = rutaIndiceBusqueda(grupoId, cat);
    const res = await fetch(`${DATA_CATEGORIAS_BASE_URL}${rel}`);
    if (!res.ok) return null;
    const data = await res.json();
    cache.set(key, data);
    return data;
  }

  async function cargarCategoria(grupoId, categoriaUi) {
    const cat = categoriaScraper(categoriaUi);
    const key = `${grupoId}/${cat}`;
    if (cache.has(key)) return cache.get(key);
    const rel = rutaRelativa(grupoId, cat);
    const res = await fetch(`${DATA_CATEGORIAS_BASE_URL}${rel}`);
    if (!res.ok) throw new Error(`No se pudo cargar ${DATA_CATEGORIAS_BASE_URL}${rel} (${res.status})`);
    const data = await res.json();
    cache.set(key, data);
    return data;
  }

  function listadosDeSnapshot(snapshot, categoriaUi, gerenciaCortaFiltro = null, ambitoFiltro = "") {
    const cat = categoriaScraper(categoriaUi);
    let listados = (snapshot?.listados ?? []).filter((l) => l.categoria === cat);
    if (gerenciaCortaFiltro) {
      listados = listados.filter((l) => gerenciaCorta(l.gerencia) === gerenciaCortaFiltro);
    }
    if (ambitoFiltro) {
      listados = listados.filter((l) => l.ambito === ambitoFiltro);
    }
    return listados;
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
        texto: `El snapshot más reciente es del ${fecha.toLocaleDateString("es-ES")} (hace ${dias} días). El SESCAM puede haber publicado cambios desde entonces.`,
      };
    }
    const hace = dias === 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`;
    return { tipo: "ok", texto: `Snapshot del listado: ${fecha.toLocaleString("es-ES")} (${hace}).` };
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
        categorias: (info.categorias_pdf || []).map(portalAUi),
      }))
    : [];

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
    uiAScraper,
    scraperAUi,
    categoriaUiDesdeScraper,
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

export async function cargarDatos() {
  const [historicoRes, manifestRes, catsRes] = await Promise.all([
    fetch(`${DATA_CATEGORIAS_BASE_URL}historico.json`),
    fetch(`${DATA_CATEGORIAS_BASE_URL}manifest.json`),
    fetch(`${DATA_CATEGORIAS_BASE_URL}categorias_por_grupo.json`),
  ]);
  if (!historicoRes.ok) throw new Error(`No se pudo cargar historico.json (${historicoRes.status})`);
  const historico = await historicoRes.json();
  const manifest = manifestRes.ok ? await manifestRes.json() : { archivos: [] };
  const categoriasPorGrupo = catsRes.ok ? await catsRes.json() : null;
  return crearCapaDatos(historico, manifest, categoriasPorGrupo);
}

const DatosContext = createContext(null);

export function DatosProvider({ datos, children }) {
  return <DatosContext.Provider value={datos}>{children}</DatosContext.Provider>;
}

export function useDatos() {
  const ctx = useContext(DatosContext);
  if (!ctx) throw new Error("useDatos debe usarse dentro de DatosProvider");
  return ctx;
}
