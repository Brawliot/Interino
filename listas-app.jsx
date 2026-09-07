import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { useDatos, useAsegurarPacks, CcaaCapaProvider, packsParaContexto } from "./src/datos.jsx";
import { CCAA_LIST } from "./src/regiones.js";
import { GERENCIA_EDUCACION } from "./src/educacion.js";
import { limiteSeguimientos, puedeAnadirSeguimiento, mensajeLimiteSeguimientos } from "./src/plan.js";
import { LS_SEGUIMIENTOS, exportarSeguimientos, importarSeguimientosDesdeArchivo } from "./src/seguimientos-backup.js";
import {
  crearSeguimiento,
  normalizarSeguimiento,
  refrescarTodosSeguimientos,
  notificarCambiosSeguimientos,
} from "./src/seguimientos.js";
import { notificacionesHabilitadasEnDispositivo } from "./src/notificaciones.js";
import PantallaPoliticaPrivacidad from "./src/components/PantallaPoliticaPrivacidad.jsx";
import { C, GRAIN, FONT_BODY } from "./src/theme.js";
import Barra from "./src/components/Barra.jsx";
import BarraInferior, { tabBarraInferior } from "./src/components/BarraInferior.jsx";
import CargandoHerramienta from "./src/components/CargandoHerramienta.jsx";
import { grupoDeCategoria } from "./src/utils/grupoDeCategoria.js";
import { candidatoDesdeFilasListado, grupoIdParaCapa } from "./src/utils/candidatosListado.js";
import { LS_EDUCACION_LISTADO, leerModoListadoEducacion } from "./src/educacionListado.js";
import PantallaHome from "./src/pantallas/PantallaHome.jsx";
import PantallaMas from "./src/pantallas/PantallaMas.jsx";
import PantallaBuscar from "./src/pantallas/PantallaBuscar.jsx";
import PantallaSeguimientos from "./src/pantallas/PantallaSeguimientos.jsx";
import PantallaConfirmar from "./src/pantallas/PantallaConfirmar.jsx";
import PantallaListado from "./src/pantallas/PantallaListado.jsx";
import PantallaResultado from "./src/pantallas/PantallaResultado.jsx";
import PantallaInfoLlamamientos from "./src/pantallas/PantallaInfoLlamamientos.jsx";

const SimuladorBaremo = lazy(() => import("./src/herramientas/SimuladorBaremo.jsx"));
const SimuladorGerencia = lazy(() => import("./src/herramientas/SimuladorGerencia.jsx"));
const MapaOportunidades = lazy(() => import("./src/herramientas/MapaOportunidades.jsx"));
const CalculadoraNomina = lazy(() => import("./src/herramientas/CalculadoraNomina.jsx"));
const GuiaLlamamiento = lazy(() => import("./src/herramientas/GuiaLlamamiento.jsx"));
const CalculadoraMeritos = lazy(() => import("./src/herramientas/CalculadoraMeritos.jsx"));

const LS_RECIENTES = "interino_recientes_v1";
const LS_LAST_CCAA = "interino_last_ccaa_v1";

function leerStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function leerUltimaCcaaId() {
  try {
    const raw = localStorage.getItem(LS_LAST_CCAA);
    return raw && CCAA_LIST.some((c) => c.id === raw) ? raw : "clm";
  } catch {
    return "clm";
  }
}

function guardarUltimaCcaaId(id) {
  try {
    localStorage.setItem(LS_LAST_CCAA, id);
  } catch { /* quota / modo privado */ }
}

function ccaaPorId(id) {
  return CCAA_LIST.find((c) => c.id === id) || CCAA_LIST.find((c) => c.id === "clm");
}

const NOMBRE_APP = "Interino";

// 4 grupos SESCAM en la app (facultativo fusionado en licenciados en el portal).
// Categorías reales vienen de datos.gruposSanidad (inventario del portal).
const GRUPOS_SANIDAD_FALLBACK = [
  {
    id: "diplomado",
    nombre: "Personal Sanitario Diplomado",
    activo: true,
    categorias: ["Enfermero/a"],
  },
];

