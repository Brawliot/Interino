import { GERENCIA_EDUCACION } from "../educacion.js";
import { ambitoCorto } from "./etiquetasLista.js";

export function ambitoResumenFila(aparicionesGrupo) {
  const ab = new Set();
  for (const a of aparicionesGrupo) {
    if (a.ambitosMerged) {
      if (/Primaria/i.test(a.ambitosMerged)) ab.add("AP");
      if (/Especializada/i.test(a.ambitosMerged)) ab.add("AE");
    } else if (a.ambito) ab.add(ambitoCorto(a.ambito));
  }
  if (ab.has("AP") && ab.has("AE")) return "AE+AP";
  if (ab.has("AE")) return "AE";
  if (ab.has("AP")) return "AP";
  return "";
}

export function normalizarAparicion(a) {
  return {
    ...a,
    posicion: Number(a?.posicion ?? a?.pos ?? 0) || 0,
    puntos: Number(a?.puntos ?? 0) || 0,
    total: Number(a?.total ?? 0) || 0,
  };
}

export function clavePersonaListado(f) {
  return f.dniParcial || f.nombreCompleto;
}

/** Convierte fila(s) del listado completo al objeto candidato de PantallaResultado. */
export function candidatoDesdeFilasListado(filaClickada, todasLasFilas, { categoria, grupoId, ccaaId, esEducacion, esAdministracion, tipoListado }) {
  const clave = clavePersonaListado(filaClickada);
  const filasPersona = (todasLasFilas || []).filter((f) => clavePersonaListado(f) === clave);
  const apariciones = (filasPersona.length ? filasPersona : [filaClickada]).map((f) => {
    const pos = f.pos ?? (esEducacion && f.tipoListado === "bolsa_ordinaria" ? f.bolsa_orden : f.orden_lista ?? f.bolsa_orden);
    if (esEducacion) {
      return {
        sector: "educacion",
        categoria,
        grupoId,
        ccaaId,
        gerencia: GERENCIA_EDUCACION,
        ambito: "",
        posicion: pos,
        bolsa_orden: f.bolsa_orden,
        orden_lista: f.orden_lista,
        total: f.total,
        delante: Math.max(0, pos - 1),
        tipo_bolsa: f.tipo_bolsa,
        bolsa_codigo: f.bolsa_codigo,
        acceso: f.acceso,
        tipoListado: f.tipoListado || tipoListado,
        provincias: f.provincias || [],
        idiomas: f.idiomas,
        viaBolsa: f.viaBolsa || "propia",
      };
    }
    if (esAdministracion) {
      return {
        sector: "administracion",
        categoria,
        grupoId,
        ccaaId,
        gerencia: f.provincia || f.gerencia,
        provincia: f.provincia || f.gerencia,
        ambito: f.sub_bolsa,
        sub_bolsa: f.sub_bolsa,
        posicion: f.pos,
        num_bolsa: f.num_bolsa,
        total: f.total,
        delante: Math.max(0, (f.pos || 0) - 1),
      };
    }
    return {
      categoria,
      grupoId,
      ccaaId,
      gerencia: f.gerencia,
      gerenciaCompleta: f.gerenciaCompleta,
      ambito: f.ambito,
      posicion: f.pos,
      total: f.total,
      puntos: f.puntos,
      delante: Math.max(0, f.pos - 1),
      tiposContrato: f.tiposContrato,
    };
  });
  return {
    nombreCompleto: filaClickada.nombreCompleto,
    dniParcial: filaClickada.dniParcial,
    apariciones,
  };
}

export function construirFilasResumen(apariciones = []) {
  const map = new Map();
  apariciones.forEach((raw, idx) => {
    const a = normalizarAparicion(raw);
    const key = `${a.ccaaId || ""}\0${a.gerencia}\0${a.posicion}\0${a.puntos}`;
    if (!map.has(key)) {
      map.set(key, {
        gerencia: a.gerencia,
        ccaaNombre: a.ccaaNombre,
        posicion: a.posicion,
        puntos: a.puntos,
        apariciones: [a],
        indices: [idx],
      });
    } else {
      const row = map.get(key);
      row.apariciones.push(a);
      row.indices.push(idx);
    }
  });
  return [...map.values()]
    .map((row) => {
      const ambitoLabel = ambitoResumenFila(row.apariciones);
      return {
        ...row,
        ambitoLabel,
        key: `${row.gerencia}-${row.posicion}-${row.puntos}-${ambitoLabel}`,
      };
    })
    .sort((a, b) => a.posicion - b.posicion || (a.gerencia || "").localeCompare(b.gerencia || "", "es"));
}

export function grupoIdParaCapa(capa, aparicion, grupoIdFallback) {
  const gid = aparicion?.grupoId || grupoIdFallback;
  if (capa?.multi && aparicion?.ccaaId && gid && !String(gid).includes("::")) {
    return `${aparicion.ccaaId}::${gid}`;
  }
  return gid;
}

export function tituloCategoriaResultado(categoria, apariciones) {
  if (categoria) return categoria;
  const cats = [...new Set((apariciones || []).map((a) => a.categoria).filter(Boolean))];
  if (cats.length === 1) return cats[0];
  if (cats.length > 1) return "Varias categorías";
  return "";
}

export function aparicionParaDetalle(fila) {
  const items = fila?.apariciones;
  if (!items?.length) return normalizarAparicion(fila);
  if (items.length === 1) return items[0];
  const base = { ...items[0] };
  const ab = ambitoResumenFila(items);
  if (ab === "AE+AP") {
    return { ...base, ambitosMerged: "Atención Primaria y Atención Especializada" };
  }
  return base;
}
