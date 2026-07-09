import { createContext, useContext } from "react";

// UI (prototipo) → categoría del scraper / PDF
export const CATEGORIA_UI_A_SCRAPER = {
  "Enfermero/a": "ENFERMERO/A",
  "Fisioterapeuta": "FISIOTERAPEUTA",
  "Logopeda": "LOGOPEDA",
  "Óptico-Optometrista": "OPTICO/A OPTOMETRISTA",
  "Podólogo/a": "PODOLOGO/A",
  "Terapeuta Ocupacional": "TERAPEUTA OCUPACIONAL",
  "Dietista-Nutricionista": "DIETISTA-NUTRICIONISTA",
};

export function gerenciaCorta(gerenciaCompleta) {
  if (!gerenciaCompleta) return "";
  if (gerenciaCompleta.includes("Primaria de Toledo")) return "Toledo";
  const prefijo = "Gerencia de Atencion Integrada de ";
  if (gerenciaCompleta.startsWith(prefijo)) return gerenciaCompleta.slice(prefijo.length);
  return gerenciaCompleta;
}

function normalizarTexto(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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

export function crearCapaDatos(latest, historico) {
  const listados = latest?.listados ?? [];
  const generado = latest?.generado ?? null;

  const gerenciasSet = new Set();
  listados.forEach((l) => gerenciasSet.add(gerenciaCorta(l.gerencia)));
  const GERENCIAS = [...gerenciasSet].sort((a, b) => a.localeCompare(b, "es"));

  const categoriasConDatos = new Set(listados.map((l) => l.categoria));

  function categoriaScraper(categoriaUi) {
    return CATEGORIA_UI_A_SCRAPER[categoriaUi] ?? categoriaUi;
  }

  function listadosDe(categoriaUi, gerenciaCortaFiltro = null) {
    const cat = categoriaScraper(categoriaUi);
    return listados.filter((l) => {
      if (l.categoria !== cat) return false;
      if (!gerenciaCortaFiltro) return true;
      return gerenciaCorta(l.gerencia) === gerenciaCortaFiltro;
    });
  }

  function tieneDatosReales(categoriaUi) {
    const grupo = categoriaScraper(categoriaUi);
    return categoriasConDatos.has(grupo);
  }

  function obtenerListadoCompleto(categoriaUi, gerenciaCortaFiltro = "") {
    const bloques = listadosDe(categoriaUi, gerenciaCortaFiltro || null);
    const filas = [];
    bloques.forEach((bloque) => {
      const total = bloque.filas.length;
      bloque.filas.forEach((f) => {
        filas.push(filaScraperAApp({ ...f, gerencia: bloque.gerencia, ambito: bloque.ambito, categoria: bloque.categoria }, total));
      });
    });
    return filas.sort((a, b) => a.pos - b.pos);
  }

  function buscarPorApellido(categoriaUi, gerenciaCortaFiltro, apellidos) {
    const q = normalizarTexto(apellidos);
    if (!q) return [];
    return obtenerListadoCompleto(categoriaUi, gerenciaCortaFiltro).filter((f) =>
      normalizarTexto(f.apellidos).includes(q)
    );
  }

  function buscarPersonas(categoriaUi, gerencia, apellidos, TODAS_GERENCIAS, gerenciasLista) {
    const gerencias = gerencia === TODAS_GERENCIAS ? gerenciasLista : [gerencia];
    const porPersona = new Map();
    gerencias.forEach((g) => {
      buscarPorApellido(categoriaUi, g, apellidos).forEach((f) => {
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
    });
    return [...porPersona.values()];
  }

  function historialCorte(categoriaUi, gerenciaCortaFiltro = "") {
    const cat = categoriaScraper(categoriaUi);
    let entradas = historico.filter((h) => h.categoria === cat);
    if (gerenciaCortaFiltro) {
      entradas = entradas.filter((h) => gerenciaCorta(h.gerencia) === gerenciaCortaFiltro);
    }
    const porFecha = new Map();
    entradas.forEach((e) => {
      const prev = porFecha.get(e.fecha);
      const punto = e.punto_minimo_admitido;
      if (prev == null || (punto != null && punto < prev)) {
        porFecha.set(e.fecha, punto);
      }
    });
    return [...porFecha.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, puntos]) => ({
        fecha: new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", { month: "short", year: "numeric" }),
        puntos,
      }));
  }

  function estadoActualizacion(categoriaUi, grupoActivo) {
    if (grupoActivo === false) {
      return { tipo: "sin_activar", texto: "El scraping de este grupo todavía no está activado. Los datos mostrados son de ejemplo." };
    }
    if (!tieneDatosReales(categoriaUi)) {
      return { tipo: "sin_datos", texto: "Aún no tenemos listado scrapeado para esta categoría en data/latest.json." };
    }
    if (!generado) {
      return { tipo: "desactualizado", texto: "No consta cuándo se actualizó el listado por última vez." };
    }
    const fecha = new Date(generado);
    const dias = Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
    if (dias > 14) {
      return { tipo: "desactualizado", texto: `El snapshot más reciente es del ${fecha.toLocaleDateString("es-ES")} (hace ${dias} días). El SESCAM puede haber publicado cambios desde entonces.` };
    }
    const hace = dias === 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`;
    return { tipo: "ok", texto: `Snapshot del listado: ${fecha.toLocaleString("es-ES")} (${hace}).` };
  }

  return {
    GERENCIAS,
    generado,
    tieneDatosReales,
    obtenerListadoCompleto,
    buscarPorApellido,
    buscarPersonas,
    historialCorte,
    estadoActualizacion,
  };
}

export async function cargarDatos() {
  const [latestRes, historicoRes] = await Promise.all([
    fetch("/data/latest.json"),
    fetch("/data/historico.json"),
  ]);
  if (!latestRes.ok) throw new Error(`No se pudo cargar latest.json (${latestRes.status})`);
  if (!historicoRes.ok) throw new Error(`No se pudo cargar historico.json (${historicoRes.status})`);
  const [latest, historico] = await Promise.all([latestRes.json(), historicoRes.json()]);
  return crearCapaDatos(latest, historico);
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