export default function ListasApp() {
  const datos = useDatos();
  const asegurarPacks = useAsegurarPacks();
  const [ccaas, setCcaas] = useState([]);
  const [sectorId, setSectorId] = useState("sanidad");
  const [listadoEducacionModo, setListadoEducacionModo] = useState(() => leerModoListadoEducacion(datos));
  const capaDatos = useMemo(() => {
    const ids = ccaas.map((c) => c.id);
    const ccaaPrincipal = ids[0] || "clm";
    if (sectorId === "educacion") {
      return (
        datos.paraSector?.(ccaaPrincipal, "educacion", { modoListadoEducacion: listadoEducacionModo }) ||
        datos.educacionBolsaClm ||
        datos.educacionAfinClm ||
        datos.educacionDisponiblesClm ||
        datos.paraCcaa("clm")
      );
    }
    if (sectorId === "administracion") {
      return datos.paraSector?.(ccaaPrincipal, "administracion") || datos.administracionClm || datos.paraCcaa("clm");
    }
    if (ids.length === 0) return datos.paraCcaa("clm");
    return datos.paraCcaas(ids);
  }, [datos, ccaas, sectorId, listadoEducacionModo]);
  const modoEducacion = sectorId === "educacion" || capaDatos.sector === "educacion";
  const modoAdministracion = sectorId === "administracion" || capaDatos.sector === "administracion";
  const gruposSanidad = useMemo(() => {
    const g = capaDatos.gruposSanidad;
    if (g?.length) return g;
    if (modoEducacion || modoAdministracion) return [];
    if (!datos.listo) return [];
    return GRUPOS_SANIDAD_FALLBACK;
  }, [capaDatos, modoEducacion, modoAdministracion, datos.listo]);
  const [paso, setPaso] = useState("inicio");
  const [pasoSeguimientosOrigen, setPasoSeguimientosOrigen] = useState("inicio");
  const [pasoPrivacidadOrigen, setPasoPrivacidadOrigen] = useState("inicio");
  const [sector, setSector] = useState(null);
  const [categoriaActual, setCategoriaActual] = useState("");
  const [grupoIdActual, setGrupoIdActual] = useState("diplomado");
  const [busquedaGlobal, setBusquedaGlobal] = useState(false);
  const [candidatos, setCandidatos] = useState([]);
  const [candidatoElegido, setCandidatoElegido] = useState(null);
  const [seguimientos, setSeguimientos] = useState([]);
  const [recientes, setRecientes] = useState([]);
  const [listadoCategoria, setListadoCategoria] = useState(gruposSanidad[0]?.categorias?.[0] || "");
  const [listadoGerencia, setListadoGerencia] = useState("");
  const [listadoAmbito, setListadoAmbito] = useState("");
  const [listadoGrupoId, setListadoGrupoId] = useState("diplomado");
  const [pantallaPrevia, setPantallaPrevia] = useState("buscar");
  const [herramientasCtx, setHerramientasCtx] = useState({ puntos: null, categoria: "" });
  const [avisoLimite, setAvisoLimite] = useState("");
  const [seguimientosListos, setSeguimientosListos] = useState(false);
  const [cargandoSector, setCargandoSector] = useState(false);

  useEffect(() => {
    const raw = leerStorage(LS_SEGUIMIENTOS, []);
    setSeguimientos(raw.map(normalizarSeguimiento).filter(Boolean));
    setRecientes(leerStorage(LS_RECIENTES, []));
    setSeguimientosListos(true);
  }, []);

  // Carga bajo demanda del pack del sector/CCAA activos.
  useEffect(() => {
    if (!datos.listo || typeof asegurarPacks !== "function") return undefined;
    const packs = packsParaContexto({
      ccaaIds: ccaas.map((c) => c.id),
      sector: sectorId,
      seguimientos: [],
    });
    const faltan = packs.filter((p) => !datos.packsCargados?.[p]);
    if (!faltan.length) return undefined;
    let cancelado = false;
    setCargandoSector(true);
    asegurarPacks(faltan).finally(() => {
      if (!cancelado) setCargandoSector(false);
    });
    return () => {
      cancelado = true;
    };
    // packsCargados no va en deps: evita bucles si un pack falla al cargar.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional
  }, [datos.listo, ccaas, sectorId, asegurarPacks]);

  useEffect(() => {
    if (!datos?.listo || !seguimientosListos || typeof asegurarPacks !== "function") {
      return undefined;
    }
    let cancelado = false;
    (async () => {
      const lista = (leerStorage(LS_SEGUIMIENTOS, [])).map(normalizarSeguimiento).filter(Boolean);
      if (!lista.length) return;
      try {
        const packs = packsParaContexto({ seguimientos: lista });
        const datosFresh = await asegurarPacks(packs);
        if (cancelado) return;
        const resultados = await refrescarTodosSeguimientos(lista, { datos: datosFresh });
        if (cancelado) return;
        setSeguimientos(resultados.map((r) => r.seguimientoActualizado));
        if (notificacionesHabilitadasEnDispositivo()) {
          notificarCambiosSeguimientos(resultados);
        }
      } catch {
        /* red / datos: se mantienen snapshots previos */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [datos.listo, seguimientosListos, asegurarPacks]);

  useEffect(() => {
    if (!seguimientosListos) return;
    try {
      localStorage.setItem(LS_SEGUIMIENTOS, JSON.stringify(seguimientos));
    } catch { /* quota / modo privado */ }
  }, [seguimientos, seguimientosListos]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_RECIENTES, JSON.stringify(recientes));
    } catch { /* quota / modo privado */ }
  }, [recientes]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_EDUCACION_LISTADO, listadoEducacionModo);
    } catch { /* quota / modo privado */ }
  }, [listadoEducacionModo]);

  useEffect(() => {
    if (!datos.listo || sectorId !== "educacion") return;
    setListadoEducacionModo((prev) => {
      const preferido = leerModoListadoEducacion(datos);
      if (prev === preferido) return prev;
      if (prev === "bolsa" && datos.educacionBolsaActiva) return prev;
      if (prev === "disponibles" && datos.educacionDisponiblesActiva) return prev;
      if (prev === "afin" && datos.educacionAfinActiva) return prev;
      return preferido;
    });
  }, [datos.listo, datos.educacionBolsaActiva, datos.educacionDisponiblesActiva, datos.educacionAfinActiva, sectorId]);

  useEffect(() => {
    if (!datos.listo || sectorId !== "educacion") return;
    if (listadoEducacionModo === "bolsa" && !datos.educacionBolsaActiva) {
      if (datos.educacionDisponiblesActiva) setListadoEducacionModo("disponibles");
      else if (datos.educacionAfinActiva) setListadoEducacionModo("afin");
    } else if (listadoEducacionModo === "disponibles" && !datos.educacionDisponiblesActiva) {
      if (datos.educacionBolsaActiva) setListadoEducacionModo("bolsa");
      else if (datos.educacionAfinActiva) setListadoEducacionModo("afin");
    } else if (listadoEducacionModo === "afin" && !datos.educacionAfinActiva) {
      if (datos.educacionBolsaActiva) setListadoEducacionModo("bolsa");
      else if (datos.educacionDisponiblesActiva) setListadoEducacionModo("disponibles");
    }
  }, [sectorId, listadoEducacionModo, datos.listo, datos.educacionBolsaActiva, datos.educacionDisponiblesActiva, datos.educacionAfinActiva]);

  const abrirPrivacidad = () => {
    setPasoPrivacidadOrigen(paso);
    setPaso("privacidad");
  };

  const irABuscarConCcaas = (lista) => {
    if (!lista?.length) return;
    setCcaas(lista);
    setSectorId("sanidad");
    setSector({ id: "sanidad", nombre: "Sanidad", activo: true });
    guardarUltimaCcaaId(lista[0].id);
    setPaso("buscar");
  };

  const irABuscarUltima = () => {
    const ccaa = ccaaPorId(leerUltimaCcaaId());
    irABuscarConCcaas([ccaa.activo ? ccaa : ccaaPorId("clm")]);
  };

  const irABuscarDesdeMenu = () => {
    if (paso === "buscar") return;
    if (["confirmar", "resultado", "listado", "info-llamamientos"].includes(paso)) {
      setPaso("buscar");
      return;
    }
    if (ccaas.length) {
      setPaso("buscar");
      return;
    }
    irABuscarUltima();
  };

  const irSeguimientos = () => {
    if (paso === "seguimientos") return;
    setPasoSeguimientosOrigen(paso);
    setPaso("seguimientos");
  };

  const irMasDesdeMenu = () => {
    if (paso === "mas") return;
    setPaso("mas");
  };

  const irSimuladorGerencia = (puntos, categoria = herramientasCtx.categoria || categoriaActual) => {
    setHerramientasCtx({ puntos, categoria: categoria || "" });
    setPaso("simulador-gerencia");
  };

  const iniciarBusqueda = async (categoria, consulta) => {
    if (!datos.listo) return -1;
    const packs = packsParaContexto({
      ccaaIds: ccaas.map((c) => c.id),
      sector: sectorId,
    });
    let datosNow = datos;
    if (packs.some((p) => !datos.packsCargados?.[p]) && typeof asegurarPacks === "function") {
      setCargandoSector(true);
      try {
        datosNow = await asegurarPacks(packs);
      } finally {
        setCargandoSector(false);
      }
    }
    const ids = ccaas.map((c) => c.id);
    const ccaaPrincipal = ids[0] || "clm";
    const capa =
      sectorId === "educacion"
        ? datosNow.paraSector?.(ccaaPrincipal, "educacion", {
            modoListadoEducacion: listadoEducacionModo,
          }) || datosNow.paraCcaa("clm")
        : sectorId === "administracion"
          ? datosNow.paraSector?.(ccaaPrincipal, "administracion") || datosNow.paraCcaa("clm")
          : ids.length
            ? datosNow.paraCcaas(ids)
            : datosNow.paraCcaa("clm");
    const grupos = capa?.gruposSanidad?.length
      ? capa.gruposSanidad
      : modoEducacion || modoAdministracion
        ? []
        : GRUPOS_SANIDAD_FALLBACK;
    const grupo = grupoDeCategoria(categoria, grupos);
    setBusquedaGlobal(false);
    setCategoriaActual(categoria);
    setGrupoIdActual(grupo?.id || "diplomado");
    if (!grupo?.activo || !grupo?.id || !capa?.tieneDatosReales?.(categoria, grupo.id)) {
      return -1;
    }
    try {
      const res = await capa.buscarPersonas(grupo.id, categoria, consulta);
      const personas = res.personas;
      if (consulta.trim()) {
        setRecientes((prev) => {
          const sinDuplicado = prev.filter(
            (r) => !(r.categoria === categoria && r.consulta === consulta && !r.global)
          );
          return [{ categoria, consulta, ccaaId: grupo.ccaaId, global: false }, ...sinDuplicado].slice(0, 4);
        });
      }
      if (personas.length === 0) return 0;
      setPantallaPrevia("buscar");
      if (personas.length > 1) {
        setCandidatos(personas);
        setPaso("confirmar");
      } else {
        setCandidatoElegido(personas[0]);
        setPaso("resultado");
      }
      return personas.length;
    } catch {
      return -1;
    }
  };

  const iniciarBusquedaGlobal = async (consulta) => {
    if (!datos.listo) return 0;
    const packs = packsParaContexto({
      ccaaIds: ccaas.map((c) => c.id),
      sector: "sanidad",
    });
    let datosNow = datos;
    if (packs.some((p) => !datos.packsCargados?.[p]) && typeof asegurarPacks === "function") {
      setCargandoSector(true);
      try {
        datosNow = await asegurarPacks(packs);
      } finally {
        setCargandoSector(false);
      }
    }
    const ids = ccaas.map((c) => c.id);
    const capa = ids.length ? datosNow.paraCcaas(ids) : datosNow.paraCcaa("clm");
    if (!capa?.buscarGlobal) return 0;
    setBusquedaGlobal(true);
    setCategoriaActual("");
    const res = await capa.buscarGlobal(consulta);
    const personas = res.personas;
    if (consulta.trim()) {
      setRecientes((prev) => {
        const sinDuplicado = prev.filter((r) => !(r.consulta === consulta && r.global));
        return [{ consulta, global: true, categoria: "" }, ...sinDuplicado].slice(0, 4);
      });
    }
    if (personas.length === 0) return 0;
    setPantallaPrevia("buscar");
    const primera = personas[0];
    setGrupoIdActual(primera.grupoId || primera.apariciones?.[0]?.grupoId || grupoIdActual);
    setCategoriaActual(primera.categoria || primera.apariciones?.[0]?.categoria || "");
    if (personas.length > 1) {
      setCandidatos(personas);
      setPaso("confirmar");
    } else {
      setCandidatoElegido(personas[0]);
      setPaso("resultado");
    }
    return personas.length;
  };

  const estaGuardado = (gerencia, ambito, nombreCompleto, categoria = categoriaActual, ccaaId) =>
    seguimientos.some(
      (s) =>
        s.categoria === categoria &&
        s.gerencia === gerencia &&
        s.ambito === (ambito || "") &&
        (ccaaId ? s.ccaaId === ccaaId : true) &&
        s.candidato.nombreCompleto === nombreCompleto
    );

  const guardarSeguimiento = (gerencia, ambito, resultado, categoria = categoriaActual, grupoId = grupoIdActual, ccaaId) => {
    setSeguimientos((prev) => {
      if (
        prev.some(
          (s) =>
            s.categoria === categoria &&
            s.gerencia === gerencia &&
            s.ambito === (ambito || "") &&
            (ccaaId ? s.ccaaId === ccaaId : true) &&
            (s.persona?.nombreCompleto || s.candidato?.nombreCompleto) === resultado.nombreCompleto
        )
      ) {
        return prev;
      }
      if (!puedeAnadirSeguimiento(prev.length)) {
        setAvisoLimite(mensajeLimiteSeguimientos());
        return prev;
      }
      setAvisoLimite("");
      const sector =
        resultado?.sector ||
        (sectorId === "educacion" || sectorId === "administracion" ? sectorId : "sanidad");
      return [
        ...prev,
        crearSeguimiento({
          categoria,
          gerencia,
          ambito: ambito || "",
          grupoId,
          ccaaId: ccaaId || capaDatos.ccaaId,
          sector,
          modoListado: sector === "educacion" ? listadoEducacionModo : null,
          resultado,
        }),
      ];
    });
  };

  const importarSeguimientos = async (file) => {
    try {
      const lista = await importarSeguimientosDesdeArchivo(file);
      const max = limiteSeguimientos();
      if (lista.length > max) {
        setSeguimientos(lista.map(normalizarSeguimiento).filter(Boolean).slice(0, max));
        setAvisoLimite(`Importados ${max} de ${lista.length} (límite del plan).`);
      } else {
        setSeguimientos(lista.map(normalizarSeguimiento).filter(Boolean));
        setAvisoLimite("");
      }
    } catch {
      setAvisoLimite("No se pudo importar el archivo. Comprueba que sea un JSON de Interino.");
    }
  };

  const abrirSeguimiento = (s) => {
    if (s.gerencia === GERENCIA_EDUCACION) {
      setSectorId("educacion");
    }
    setCategoriaActual(s.categoria);
    const grupo = grupoDeCategoria(s.categoria, gruposSanidad, s.ccaaId);
    setGrupoIdActual(s.grupoId || grupo?.id || "diplomado");
    setBusquedaGlobal(false);
    setCandidatoElegido({
      nombreCompleto: s.candidato.nombreCompleto,
      dniParcial: s.candidato.dniParcial,
      apariciones: [
        {
          gerencia: s.gerencia,
          ambito: s.ambito,
          ccaaId: s.ccaaId,
          ccaaNombre: CCAA_LIST.find((c) => c.id === s.ccaaId)?.nombre,
          grupoId: s.grupoId || grupo?.id,
          categoria: s.categoria,
          ...s.candidato,
        },
      ],
    });
    setPaso("resultado");
  };

  return (
    <CcaaCapaProvider capa={capaDatos}>
    <div
      className="min-h-screen"
      style={{ background: C.paper, backgroundImage: `url("${GRAIN}")`, fontFamily: FONT_BODY, color: C.ink }}
    >
      <style>{`
        button { cursor: pointer; transition: transform .08s ease, opacity .15s ease; }
        button:not(:disabled):active { transform: scale(.98); }
        select, input { font-family: inherit; border-radius: 14px 5px 14px 5px !important; }
        *:focus-visible { outline: none; box-shadow: 0 0 0 3px ${C.gold}66; }
        @media (prefers-reduced-motion: reduce) { button { transition: none; } }
      `}</style>

      <div className={`max-w-md mx-auto ${paso === "inicio" ? "" : "pb-24"}`}>
        {(!datos.listo || cargandoSector) && (
          <div
            role="status"
            style={{
              margin: paso === "inicio" ? "0 0 0" : "0 20px 0",
              padding: "8px 14px",
              background: C.paperDeep,
              color: C.inkSoft,
              fontFamily: FONT_BODY,
              fontSize: 12.5,
              textAlign: "center",
              borderBottom: paso === "inicio" ? `1px solid ${C.line}` : "none",
              borderRadius: paso === "inicio" ? 0 : "0 0 12px 12px",
            }}
          >
            {!datos.listo
              ? "Cargando listados en segundo plano…"
              : "Cargando sector…"}
          </div>
        )}

        {paso === "inicio" && (
          <PantallaHome
            onConfirmCcaas={irABuscarConCcaas}
            onSeguimientos={irSeguimientos}
            numSeguimientos={seguimientos.length}
          />
        )}

        {paso === "mas" && (
          <PantallaMas
            onHerramienta={(id) => setPaso(id)}
            onPrivacidad={abrirPrivacidad}
            atras={() => setPaso("inicio")}
          />
        )}

        {paso === "buscar" && (
          <PantallaBuscar
            key={`${ccaas.map((c) => c.id).join("+") || "clm"}-${sectorId}-${listadoEducacionModo}`}
            ccaas={ccaas.length ? ccaas : [ccaaPorId("clm")]}
            atras={() => setPaso("inicio")}
            onBuscar={iniciarBusqueda}
            onBuscarGlobal={!modoEducacion && !modoAdministracion && capaDatos.multi ? iniciarBusquedaGlobal : undefined}
            onVerListado={(categoria, gerencia) => {
              const g = grupoDeCategoria(categoria, gruposSanidad);
              setListadoCategoria(categoria);
              setListadoGerencia(gerencia || "");
              setListadoAmbito("");
              setListadoGrupoId(g?.id || (modoEducacion ? (ccaas[0]?.id === "mur" ? "maestros" : "secundaria") : modoAdministracion ? "funcionario" : "diplomado"));
              setPantallaPrevia("buscar");
              setPaso("listado");
            }}
            recientes={recientes}
            gruposSanidad={gruposSanidad}
            sectorId={sectorId}
            educacionActiva={datos.educacionActiva}
            educacionMurciaActiva={datos.educacionMurciaActiva}
            administracionActiva={datos.administracionActiva}
            educacionBolsaActiva={datos.educacionBolsaActiva}
            educacionDisponiblesActiva={datos.educacionDisponiblesActiva}
            educacionAfinActiva={datos.educacionAfinActiva}
            murciaActiva={datos.murciaActiva}
            madridActiva={datos.madridActiva}
            modoEducacion={modoEducacion}
            modoAdministracion={modoAdministracion}
            modoListadoEducacion={listadoEducacionModo}
            onModoListadoEducacionChange={setListadoEducacionModo}
            onSectorChange={(s) => setSectorId(s.id)}
          />
        )}

        {paso === "confirmar" && (
          <PantallaConfirmar
            categoria={categoriaActual}
            candidatos={candidatos}
            global={busquedaGlobal}
            modoAdministracion={modoAdministracion}
            atras={() => setPaso("buscar")}
            onElegir={(persona) => {
              setCandidatoElegido(persona);
              setGrupoIdActual(persona.grupoId || persona.apariciones?.[0]?.grupoId || grupoIdActual);
              setCategoriaActual(persona.categoria || persona.apariciones?.[0]?.categoria || categoriaActual);
              setPantallaPrevia("buscar");
              setPaso("resultado");
            }}
          />
        )}

        {paso === "resultado" && candidatoElegido && (
          <PantallaResultado
            categoria={categoriaActual || candidatoElegido.apariciones?.[0]?.categoria || ""}
            grupoId={grupoIdParaCapa(capaDatos, candidatoElegido.apariciones?.[0], grupoIdActual)}
            grupoActivo={grupoDeCategoria(
              categoriaActual || candidatoElegido.apariciones?.[0]?.categoria,
              gruposSanidad,
              candidatoElegido.apariciones?.[0]?.ccaaId
            )?.activo}
            candidato={candidatoElegido}
            modoEducacion={modoEducacion}
            modoAdministracion={modoAdministracion}
            modoListadoEducacion={listadoEducacionModo}
            atras={() => setPaso(pantallaPrevia || "buscar")}
            estaGuardado={(gerencia, ambito, nombre, cat, ccaaId) => estaGuardado(gerencia, ambito, nombre, cat, ccaaId)}
            onGuardar={guardarSeguimiento}
            onVerListado={(gerencia, ambito, cat, gid) => {
              setListadoCategoria(cat || categoriaActual);
              setListadoGerencia(gerencia);
              setListadoAmbito(ambito || "");
              setListadoGrupoId(gid || grupoIdActual);
              setPantallaPrevia("resultado");
              setPaso("listado");
            }}
            onInfoLlamamientos={() => setPaso("info-llamamientos")}
          />
        )}

        {paso === "info-llamamientos" && (
          <PantallaInfoLlamamientos atras={() => setPaso("resultado")} />
        )}

        {paso === "listado" && (
          <PantallaListado
            categoria={listadoCategoria}
            gerencia={listadoGerencia}
            ambito={listadoAmbito}
            grupoId={listadoGrupoId}
            grupoActivo={(gruposSanidad.find((g) => g.id === listadoGrupoId) || grupoDeCategoria(listadoCategoria, gruposSanidad))?.activo}
            modoEducacion={modoEducacion}
            modoAdministracion={modoAdministracion}
            modoListadoEducacion={listadoEducacionModo}
            atras={() => setPaso(pantallaPrevia)}
            onAbrirPersona={(fila, todasLasFilas) => {
              const esEducacionListado = modoEducacion || capaDatos.sector === "educacion";
              const esAdministracionListado = modoAdministracion || capaDatos.sector === "administracion";
              setCategoriaActual(listadoCategoria);
              setGrupoIdActual(listadoGrupoId);
              setBusquedaGlobal(false);
              setCandidatoElegido(
                candidatoDesdeFilasListado(fila, todasLasFilas, {
                  categoria: listadoCategoria,
                  grupoId: listadoGrupoId,
                  ccaaId: capaDatos.ccaaId || "clm",
                  esEducacion: esEducacionListado,
                  esAdministracion: esAdministracionListado,
                  tipoListado: capaDatos.tipoListado,
                })
              );
              setPantallaPrevia("listado");
              setPaso("resultado");
            }}
          />
        )}

        {paso === "seguimientos" && (
          <PantallaSeguimientos
            seguimientos={seguimientos}
            atras={() => setPaso(pasoSeguimientosOrigen)}
            limiteMax={limiteSeguimientos()}
            onExportar={() => exportarSeguimientos(seguimientos)}
            onImportar={importarSeguimientos}
            gruposSanidad={gruposSanidad}
            onAbrir={abrirSeguimiento}
          />
        )}

        {paso === "simulador-baremo" && (
          <Suspense fallback={<CargandoHerramienta />}>
            <SimuladorBaremo
              C={C}
              Barra={Barra}
              atras={() => setPaso("mas")}
              onIrGerencia={(puntos) => irSimuladorGerencia(puntos)}
            />
          </Suspense>
        )}

        {paso === "simulador-gerencia" && (
          <Suspense fallback={<CargandoHerramienta />}>
            <SimuladorGerencia
              C={C}
              Barra={Barra}
              gruposSanidad={gruposSanidad}
              grupoDeCategoria={grupoDeCategoria}
              categoriaInicial={herramientasCtx.categoria || categoriaActual}
              puntosIniciales={herramientasCtx.puntos}
              atras={() => setPaso("mas")}
            />
          </Suspense>
        )}

        {paso === "mapa-oportunidades" && (
          <Suspense fallback={<CargandoHerramienta />}>
            <MapaOportunidades
              C={C}
              Barra={Barra}
              gruposSanidad={gruposSanidad}
              grupoDeCategoria={grupoDeCategoria}
              categoriaInicial={herramientasCtx.categoria || categoriaActual}
              puntosIniciales={herramientasCtx.puntos}
              atras={() => setPaso("mas")}
            />
          </Suspense>
        )}

        {paso === "calculadora-nomina" && (
          <Suspense fallback={<CargandoHerramienta />}>
            <CalculadoraNomina C={C} Barra={Barra} atras={() => setPaso("mas")} />
          </Suspense>
        )}

        {paso === "guia-llamamiento" && (
          <Suspense fallback={<CargandoHerramienta />}>
            <GuiaLlamamiento C={C} Barra={Barra} atras={() => setPaso("mas")} />
          </Suspense>
        )}

        {paso === "calculadora-meritos" && (
          <Suspense fallback={<CargandoHerramienta />}>
            <CalculadoraMeritos
              C={C}
              Barra={Barra}
              puntosIniciales={herramientasCtx.puntos ?? candidatoElegido?.apariciones?.[0]?.puntos}
              atras={() => setPaso("mas")}
              onIrGerencia={(puntos) => irSimuladorGerencia(puntos)}
            />
          </Suspense>
        )}

        {paso === "privacidad" && (
          <PantallaPoliticaPrivacidad
            C={C}
            Barra={Barra}
            atras={() => setPaso(pasoPrivacidadOrigen)}
          />
        )}

        {avisoLimite && (
          <div
            className="fixed left-4 right-4 mx-auto max-w-md px-4 py-3 z-[60]"
            style={{
              bottom: "calc(56px + 12px + env(safe-area-inset-bottom, 0px))",
              background: C.navy,
              color: "#fff",
              borderRadius: "12px 4px 12px 4px",
              fontFamily: FONT_BODY,
              fontSize: 12,
              lineHeight: 1.45,
              boxShadow: "0 8px 24px rgba(0,0,0,.18)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <p style={{ margin: 0 }}>{avisoLimite}</p>
              <button
                type="button"
                onClick={() => setAvisoLimite("")}
                style={{ background: "transparent", border: "none", color: C.goldSoft, fontWeight: 700, fontSize: 12, flexShrink: 0 }}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>

      <BarraInferior
        activo={tabBarraInferior(paso)}
        onBuscar={irABuscarDesdeMenu}
        onSeguimientos={irSeguimientos}
        onMas={irMasDesdeMenu}
        numSeguimientos={seguimientos.length}
      />
    </div>
    </CcaaCapaProvider>
  );
}

