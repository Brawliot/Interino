import { useEffect, useMemo, useState } from "react";
import { useDatos } from "../datos.jsx";
import { filasAPuntos } from "./posicionLista.js";

/** Hook compartido: categoría + gerencia + filas de puntos del listado SESCAM. */
export function useListadoSanidad(gruposSanidad, grupoDeCategoria, categoriaInicial) {
  const datos = useDatos();
  const capa = useMemo(() => {
    try {
      return datos?.paraSector?.("clm", "sanidad") || datos;
    } catch {
      return datos;
    }
  }, [datos]);

  const categorias = useMemo(() => {
    const grupos = capa?.gruposSanidad?.length ? capa.gruposSanidad : gruposSanidad;
    const out = [];
    const vistos = new Set();
    for (const g of grupos || []) {
      if (!g.activo) continue;
      for (const c of g.categorias || []) {
        if (vistos.has(c) || !capa.tieneDatosReales?.(c, g.id)) continue;
        vistos.add(c);
        out.push(c);
      }
    }
    return out.length ? out : ["Enfermero/a"];
  }, [capa, gruposSanidad]);

  const [categoria, setCategoria] = useState(categoriaInicial || categorias[0]);
  const gruposRef = capa?.gruposSanidad?.length ? capa.gruposSanidad : gruposSanidad;
  const grupo = grupoDeCategoria?.(categoria, gruposRef);
  const grupoId = grupo?.id || "diplomado";

  const [gerencias, setGerencias] = useState([]);
  const [gerencia, setGerencia] = useState("");
  const [ambito, setAmbito] = useState("");
  const [filas, setFilas] = useState([]);
  const [ambitos, setAmbitos] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (categorias.length && !categorias.includes(categoria)) setCategoria(categorias[0]);
  }, [categorias, categoria]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!capa.tieneDatosReales?.(categoria, grupoId)) {
        if (!cancel) {
          setGerencias([]);
          setGerencia("");
          setAmbito("");
          setAmbitos([]);
          setFilas([]);
        }
        return;
      }
      try {
        const gs = await capa.gerenciasDeCategoria(grupoId, categoria);
        if (!cancel) {
          setGerencias(gs);
          setGerencia(gs[0] || "");
          setAmbito("");
        }
      } catch {
        if (!cancel) {
          setGerencias([]);
          setGerencia("");
          setAmbito("");
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [capa, categoria, grupoId]);

  useEffect(() => {
    let cancel = false;
    setCargando(true);
    (async () => {
      if (!gerencia || !capa.obtenerListadoCompleto) {
        if (!cancel) {
          setFilas([]);
          setAmbitos([]);
          setCargando(false);
        }
        return;
      }
      try {
        const todas = await capa.obtenerListadoCompleto(grupoId, categoria, gerencia, "");
        const ambs = [...new Set((todas || []).map((f) => f.ambito).filter(Boolean))];
        if (cancel) return;
        setAmbitos(ambs);
        let amb = ambito;
        if (!amb || !ambs.includes(amb)) {
          amb = ambs[0] || "";
          if (amb !== ambito) setAmbito(amb);
        }
        const filtradas = amb ? (todas || []).filter((f) => f.ambito === amb) : todas || [];
        setFilas(filasAPuntos(filtradas.length ? filtradas : todas));
      } catch {
        if (!cancel) {
          setFilas([]);
          setAmbitos([]);
        }
      } finally {
        if (!cancel) setCargando(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [capa, grupoId, categoria, gerencia, ambito]);

  return {
    capa,
    categorias,
    categoria,
    setCategoria,
    grupoId,
    gerencias,
    gerencia,
    setGerencia,
    ambitos,
    ambito,
    setAmbito,
    filas,
    cargando,
  };
}
