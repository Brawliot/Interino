import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { Search, ChevronLeft, ChevronRight, Bell, BellRing, Lock, Stethoscope, GraduationCap, Landmark, TrendingUp, Users, AlertTriangle, List as ListIcon, UserCheck, Smartphone, History, ShieldAlert, Info, PhoneCall, Calculator, ArrowLeftRight, Map, Banknote, Award } from "lucide-react";
import { useDatos, ambitoLegible, coincideBusqueda } from "./src/datos.jsx";
import { etiquetaAmbitoAparicion } from "./src/utils/apariciones.js";
import MapaEspanaCCAA from "./src/MapaEspanaCCAA.jsx";
import SelectorSectores from "./src/SelectorSectores.jsx";

const SimuladorBaremo = lazy(() => import("./src/herramientas/SimuladorBaremo.jsx"));
const SimuladorGerencia = lazy(() => import("./src/herramientas/SimuladorGerencia.jsx"));
const MapaOportunidades = lazy(() => import("./src/herramientas/MapaOportunidades.jsx"));
const CalculadoraNomina = lazy(() => import("./src/herramientas/CalculadoraNomina.jsx"));
const GuiaLlamamiento = lazy(() => import("./src/herramientas/GuiaLlamamiento.jsx"));
const CalculadoraMeritos = lazy(() => import("./src/herramientas/CalculadoraMeritos.jsx"));
const GraficoHistoricoCorte = lazy(() => import("./src/components/GraficoHistoricoCorte.jsx"));

const LS_SEGUIMIENTOS = "interino_seguimientos_v1";
const LS_RECIENTES = "interino_recientes_v1";
const NUM_GERENCIAS = 14;

function leerStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------
// TOKENS — "Expediente oficial": papel, tinta marina, sello dorado
// ---------------------------------------------------------------
const C = {
  paper: "#F3F0E6",
  paperDeep: "#E8E2D2",
  ink: "#20281F",
  inkSoft: "#5B6355",
  navy: "#233D30",
  navyDeep: "#152A20",
  gold: "#B07A3B",
  goldSoft: "#E6CE9F",
  clay: "#B5562F",
  card: "#FBF9F3",
  line: "#D9D0BA",
  ok: "#3C6B4A",
  okBg: "#E3EADB",
};

// textura de grano de papel, reutilizable como fondo
const GRAIN =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.05'/></svg>`
  );

const FONT_DISPLAY = "'Fraunces', serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'Courier New', monospace";

// ---------------------------------------------------------------
// DATOS DE EJEMPLO — solo Sanidad / Castilla-La Mancha es real
// ---------------------------------------------------------------
const CCAA = [
  { id: "gal", nombre: "Galicia", activo: false },
  { id: "ast", nombre: "Asturias", activo: false },
  { id: "cant", nombre: "Cantabria", activo: false },
  { id: "pv", nombre: "País Vasco", activo: false },
  { id: "nav", nombre: "Navarra", activo: false },
  { id: "rioja", nombre: "La Rioja", activo: false },
  { id: "ar", nombre: "Aragón", activo: false },
  { id: "cat", nombre: "Cataluña", activo: false },
  { id: "val", nombre: "Comunitat Valenciana", activo: false },
  { id: "bal", nombre: "Illes Balears", activo: false },
  { id: "mad", nombre: "Comunidad de Madrid", activo: false },
  { id: "cyl", nombre: "Castilla y León", activo: false },
  { id: "clm", nombre: "Castilla-La Mancha", activo: true },
  { id: "ext", nombre: "Extremadura", activo: false },
  { id: "mur", nombre: "Región de Murcia", activo: false },
  { id: "and", nombre: "Andalucía", activo: false },
  { id: "can", nombre: "Canarias", activo: false },
];

const SECTORES = [
  { id: "sanidad", nombre: "Sanidad", icono: Stethoscope, activo: true, fuente: "SESCAM · Bolsa única SELECTA" },
  { id: "educacion", nombre: "Educación", icono: GraduationCap, activo: false, fuente: "Próximamente" },
  { id: "administracion", nombre: "Administración General", icono: Landmark, activo: false, fuente: "Próximamente" },
];

const HERRAMIENTAS = [
  { id: "simulador-baremo", titulo: "Simulador de baremo", subtitulo: "¿Cuántos puntos tendrías?", icono: Calculator, activo: true },
  { id: "simulador-gerencia", titulo: "Simulador de gerencia", subtitulo: "Tu posición en otra gerencia", icono: ArrowLeftRight, activo: true },
  { id: "mapa-oportunidades", titulo: "Mapa de oportunidades", subtitulo: "Dónde tienes más opciones", icono: Map, activo: true },
  { id: "calculadora-nomina", titulo: "Calculadora de nómina", subtitulo: "¿Cuánto cobrarías?", icono: Banknote, activo: true },
  { id: "guia-llamamiento", titulo: "Guía del llamamiento", subtitulo: "Te han llamado, ¿ahora qué?", icono: PhoneCall, activo: true },
  { id: "calculadora-meritos", titulo: "Calculadora de méritos", subtitulo: "¿Cuánto sube tu baremo?", icono: Award, activo: true },
];

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

const grupoDeCategoria = (categoria, grupos) => grupos.find((g) => g.categorias.includes(categoria));

// Gerencias de respaldo para grupos sin scraper (datos de ejemplo).
const GERENCIAS_EJEMPLO = [
  "Albacete",
  "Alcázar de San Juan",
  "Almansa",
  "Ciudad Real",
  "Cuenca",
  "Guadalajara",
  "Hellín",
  "Puertollano",
  "Talavera de la Reina",
  "Toledo",
  "Toledo AE",
  "Tomelloso",
  "Valdepeñas",
  "Villarrobledo",
];

// ---------------------------------------------------------------
// LÓGICA DE TENDENCIA / CORTE
// ---------------------------------------------------------------
// Nº mínimo de publicaciones guardadas para atrevernos a estimar tendencia.
const MIN_HISTORICO_TENDENCIA = 3;

function ambitoCorto(ambito) {
  if (!ambito) return "";
  if (ambito === "Atencion Primaria" || ambito.includes("Primaria")) return "AP";
  if (ambito === "Atencion Especializada" || ambito.includes("Especializada")) return "AE";
  return ambito;
}

function etiquetaGerenciaCorta(categoria, gerencia, ambito) {
  const ab = ambitoCorto(ambito);
  return ab ? `${gerencia} · ${ab}` : gerencia;
}

function etiquetaLista(categoria, gerencia, ambito, aparicion) {
  const base = `${categoria} · ${gerencia}`;
  const ab = aparicion?.ambitosMerged || (ambito ? ambitoLegible(ambito) : "");
  return ab ? `${base} · ${ab}` : base;
}

// clasifica si la persona está "en zona de riesgo" de ser llamada pronto, según la velocidad real de bajada del corte
function zonaRiesgo(puntosCandidato, historial) {
  const corteActual = historial[historial.length - 1].puntos;
  const distancia = puntosCandidato - corteActual;
  if (distancia >= 0) return { nivel: "llamado", convocatorias: 0, velocidad: null };
  // con menos publicaciones que el mínimo no se estima tendencia: sin datos, sin cuento
  if (historial.length < MIN_HISTORICO_TENDENCIA) return { nivel: "sin_historico", convocatorias: null, velocidad: null };
  const deltas = [];
  for (let i = 1; i < historial.length; i++) deltas.push(historial[i - 1].puntos - historial[i].puntos);
  const velocidad = deltas.reduce((a, b) => a + b, 0) / deltas.length; // puntos que baja el corte por convocatoria, de media
  const convocatorias = velocidad > 0 ? Math.ceil(Math.abs(distancia) / velocidad) : null;
  if (convocatorias !== null && convocatorias <= 2) return { nivel: "alto", convocatorias, velocidad };
  if (convocatorias !== null && convocatorias <= 5) return { nivel: "medio", convocatorias, velocidad };
  return { nivel: "bajo", convocatorias, velocidad };
}

function estadoActualizacionEjemplo(categoria, gruposSanidad) {
  const grupo = grupoDeCategoria(categoria, gruposSanidad);
  if (grupo && !grupo.activo) {
    return { tipo: "sin_activar", texto: "Este grupo aún no tiene listados scrapeados. Sin datos todavía." };
  }
  return { tipo: "ok", texto: "Datos de ejemplo del prototipo." };
}

// ---------------------------------------------------------------
// PIEZAS
// ---------------------------------------------------------------
function CargandoHerramienta() {
  return (
    <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, padding: 24, textAlign: "center" }}>
      Cargando…
    </p>
  );
}

function Sello({ children }) {
  return (
    <div
      className="inline-flex items-center gap-2"
      style={{
        border: `1.5px solid ${C.clay}`,
        color: C.clay,
        padding: "5px 13px 4px",
        fontFamily: FONT_MONO,
        fontSize: 11.5,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        borderRadius: "3px 11px 4px 12px / 9px 4px 12px 3px",
        transform: "rotate(-1.6deg)",
        boxShadow: `1px 1px 0 ${C.clay}22`,
      }}
    >
      {children}
    </div>
  );
}

// trazo subrayado, imperfecto, tipo rotulador
function Subrayado({ width = 168, color, style }) {
  return (
    <svg width={width} height="14" viewBox={`0 0 ${width} 14`} style={{ display: "block", marginTop: -6, ...style }} aria-hidden="true">
      <path
        d={`M3,9.5 C ${width * 0.28},4 ${width * 0.42},12 ${width * 0.6},7 S ${width * 0.86},3 ${width - 4},8.5`}
        fill="none"
        stroke={color || C.clay}
        strokeWidth="4.5"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

function AvisoActualizacion({ categoria, grupoId, grupoActivo }) {
  const datos = useDatos();
  const [e, setE] = useState({ tipo: "ok", texto: "Comprobando actualización…" });

  useEffect(() => {
    let cancel = false;
    if (grupoActivo && datos.tieneDatosReales(categoria, grupoId)) {
      datos.estadoActualizacion(categoria, grupoId, true).then((est) => {
        if (!cancel) setE(est);
      });
    } else if (grupoActivo) {
      setE({ tipo: "sin_datos", texto: "Aún no tenemos listado scrapeado para esta categoría." });
    } else {
      setE(estadoActualizacionEjemplo(categoria, datos.gruposSanidad));
    }
    return () => { cancel = true; };
  }, [categoria, grupoId, grupoActivo, datos]);
  if (e.tipo === "ok") {
    return (
      <p style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.inkSoft, marginTop: 8, paddingLeft: 2 }}>
        DATO OFICIAL · listado público SESCAM, orden por puntuación · {e.texto}
      </p>
    );
  }
  return (
    <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px", marginTop: 8 }}>
      <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
        <strong>{e.tipo === "sin_activar" ? "Sin scraping activo. " : e.tipo === "sin_datos" ? "Sin datos scrapeados. " : "Listado desactualizado. "}</strong>
        {e.texto}
      </p>
    </div>
  );
}

function AvisoLegal() {
  return (
    <div className="flex items-start gap-2 mx-5" style={{ marginTop: 18, padding: "10px 12px", background: C.paperDeep, borderRadius: "6px 14px 6px 14px" }}>
      <ShieldAlert size={13} color={C.inkSoft} style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkSoft, lineHeight: 1.4 }}>
        App no oficial, sin afiliación con el SESCAM ni la Junta de Comunidades de Castilla-La Mancha. Los datos proceden de listados públicos y se muestran solo con fines informativos.
      </p>
    </div>
  );
}

function Candado({ label }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full"
      style={{ background: C.paperDeep, color: C.inkSoft, padding: "3px 10px", fontSize: 11, fontFamily: FONT_BODY, fontWeight: 600 }}
    >
      <Lock size={11} /> {label}
    </span>
  );
}

function Barra({ titulo, atras }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-6 pb-4">
      {atras ? (
        <button onClick={atras} aria-label="Volver" className="rounded-full focus:outline-none" style={{ background: C.card, border: `1px solid ${C.line}`, padding: 8 }}>
          <ChevronLeft size={18} color={C.ink} />
        </button>
      ) : (
        <div className="rounded-full flex items-center justify-center" style={{ width: 34, height: 34, background: C.navy, color: C.goldSoft, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>
          L
        </div>
      )}
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600, color: C.navy }}>{titulo}</h1>
    </div>
  );
}

// ---------------------------------------------------------------
// PANTALLA 0 — inicio (hub)
// ---------------------------------------------------------------
function TarjetaSeguimientoResumen({ seguimiento, index, onAbrir, gruposSanidad }) {
  const datos = useDatos();
  const s = seguimiento;
  const r = s.candidato;
  const grupo = grupoDeCategoria(s.categoria, gruposSanidad);
  const e = grupo?.activo && datos.tieneDatosReales(s.categoria, grupo.id)
    ? { tipo: "ok", texto: "Datos reales disponibles." }
    : estadoActualizacionEjemplo(s.categoria, gruposSanidad);

  return (
    <button
      type="button"
      onClick={() => onAbrir(s)}
      className="text-left focus:outline-none focus:ring-2 w-full"
      style={{
        background: C.card,
        border: `1.5px solid ${C.line}`,
        borderRadius: index % 2 === 0 ? "16px 6px 16px 6px" : "6px 16px 6px 16px",
        padding: "16px 18px",
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy }}>
            {etiquetaLista(s.categoria, s.gerencia, s.ambito)}
          </p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>{r.nombreCompleto}</p>
        </div>
        {e.tipo !== "ok" && <AlertTriangle size={14} color={C.clay} />}
      </div>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, color: C.navy, marginTop: 4 }}>#{r.posicion}</p>
      <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft }}>{r.puntos.toFixed(2)} puntos · SESCAM</p>
    </button>
  );
}

function PantallaInicio({ onConsultar, onHerramienta, seguimientos, onAbrirSeguimiento, onVerSeguimientos, gruposSanidad }) {
  return (
    <div className="pb-4">
      <div className="px-5 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="rounded-full flex items-center justify-center flex-shrink-0"
            style={{ width: 44, height: 44, background: C.navy, color: C.goldSoft, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20 }}
          >
            L
          </div>
          <div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, color: C.navy, lineHeight: 1.1, margin: 0 }}>
              {NOMBRE_APP}
            </h1>
            <div style={{ marginTop: 8 }}>
              <Sello>Expediente oficial</Sello>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5">
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.inkSoft, marginBottom: 10 }}>
          Consulta tu posición
        </p>
        <button
          type="button"
          onClick={onConsultar}
          className="w-full font-bold focus:outline-none flex items-center justify-center gap-2"
          style={{
            background: C.navy,
            color: "#fff",
            padding: "18px 16px",
            fontFamily: FONT_BODY,
            fontSize: 16,
            borderRadius: "16px 5px 16px 5px",
            boxShadow: `0 4px 14px ${C.navy}44`,
          }}
        >
          <Search size={18} /> Buscar en la bolsa
        </button>

        <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.inkSoft, marginTop: 28, marginBottom: 12 }}>
          Herramientas
        </p>
        <div className="grid grid-cols-2 gap-3">
          {HERRAMIENTAS.map((h, i) => {
            const Icono = h.icono;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => h.activo && onHerramienta(h.id)}
                disabled={!h.activo}
                className="text-left focus:outline-none focus:ring-2 relative"
                style={{
                  background: C.card,
                  border: `1.5px solid ${h.activo ? C.navy : C.line}`,
                  borderRadius: i % 2 === 0 ? "16px 6px 16px 6px" : "6px 16px 6px 16px",
                  padding: "14px 12px",
                  opacity: h.activo ? 1 : 0.62,
                  cursor: h.activo ? "pointer" : "default",
                  minHeight: 118,
                }}
              >
                <div
                  className="rounded-lg flex items-center justify-center"
                  style={{
                    width: 40,
                    height: 40,
                    background: h.activo ? C.navy : C.paperDeep,
                    marginBottom: 10,
                  }}
                >
                  <Icono size={20} color={h.activo ? C.goldSoft : C.inkSoft} />
                </div>
                <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.navy, lineHeight: 1.25 }}>
                  {h.titulo}
                </p>
                <p style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkSoft, marginTop: 4, lineHeight: 1.35 }}>
                  {h.subtitulo}
                </p>
                {!h.activo && (
                  <span className="absolute top-2 right-2">
                    <Candado label="Pronto" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {seguimientos.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.inkSoft, margin: 0 }}>
                Mis seguimientos
              </p>
              {seguimientos.length > 2 && (
                <button
                  type="button"
                  onClick={onVerSeguimientos}
                  className="focus:outline-none"
                  style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: C.navy }}
                >
                  Ver todos
                </button>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {seguimientos.slice(0, 2).map((s, i) => (
                <TarjetaSeguimientoResumen
                  key={`${s.categoria}-${s.gerencia}-${s.ambito}-${s.candidato.nombreCompleto}`}
                  seguimiento={s}
                  index={i}
                  onAbrir={onAbrirSeguimiento}
                  gruposSanidad={gruposSanidad}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// PANTALLA 1 — elegir comunidad
// ---------------------------------------------------------------
function PantallaCCAA({ onSelect, atras }) {
  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 48px)", maxHeight: "100dvh" }}>
      {atras && <Barra titulo="Tu comunidad" atras={atras} />}
      <div className="px-4 pt-4 pb-0 flex-shrink-0">
        <Sello>Expediente nacional · 17 CC. AA.</Sello>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 600, color: C.navy, lineHeight: 1.2, marginTop: 8, marginBottom: 0 }}>
          Tu posición, sin adivinar<span style={{ color: C.clay }}>.</span>
        </h1>
      </div>

      <div className="flex-1 px-1 pb-4 pt-2" style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
        <MapaEspanaCCAA ccaaList={CCAA} onConfirm={onSelect} colors={C} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// PANTALLA 2 — elegir sector
// ---------------------------------------------------------------
function PantallaSector({ ccaa, onSelect, atras }) {
  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 48px)", maxHeight: "100dvh" }}>
      <Barra titulo={ccaa.nombre} atras={atras} />
      <div className="flex-1 px-3 pb-4" style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
        <SelectorSectores sectores={SECTORES} onConfirm={onSelect} colors={C} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// PANTALLA 3 — buscar posición
// ---------------------------------------------------------------
function PantallaBuscar({ atras, onBuscar, onVerListado, recientes, gruposSanidad }) {
  const datos = useDatos();
  const [grupoId, setGrupoId] = useState(gruposSanidad[0]?.id || "diplomado");
  const grupo = gruposSanidad.find((g) => g.id === grupoId);
  const [categoria, setCategoria] = useState(grupo?.categorias[0] || "");
  const [consulta, setConsulta] = useState("");
  const [sinResultados, setSinResultados] = useState(false);
  const [sinDatosCategoria, setSinDatosCategoria] = useState(false);
  const [gerenciaListado, setGerenciaListado] = useState(GERENCIAS_EJEMPLO[0]);

  const categoriaConDatos = grupo?.activo && datos.tieneDatosReales(categoria, grupoId);

  const cambiarGrupo = (id) => {
    const g = gruposSanidad.find((x) => x.id === id);
    setGrupoId(id);
    setCategoria(g?.categorias[0] || "");
    setSinResultados(false);
    setSinDatosCategoria(false);
  };

  useEffect(() => {
    if (!categoria) return;
    if (grupo?.activo) {
      datos.gerenciasDeCategoria(grupoId, categoria).then((gs) => {
        if (gs.length) setGerenciaListado(gs[0]);
      });
    } else {
      setGerenciaListado(GERENCIAS_EJEMPLO[0]);
    }
  }, [grupoId, categoria, grupo?.activo, datos]);

  const buscar = async (cat, q) => {
    setSinDatosCategoria(false);
    const res = await onBuscar(cat, q);
    if (res === -1) {
      setSinDatosCategoria(true);
      setSinResultados(false);
      return;
    }
    setSinResultados(res === 0);
  };

  return (
    <div>
      <Barra titulo="Sanidad · Bolsa SESCAM" atras={atras} />

      <div className="px-5 flex flex-col gap-5 mt-2">
        {recientes.length > 0 && (
          <div>
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, color: C.inkSoft, display: "flex", alignItems: "center", gap: 5 }}>
              <History size={13} /> Últimas búsquedas
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {recientes.map((rec, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const g = grupoDeCategoria(rec.categoria, gruposSanidad);
                    if (g) setGrupoId(g.id);
                    setCategoria(rec.categoria);
                    setConsulta(rec.consulta);
                    buscar(rec.categoria, rec.consulta);
                  }}
                  className="focus:outline-none"
                  style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, padding: "6px 12px", fontFamily: FONT_BODY, fontSize: 12, color: C.navy }}
                >
                  {rec.consulta} · {rec.categoria}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.ink }}>Grupo profesional</label>
          <select
            value={grupoId}
            onChange={(e) => cambiarGrupo(e.target.value)}
            className="w-full mt-2 focus:outline-none"
            style={{ border: `1.5px solid ${C.line}`, background: C.card, padding: "13px 14px", fontFamily: FONT_BODY, fontSize: 15, color: C.ink }}
          >
            {gruposSanidad.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}{g.activo ? "" : " · sin datos todavía"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.ink }}>Categoría</label>
          <select
            value={categoria}
            onChange={(e) => { setCategoria(e.target.value); setSinResultados(false); setSinDatosCategoria(false); }}
            className="w-full mt-2 focus:outline-none"
            style={{ border: `1.5px solid ${C.line}`, background: C.card, padding: "13px 14px", fontFamily: FONT_BODY, fontSize: 15, color: C.ink }}
          >
            {grupo.categorias.map((c) => (
              <option key={c} value={c}>
                {c}{datos.tieneDatosReales(c, grupoId) ? "" : " · sin datos"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.ink }}>Apellidos o DNI parcial</label>
          <input
            value={consulta}
            onChange={(e) => { setConsulta(e.target.value); setSinResultados(false); setSinDatosCategoria(false); }}
            placeholder="Apellidos, DNI parcial o ambos — ej. García 4208"
            className="w-full mt-2 focus:outline-none"
            style={{ border: `1.5px solid ${C.line}`, background: C.card, padding: "13px 14px", fontFamily: FONT_BODY, fontSize: 15, color: C.ink }}
          />
          <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, marginTop: 6 }}>
            Puedes buscar por apellidos, por los últimos dígitos del DNI (como los publica el SESCAM) o por una combinación de ambos. Buscamos en las {NUM_GERENCIAS} gerencias y en Atención Primaria y Especializada. No te pedimos ni guardamos tu DNI completo.
          </p>
        </div>

        {!categoriaConDatos && (
          <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
            <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
              {grupo?.activo
                ? "Esta categoría aún no tiene listado scrapeado. Elige otra del mismo grupo o vuelve más tarde."
                : "Este grupo profesional aún no tiene datos. Sin datos todavía."}
            </p>
          </div>
        )}

        <button
          onClick={() => buscar(categoria, consulta)}
          disabled={!categoriaConDatos || !consulta.trim()}
          className="w-full font-bold focus:outline-none flex items-center justify-center gap-2"
          style={{
            background: categoriaConDatos && consulta.trim() ? C.navy : C.paperDeep,
            color: categoriaConDatos && consulta.trim() ? "#fff" : C.inkSoft,
            padding: "15px",
            fontFamily: FONT_BODY,
            fontSize: 15,
            borderRadius: "16px 5px 16px 5px",
            cursor: categoriaConDatos && consulta.trim() ? "pointer" : "default",
          }}
        >
          <Search size={16} /> Buscar en la lista
        </button>

        {sinDatosCategoria && (
          <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
            <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
              No hay datos reales para buscar en esta categoría. No mostramos resultados inventados.
            </p>
          </div>
        )}

        {sinResultados && !sinDatosCategoria && (
          <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
            <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
              No encontramos coincidencias para «{consulta.trim()}» en ninguna gerencia de {categoria}. Comprueba cómo lo has escrito, o puede que aún no estés incluido en esta bolsa.
            </p>
          </div>
        )}

        <button
          onClick={() => onVerListado(categoria, gerenciaListado)}
          disabled={!categoriaConDatos}
          className="w-full font-bold focus:outline-none flex items-center justify-center gap-2"
          style={{
            background: "transparent",
            color: categoriaConDatos ? C.navy : C.inkSoft,
            padding: "12px",
            fontFamily: FONT_BODY,
            fontSize: 13.5,
            border: `1.5px solid ${C.line}`,
            borderRadius: "5px 16px 5px 16px",
            opacity: categoriaConDatos ? 1 : 0.6,
          }}
        >
          <ListIcon size={15} /> Ver el listado completo de esta categoría
        </button>

        <AvisoActualizacion categoria={categoria} grupoId={grupoId} grupoActivo={grupo?.activo} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// PANTALLA 3B — elegir tu nombre en la lista de coincidencias
// ---------------------------------------------------------------
function PantallaConfirmar({ categoria, candidatos, atras, onElegir }) {
  return (
    <div>
      <Barra titulo="¿Cuál eres tú?" atras={atras} />
      <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: C.inkSoft, padding: "0 20px 4px" }}>
        Encontramos {candidatos.length} personas que coinciden con tu búsqueda en las listas de {categoria}. Toca tu nombre — si dudas, el listado también muestra los últimos dígitos del DNI para confirmar.
      </p>

      <div className="px-5 mt-4 flex flex-col gap-3">
        {candidatos.map((c, i) => (
          <button
            key={c.dniParcial || `${c.nombreCompleto}-${i}`}
            onClick={() => onElegir(c)}
            className="text-left flex items-center gap-3 focus:outline-none focus:ring-2"
            style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: i % 2 === 0 ? "16px 6px 16px 6px" : "6px 16px 6px 16px", padding: "14px 16px" }}
          >
            <UserCheck size={18} color={C.navy} />
            <div>
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy }}>{c.nombreCompleto}</p>
              <p style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.inkSoft }}>
                En {c.apariciones.length} lista{c.apariciones.length > 1 ? "s" : ""} · mejor posición #{Math.min(...c.apariciones.map((a) => a.posicion))} · DNI {c.dniParcial}
              </p>
            </div>
          </button>
        ))}
      </div>

      <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, padding: "16px 20px 0" }}>
        Si no te encuentras, vuelve atrás y prueba con más apellidos, con los dígitos del DNI o con una combinación de ambos.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------
// PANTALLA 3C — listado completo de la categoría
// ---------------------------------------------------------------
function PantallaListado({ categoria, gerencia, ambito, grupoId, grupoActivo, atras }) {
  const datos = useDatos();
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [errorDatos, setErrorDatos] = useState(false);
  const LIMITE_FILAS = 100;
  const esReal = grupoActivo && datos.tieneDatosReales(categoria, grupoId);

  useEffect(() => {
    let cancel = false;
    setCargando(true);
    setErrorDatos(false);
    const cargar = async () => {
      if (esReal) {
        try {
          const f = await datos.obtenerListadoCompleto(grupoId, categoria, gerencia, ambito || "");
          if (!cancel) setFilas(f);
        } catch {
          if (!cancel) { setFilas([]); setErrorDatos(true); }
        }
      } else {
        if (!cancel) { setFilas([]); setErrorDatos(true); }
      }
      if (!cancel) setCargando(false);
    };
    cargar();
    return () => { cancel = true; };
  }, [datos, categoria, gerencia, ambito, grupoId, esReal]);

  const visibles = filtro ? filas.filter((f) => coincideBusqueda(f, filtro)) : filas;
  const mostradas = visibles.slice(0, LIMITE_FILAS);

  return (
    <div>
      <Barra titulo={etiquetaLista(categoria, gerencia, ambito)} atras={atras} />
      <div className="px-5">
        <AvisoActualizacion categoria={categoria} grupoId={grupoId} grupoActivo={grupoActivo} />

        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Apellidos, DNI parcial o ambos…"
          className="w-full mt-3 focus:outline-none"
          style={{ border: `1.5px solid ${C.line}`, background: C.card, padding: "11px 14px", fontFamily: FONT_BODY, fontSize: 13.5, color: C.ink }}
        />
        {cargando && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 8 }}>Cargando listado…</p>
        )}
        {!cargando && errorDatos && (
          <div className="flex items-start gap-2 mt-3" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
            <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
              No hay listado scrapeado para esta categoría. No mostramos datos inventados.
            </p>
          </div>
        )}
        <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, margin: "6px 0 4px" }}>
          Útil si un compañero opositor te ha dicho que está en esta lista y quieres ver en qué puesto queda.
        </p>

        <div className="mt-2" style={{ border: `1px solid ${C.line}`, borderRadius: "10px 3px 10px 3px", overflow: "hidden" }}>
          <div className="flex" style={{ background: C.navy, padding: "9px 14px" }}>
            <span style={{ flex: "0 0 40px", fontFamily: FONT_MONO, fontSize: 10.5, color: C.goldSoft }}>POS.</span>
            <span style={{ flex: 1, fontFamily: FONT_MONO, fontSize: 10.5, color: C.goldSoft }}>NOMBRE Y APELLIDOS</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.goldSoft }}>PUNTOS</span>
          </div>
          {mostradas.map((f, idx) => (
            <div key={`${f.pos}-${f.nombreCompleto}-${f.ambito || ""}-${idx}`} className="flex items-center" style={{ padding: "10px 14px", borderTop: `1px solid ${C.line}`, background: C.card }}>
              <span style={{ flex: "0 0 40px", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: C.navy }}>{f.pos}</span>
              <span style={{ flex: 1, fontFamily: FONT_BODY, fontSize: 13, color: C.ink }}>
                {f.nombreCompleto}
                {f.ambito && <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.inkSoft }}> · {f.ambito}</span>}
              </span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.inkSoft }}>{f.puntos.toFixed(2)}</span>
            </div>
          ))}
          {mostradas.length === 0 && (
            <p style={{ padding: 16, fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, background: C.card }}>Sin coincidencias con ese nombre.</p>
          )}
        </div>
        {!errorDatos && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, margin: "8px 0 16px" }}>
            {`Mostrando ${mostradas.length} de ${visibles.length} filas${visibles.length > LIMITE_FILAS ? ` (límite ${LIMITE_FILAS}; usa el buscador para acotar)` : ""}.`}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// PANTALLA 4 — resultado: una tarjeta por gerencia, deslizables
// ---------------------------------------------------------------

// Bloque de detalle de UNA lista (gerencia + ámbito): posición, puntos, contratos, corte y avisos
function TarjetaGerencia({ categoria, gerencia, ambito, grupoId, grupoActivo, r, guardado, onGuardar, onVerListado, onInfoLlamamientos }) {
  const datos = useDatos();
  const [notifEstado, setNotifEstado] = useState(guardado ? "activo" : "inicial");
  const percentil = Math.round((1 - r.posicion / r.total) * 100);
  const historial = grupoActivo && datos.tieneDatosReales(categoria, grupoId)
    ? datos.historialCorte(categoria, gerencia, ambito || r.ambito || "")
    : [];

  return (
    <div>
      <div
        style={{
          background: C.navy,
          backgroundImage: `radial-gradient(ellipse at 20% -10%, ${C.gold}22, transparent 55%), url("${GRAIN}")`,
          padding: "28px 22px 24px",
          position: "relative",
          overflow: "hidden",
          borderRadius: "26px 8px 26px 8px",
        }}
      >
        {/* sello de tinta, girado y con anillo doble irregular, como un matasellos real */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute", top: -22, right: -18, width: 110, height: 110,
            borderRadius: "48% 52% 51% 49% / 53% 47% 53% 47%",
            border: `1.5px solid ${C.gold}`, opacity: 0.35, transform: "rotate(9deg)",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute", top: -8, right: 4, width: 76, height: 76,
            borderRadius: "47% 53% 49% 51% / 51% 49% 53% 47%",
            border: `1px dashed ${C.gold}`, opacity: 0.4, transform: "rotate(-6deg)",
          }}
        />

        <Sello>{etiquetaLista(categoria, gerencia, ambito || r.ambito)}</Sello>
        <p
          style={{
            fontFamily: FONT_DISPLAY, fontSize: 60, fontWeight: 700, color: "#fff",
            lineHeight: 1, marginTop: 14, transform: "rotate(-1.2deg)", display: "inline-block",
          }}
        >
          #{r.posicion}
        </p>
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.goldSoft, marginTop: 8 }}>
          de {r.total.toLocaleString("es-ES")} personas en la bolsa · por delante del {percentil}%
        </p>
      </div>
      <AvisoActualizacion categoria={categoria} grupoId={grupoId} grupoActivo={grupoActivo} />

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: "18px 6px 18px 6px", padding: 16 }}>
          <Users size={16} color={C.navy} />
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: C.navy, marginTop: 6 }}>{r.delante}</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft }}>personas por delante</p>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: "6px 18px 6px 18px", padding: 16 }}>
          <TrendingUp size={16} color={C.ok} />
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: C.navy, marginTop: 6 }}>{r.puntos.toFixed(1)}</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft }}>puntos de baremo</p>
        </div>
      </div>

      {r.tiposContrato && (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: "18px 6px 18px 6px", padding: 16, marginTop: 12 }}>
          <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.ink }}>Disponible para</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(r.tiposContrato).map(([tipo, activo]) => (
              <span
                key={tipo}
                style={{
                  fontFamily: FONT_MONO, fontSize: 11, padding: "4px 10px", borderRadius: 20,
                  background: activo ? C.okBg : C.paperDeep,
                  color: activo ? C.ok : C.inkSoft,
                  fontWeight: activo ? 700 : 400,
                  textDecoration: activo ? "none" : "line-through",
                }}
              >
                {tipo}
              </span>
            ))}
          </div>
          <p style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkSoft, marginTop: 8 }}>
            TC = Tiempo Completo · TP = Tiempo Parcial · C.U. = Cobertura Urgente
          </p>
        </div>
      )}

      {(() => {
        if (historial.length === 0) {
          return (
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: "8px 18px 8px 18px", padding: 16, marginTop: 12 }}>
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.ink }}>Distancia al punto de corte admitido</p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 8, lineHeight: 1.45 }}>
                Aún no hay histórico guardado para esta lista ({etiquetaLista(categoria, gerencia, ambito || r.ambito)}). Se irá acumulando con cada actualización del scraper.
              </p>
            </div>
          );
        }
        const hayTendencia = historial.length >= MIN_HISTORICO_TENDENCIA;
        const ult = historial[historial.length - 1];
        const diff = (r.puntos - ult.puntos).toFixed(2);
        const yaLlamado = r.puntos >= ult.puntos;
        const riesgo = zonaRiesgo(r.puntos, historial);
        const rango = Math.max(Math.abs(diff) * 2, 1);
        const pct = Math.min(100, Math.max(0, 50 + (diff / rango) * 50));
        const RIESGO_TXT = {
          llamado: { color: C.ok, texto: "Tu puntuación ya supera el punto de corte. Mantente localizable." },
          alto: { color: C.clay, texto: `Zona de riesgo: al ritmo actual, podrías entrar en juego en ${riesgo.convocatorias} convocatoria${riesgo.convocatorias > 1 ? "s" : ""}.` },
          medio: { color: C.gold, texto: `A este ritmo, calculamos unas ${riesgo.convocatorias} convocatorias para llegar al corte.` },
          bajo: { color: C.inkSoft, texto: "El corte se mueve despacio en esta categoría. Todavía queda camino." },
          sin_historico: { color: C.inkSoft, texto: null }, // se trata aparte, abajo
        };
        const info = RIESGO_TXT[riesgo.nivel];
        return (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: "8px 18px 8px 18px", padding: 16, marginTop: 12 }}>
            <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.ink }}>Distancia al punto mínimo admitido</p>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
              DATO OFICIAL · punto mínimo admitido conocido: {ult.puntos.toFixed(2)} puntos ({ult.fecha})
            </p>
            <div style={{ height: 8, background: C.paperDeep, borderRadius: 6, marginTop: 12, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: yaLlamado ? C.ok : C.clay, borderRadius: 6 }} />
            </div>
            <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: yaLlamado ? C.ok : C.clay, fontWeight: 700, marginTop: 10 }}>
              {yaLlamado
                ? `Tu puntuación ya supera el punto mínimo admitido por ${Math.abs(diff)} puntos.`
                : `Te faltan ${Math.abs(diff)} puntos para alcanzar el punto mínimo admitido.`}
            </p>

            {hayTendencia ? (
              <>
                <Suspense fallback={<div style={{ height: 52, marginTop: 14 }} />}>
                  <GraficoHistoricoCorte historial={historial} colors={C} />
                </Suspense>
                <p style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.inkSoft, marginTop: 2 }}>
                  Punto de corte por convocatoria, últimas {historial.length} publicaciones
                </p>
                {info.texto && (
                  <div className="flex items-start gap-2" style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
                    <TrendingUp size={14} color={info.color} style={{ flexShrink: 0, marginTop: 2 }} />
                    <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: info.color, lineHeight: 1.4, fontWeight: 600 }}>{info.texto}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-start gap-2" style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                <Info size={14} color={C.inkSoft} style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, lineHeight: 1.45 }}>
                  <strong style={{ color: C.ink }}>Tendencia aún no disponible.</strong> Solo tenemos {historial.length === 1 ? "una publicación" : `${historial.length} publicaciones`} del corte guardada{historial.length === 1 ? "" : "s"} para esta lista. Estamos acumulando histórico con cada actualización del SESCAM: la evolución del corte y la estimación de convocatorias aparecerán aquí solas en unas semanas. Antes que inventar una tendencia con un dato, preferimos no enseñarla.
                </p>
              </div>
            )}
          </div>
        );
      })()}

      <div className="flex items-start gap-2" style={{ background: C.paperDeep, borderRadius: "8px 18px 8px 18px", padding: 14, marginTop: 12 }}>
        <Smartphone size={15} color={C.inkSoft} style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.4 }}>
          <strong style={{ color: C.ink }}>Revisa tus datos en Selecta.</strong> Muchos llamamientos se pierden por un teléfono o email desactualizado, no por la posición en la bolsa.
        </p>
      </div>

      {notifEstado === "inicial" && (
        <button
          onClick={() => setNotifEstado("pidiendo")}
          className="w-full font-bold focus:outline-none flex items-center justify-center gap-2 mt-4"
          style={{ background: C.gold, color: "#fff", padding: "14px", fontFamily: FONT_BODY, fontSize: 14, borderRadius: "16px 5px 16px 5px" }}
        >
          <Bell size={16} /> Seguir esta lista y activar avisos
        </button>
      )}

      {notifEstado === "pidiendo" && (
        <div style={{ background: C.card, border: `1.5px solid ${C.navy}`, borderRadius: "10px 20px 10px 20px", padding: 16, marginTop: 16 }}>
          <div className="flex items-center gap-3">
            <Smartphone size={20} color={C.navy} />
            <div>
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy }}>Permitir notificaciones</p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                Te avisaremos cuando cambie tu posición en {etiquetaLista(categoria, gerencia, ambito || r.ambito)}. <strong style={{ color: C.clay }}>Esto no sustituye la llamada oficial del SESCAM</strong> — esa te la hacen ellos directamente, y tienes horas contadas para responder.
              </p>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setNotifEstado("inicial")}
              className="flex-1 font-bold focus:outline-none"
              style={{ background: "transparent", color: C.inkSoft, padding: "10px", fontFamily: FONT_BODY, fontSize: 13, border: `1px solid ${C.line}`, borderRadius: 10 }}
            >
              Ahora no
            </button>
            <button
              onClick={() => { setNotifEstado("activo"); onGuardar(); }}
              className="flex-1 font-bold focus:outline-none"
              style={{ background: C.navy, color: "#fff", padding: "10px", fontFamily: FONT_BODY, fontSize: 13, borderRadius: 10 }}
            >
              Permitir
            </button>
          </div>
        </div>
      )}

      {notifEstado === "activo" && (
        <div className="flex items-center gap-2 justify-center mt-4" style={{ background: C.paperDeep, borderRadius: "16px 5px 16px 5px", padding: "13px" }}>
          <BellRing size={16} color={C.ok} />
          <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5, color: C.ok }}>Siguiendo {etiquetaLista(categoria, gerencia, ambito || r.ambito)} — te avisaremos</p>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          onClick={onVerListado}
          className="flex-1 font-bold focus:outline-none flex items-center justify-center gap-2"
          style={{ background: "transparent", color: C.navy, padding: "11px", fontFamily: FONT_BODY, fontSize: 12.5, border: `1.5px solid ${C.line}`, borderRadius: "5px 14px 5px 14px" }}
        >
          <ListIcon size={14} /> Ver listado
        </button>
        <button
          onClick={onInfoLlamamientos}
          className="flex-1 font-bold focus:outline-none flex items-center justify-center gap-2"
          style={{ background: "transparent", color: C.navy, padding: "11px", fontFamily: FONT_BODY, fontSize: 12.5, border: `1.5px solid ${C.line}`, borderRadius: "14px 5px 14px 5px" }}
        >
          <Info size={14} /> Cómo llaman
        </button>
      </div>
    </div>
  );
}

// Contenedor: una tarjeta por lista (gerencia + ámbito) donde aparece la persona.
// Pestañas + carrusel con peek lateral, flechas y puntos clicables.
function PantallaResultado({ categoria, grupoId, grupoActivo, candidato, atras, estaGuardado, onGuardar, onVerListado, onInfoLlamamientos }) {
  const apariciones = candidato.apariciones;
  const [indice, setIndice] = useState(0);
  const carruselRef = useRef(null);
  const tabsRef = useRef(null);
  const varias = apariciones.length > 1;

  useEffect(() => {
    setIndice(0);
    requestAnimationFrame(() => {
      carruselRef.current?.scrollTo({ left: 0, behavior: "instant" });
    });
  }, [candidato?.dniParcial, candidato?.nombreCompleto]);

  useEffect(() => {
    if (!varias || !tabsRef.current) return;
    const btn = tabsRef.current.children[indice];
    btn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [indice, varias]);

  const pasoSlide = useCallback(() => {
    const el = carruselRef.current;
    if (!el?.firstElementChild) return el?.clientWidth ?? 0;
    const slide = el.firstElementChild;
    const gap = parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap || "0") || 12;
    return slide.offsetWidth + gap;
  }, []);

  const irAIndice = useCallback((i) => {
    const el = carruselRef.current;
    if (!el) return;
    const next = Math.min(apariciones.length - 1, Math.max(0, i));
    setIndice(next);
    el.scrollTo({ left: next * pasoSlide(), behavior: "smooth" });
  }, [apariciones.length, pasoSlide]);

  const alDesplazar = () => {
    const el = carruselRef.current;
    if (!el) return;
    const step = pasoSlide();
    if (!step) return;
    const i = Math.round(el.scrollLeft / step);
    const clamped = Math.min(apariciones.length - 1, Math.max(0, i));
    if (clamped !== indice) setIndice(clamped);
  };

  return (
    <div>
      <Barra titulo="Resultado" atras={atras} />

      <div className="px-5">
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft }}>
          Mostrando a <strong style={{ color: C.navy }}>{candidato.nombreCompleto}</strong>
          {candidato.dniParcial && <span style={{ fontFamily: FONT_MONO, fontSize: 11.5 }}> · DNI {candidato.dniParcial}</span>}
        </p>
        {varias && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.clay, fontWeight: 600, marginTop: 4 }}>
            Apareces en {apariciones.length} listas — desliza o usa las pestañas para ver cada gerencia.
          </p>
        )}
      </div>

      {varias && (
        <div
          ref={tabsRef}
          className="carrusel-gerencias-tabs"
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            padding: "12px 20px 4px",
            scrollSnapType: "x proximity",
          }}
        >
          {apariciones.map((a, i) => {
            const activa = i === indice;
            return (
              <button
                key={`tab-${a.gerencia}-${a.ambito || ""}`}
                type="button"
                onClick={() => irAIndice(i)}
                className="flex-shrink-0 focus:outline-none focus:ring-2"
                style={{
                  padding: "8px 14px",
                  borderRadius: "12px 4px 12px 4px",
                  border: activa ? `2px solid ${C.navy}` : `1.5px solid ${C.line}`,
                  background: activa ? C.navy : C.card,
                  color: activa ? "#fff" : C.ink,
                  fontFamily: FONT_BODY,
                  fontSize: 12.5,
                  fontWeight: activa ? 700 : 500,
                  transition: "background .2s ease, border-color .2s ease, transform .15s ease",
                  transform: activa ? "scale(1.02)" : "scale(1)",
                  boxShadow: activa ? "0 4px 14px rgba(26,39,68,0.18)" : "none",
                }}
              >
                <span style={{ display: "block", lineHeight: 1.3 }}>{a.gerencia}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10, opacity: activa ? 0.85 : 0.65 }}>
                  {etiquetaAmbitoAparicion(a) || "—"} · #{a.posicion}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="relative" style={{ marginTop: varias ? 8 : 12 }}>
        {varias && (
          <>
            <button
              type="button"
              aria-label="Lista anterior"
              disabled={indice === 0}
              onClick={() => irAIndice(indice - 1)}
              className="absolute left-1 top-1/2 z-10 -translate-y-1/2 focus:outline-none focus:ring-2"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: `1.5px solid ${C.line}`,
                background: indice === 0 ? "rgba(255,255,255,0.5)" : C.card,
                opacity: indice === 0 ? 0.4 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                cursor: indice === 0 ? "default" : "pointer",
              }}
            >
              <ChevronLeft size={20} color={C.navy} />
            </button>
            <button
              type="button"
              aria-label="Lista siguiente"
              disabled={indice === apariciones.length - 1}
              onClick={() => irAIndice(indice + 1)}
              className="absolute right-1 top-1/2 z-10 -translate-y-1/2 focus:outline-none focus:ring-2"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: `1.5px solid ${C.line}`,
                background: indice === apariciones.length - 1 ? "rgba(255,255,255,0.5)" : C.card,
                opacity: indice === apariciones.length - 1 ? 0.4 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                cursor: indice === apariciones.length - 1 ? "default" : "pointer",
              }}
            >
              <ChevronRight size={20} color={C.navy} />
            </button>
          </>
        )}

        <div
          ref={carruselRef}
          onScroll={varias ? alDesplazar : undefined}
          className="carrusel-gerencias"
          style={{
            display: "flex",
            overflowX: varias ? "auto" : "visible",
            scrollSnapType: varias ? "x mandatory" : "none",
            gap: varias ? 12 : 0,
            padding: varias ? "4px 44px 8px" : "0 20px",
            scrollPaddingLeft: varias ? 44 : 20,
            scrollPaddingRight: varias ? 44 : 20,
          }}
        >
          {apariciones.map((a, i) => {
            const activa = !varias || i === indice;
            return (
              <div
                key={`${a.gerencia}-${a.ambito || ""}`}
                className="carrusel-gerencias-slide"
                style={{
                  flex: varias ? "0 0 calc(100% - 88px)" : "0 0 100%",
                  scrollSnapAlign: "center",
                  boxSizing: "border-box",
                  opacity: activa ? 1 : 0.72,
                  transform: activa ? "scale(1)" : "scale(0.97)",
                  transition: "opacity .25s ease, transform .25s ease",
                  filter: activa ? "none" : "saturate(0.92)",
                }}
              >
                <TarjetaGerencia
                  categoria={categoria}
                  gerencia={a.gerencia}
                  ambito={a.ambito}
                  grupoId={grupoId}
                  grupoActivo={grupoActivo}
                  r={a}
                  guardado={estaGuardado(a.gerencia, a.ambito, candidato.nombreCompleto)}
                  onGuardar={() => onGuardar(a.gerencia, a.ambito, { ...a, nombreCompleto: candidato.nombreCompleto, dniParcial: candidato.dniParcial })}
                  onVerListado={() => onVerListado(a.gerencia, a.ambito)}
                  onInfoLlamamientos={onInfoLlamamientos}
                />
              </div>
            );
          })}
        </div>
      </div>

      {varias && (
        <div className="flex flex-col items-center gap-2" style={{ marginTop: 10, paddingBottom: 8 }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, margin: 0 }}>
            {indice + 1} de {apariciones.length} · {etiquetaLista(categoria, apariciones[indice].gerencia, apariciones[indice].ambito, apariciones[indice])}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              aria-label="Lista anterior"
              disabled={indice === 0}
              onClick={() => irAIndice(indice - 1)}
              className="focus:outline-none focus:ring-2"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: `1.5px solid ${C.line}`,
                background: indice === 0 ? C.paperDeep : C.card,
                opacity: indice === 0 ? 0.4 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: indice === 0 ? "default" : "pointer",
              }}
            >
              <ChevronLeft size={18} color={C.navy} />
            </button>
            <div className="flex items-center justify-center gap-2">
            {apariciones.map((a, i) => (
              <button
                key={`dot-${a.gerencia}-${a.ambito || ""}`}
                type="button"
                aria-label={etiquetaLista(categoria, a.gerencia, a.ambito, a)}
                onClick={() => irAIndice(i)}
                className="focus:outline-none focus:ring-2"
                style={{
                  width: i === indice ? 22 : 7,
                  height: 7,
                  borderRadius: 6,
                  border: "none",
                  padding: 0,
                  background: i === indice ? C.navy : C.line,
                  transition: "width .2s ease, background .2s ease",
                  cursor: "pointer",
                }}
              />
            ))}
            </div>
            <button
              type="button"
              aria-label="Lista siguiente"
              disabled={indice === apariciones.length - 1}
              onClick={() => irAIndice(indice + 1)}
              className="focus:outline-none focus:ring-2"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: `1.5px solid ${C.line}`,
                background: indice === apariciones.length - 1 ? C.paperDeep : C.card,
                opacity: indice === apariciones.length - 1 ? 0.4 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: indice === apariciones.length - 1 ? "default" : "pointer",
              }}
            >
              <ChevronRight size={18} color={C.navy} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
// ---------------------------------------------------------------
// PANTALLA — Mis seguimientos (varias listas a la vez)
// ---------------------------------------------------------------
function PantallaSeguimientos({ seguimientos, atras, onAbrir, gruposSanidad }) {
  const datos = useDatos();
  return (
    <div>
      <Barra titulo="Mis seguimientos" atras={atras} />
      <div className="px-5">
        {seguimientos.length === 0 && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: C.inkSoft }}>
            Todavía no guardas ninguna lista. Puedes seguir varias a la vez — por ejemplo, la general de Enfermería y la de Salud Mental.
          </p>
        )}
        <div className="flex flex-col gap-3 mt-2">
          {seguimientos.map((s, i) => {
            const r = s.candidato;
            const grupo = grupoDeCategoria(s.categoria, gruposSanidad);
            const e = grupo?.activo && datos.tieneDatosReales(s.categoria, grupo.id)
              ? { tipo: "ok", texto: "Datos reales disponibles." }
              : grupo?.activo
                ? { tipo: "sin_datos", texto: "Sin listado scrapeado para esta categoría." }
                : estadoActualizacionEjemplo(s.categoria, gruposSanidad);
            return (
              <button
                key={i}
                onClick={() => onAbrir(s)}
                className="text-left focus:outline-none focus:ring-2"
                style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: i % 2 === 0 ? "16px 6px 16px 6px" : "6px 16px 6px 16px", padding: "16px 18px" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy }}>{etiquetaLista(s.categoria, s.gerencia, s.ambito)}</p>
                    <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>{r.nombreCompleto}</p>
                  </div>
                  {e.tipo !== "ok" && <AlertTriangle size={14} color={C.clay} />}
                </div>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, color: C.navy, marginTop: 4 }}>#{r.posicion}</p>
                <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft }}>{r.puntos.toFixed(2)} puntos · SESCAM</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// PANTALLA — referencia rápida: cómo funcionan los llamamientos
// ---------------------------------------------------------------
function PantallaInfoLlamamientos({ atras }) {
  const Bloque = ({ icono: Icono, titulo, children }) => (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: "10px 20px 10px 20px", padding: 16, marginTop: 12 }}>
      <div className="flex items-center gap-2">
        <Icono size={16} color={C.navy} />
        <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy }}>{titulo}</p>
      </div>
      <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.ink, lineHeight: 1.5, marginTop: 8 }}>{children}</p>
    </div>
  );

  return (
    <div>
      <Barra titulo="Cómo funcionan los llamamientos" atras={atras} />
      <div className="px-5">
        <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
          <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
            Esto es un resumen simplificado del Pacto de Selección de Personal Temporal del SESCAM. Ante cualquier duda real, el pacto oficial manda, no esta app.
          </p>
        </div>

        <Bloque icono={PhoneCall} titulo="Nombramientos de larga duración">
          Te contactan por el medio que elegiste al inscribirte: llamada, SMS o email. Tienes <strong>24 horas</strong> para responder. Si no contestas en ese plazo, se entiende como renuncia y llaman a la siguiente persona de la lista.
        </Bloque>

        <Bloque icono={PhoneCall} titulo="Nombramientos de corta duración">
          Te llaman por teléfono. Si no respondes, hacen una <strong>segunda llamada media hora después</strong>. Si tampoco contestas esa, pasan a la siguiente persona.
        </Bloque>

        <Bloque icono={AlertTriangle} titulo="Qué pasa si no contestas o rechazas">
          Puede penalizarte con un periodo sin recibir ofertas de la misma categoría, gerencia y tipo de lista — desde varios meses hasta 18 meses si se repite. No es automático ni siempre igual: depende del tipo de oferta y de si es la primera vez.
        </Bloque>

        <Bloque icono={Smartphone} titulo="Lo que sí puedes controlar tú">
          Mantén actualizado tu teléfono, email y disponibilidad en Selecta. Muchas quejas de interinos son justamente por no haber sido localizados a tiempo con datos desactualizados, no por su posición en la bolsa.
        </Bloque>

        <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, margin: "16px 0" }}>
          ¿Dudas concretas sobre tu situación? Llama al teléfono gratuito de la bolsa: <strong style={{ color: C.ink }}>900 25 25 25</strong> (8:00–15:00h).
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// APP RAÍZ
// ---------------------------------------------------------------
export default function ListasApp() {
  const datos = useDatos();
  const gruposSanidad = datos.gruposSanidad?.length ? datos.gruposSanidad : GRUPOS_SANIDAD_FALLBACK;
  const [paso, setPaso] = useState("inicio");
  const [pasoSeguimientosOrigen, setPasoSeguimientosOrigen] = useState("inicio");
  const [ccaa, setCcaa] = useState(null);
  const [sector, setSector] = useState(null);
  const [categoriaActual, setCategoriaActual] = useState("");
  const [grupoIdActual, setGrupoIdActual] = useState("diplomado");
  const [candidatos, setCandidatos] = useState([]);
  const [candidatoElegido, setCandidatoElegido] = useState(null);
  const [seguimientos, setSeguimientos] = useState([]);
  const [recientes, setRecientes] = useState([]);
  const [listadoCategoria, setListadoCategoria] = useState(gruposSanidad[0]?.categorias[0] || "");
  const [listadoGerencia, setListadoGerencia] = useState(GERENCIAS_EJEMPLO[0]);
  const [listadoAmbito, setListadoAmbito] = useState("");
  const [listadoGrupoId, setListadoGrupoId] = useState("diplomado");
  const [pantallaPrevia, setPantallaPrevia] = useState("buscar");
  const [herramientasCtx, setHerramientasCtx] = useState({ puntos: null, categoria: "" });

  useEffect(() => {
    setSeguimientos(leerStorage(LS_SEGUIMIENTOS, []));
    setRecientes(leerStorage(LS_RECIENTES, []));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_SEGUIMIENTOS, JSON.stringify(seguimientos));
    } catch { /* quota / modo privado */ }
  }, [seguimientos]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_RECIENTES, JSON.stringify(recientes));
    } catch { /* quota / modo privado */ }
  }, [recientes]);

  const irSimuladorGerencia = (puntos, categoria = herramientasCtx.categoria || categoriaActual) => {
    setHerramientasCtx({ puntos, categoria: categoria || "" });
    setPaso("simulador-gerencia");
  };

  const iniciarBusqueda = async (categoria, consulta) => {
    const grupo = grupoDeCategoria(categoria, gruposSanidad);
    setCategoriaActual(categoria);
    setGrupoIdActual(grupo?.id || "diplomado");
    if (!grupo?.activo || !datos.tieneDatosReales(categoria, grupo.id)) {
      return -1;
    }
    const res = await datos.buscarPersonas(grupo.id, categoria, consulta);
    const personas = res.personas;
    if (consulta.trim()) {
      setRecientes((prev) => {
        const sinDuplicado = prev.filter((r) => !(r.categoria === categoria && r.consulta === consulta));
        return [{ categoria, consulta }, ...sinDuplicado].slice(0, 4);
      });
    }
    if (personas.length === 0) return 0;
    if (personas.length > 1) {
      setCandidatos(personas);
      setPaso("confirmar");
    } else {
      setCandidatoElegido(personas[0]);
      setPaso("resultado");
    }
    return personas.length;
  };

  const estaGuardado = (gerencia, ambito, nombreCompleto) =>
    seguimientos.some((s) => s.categoria === categoriaActual && s.gerencia === gerencia && s.ambito === (ambito || "") && s.candidato.nombreCompleto === nombreCompleto);

  const guardarSeguimiento = (gerencia, ambito, resultado) => {
    setSeguimientos((prev) => {
      if (prev.some((s) => s.categoria === categoriaActual && s.gerencia === gerencia && s.ambito === (ambito || "") && s.candidato.nombreCompleto === resultado.nombreCompleto)) return prev;
      return [...prev, { categoria: categoriaActual, gerencia, ambito: ambito || "", candidato: resultado }];
    });
  };

  const abrirSeguimiento = (s) => {
    setCategoriaActual(s.categoria);
    setGrupoIdActual(grupoDeCategoria(s.categoria, gruposSanidad)?.id || "diplomado");
    setCandidatoElegido({
      nombreCompleto: s.candidato.nombreCompleto,
      dniParcial: s.candidato.dniParcial,
      apariciones: [{ gerencia: s.gerencia, ambito: s.ambito, ...s.candidato }],
    });
    setPaso("resultado");
  };

  return (
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

      <div className="max-w-md mx-auto pb-10">
        {paso !== "inicio" && paso !== "ccaa" && seguimientos.length > 0 && (
          <div className="flex justify-end px-5 pt-4">
            <button
              onClick={() => { setPasoSeguimientosOrigen(paso); setPaso("seguimientos"); }}
              className="flex items-center gap-1.5 focus:outline-none"
              style={{ background: C.navy, color: "#fff", padding: "7px 13px", borderRadius: "12px 4px 12px 4px", fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700 }}
            >
              <BellRing size={13} /> {seguimientos.length}
            </button>
          </div>
        )}

        {paso === "inicio" && (
          <PantallaInicio
            onConsultar={() => setPaso("ccaa")}
            onHerramienta={(id) => setPaso(id)}
            seguimientos={seguimientos}
            onAbrirSeguimiento={abrirSeguimiento}
            onVerSeguimientos={() => { setPasoSeguimientosOrigen("inicio"); setPaso("seguimientos"); }}
            gruposSanidad={gruposSanidad}
          />
        )}

        {paso === "ccaa" && (
          <PantallaCCAA
            onSelect={(c) => { setCcaa(c); setPaso("sector"); }}
            atras={() => setPaso("inicio")}
          />
        )}

        {paso === "sector" && (
          <PantallaSector ccaa={ccaa} atras={() => setPaso("ccaa")} onSelect={(s) => { setSector(s); setPaso("buscar"); }} />
        )}

        {paso === "buscar" && (
          <PantallaBuscar
            atras={() => setPaso("sector")}
            onBuscar={iniciarBusqueda}
            onVerListado={(categoria, gerencia) => {
              const g = grupoDeCategoria(categoria, gruposSanidad);
              setListadoCategoria(categoria);
              setListadoGerencia(gerencia);
              setListadoAmbito("");
              setListadoGrupoId(g?.id || "diplomado");
              setPantallaPrevia("buscar");
              setPaso("listado");
            }}
            recientes={recientes}
            gruposSanidad={gruposSanidad}
          />
        )}

        {paso === "confirmar" && (
          <PantallaConfirmar
            categoria={categoriaActual}
            candidatos={candidatos}
            atras={() => setPaso("buscar")}
            onElegir={(persona) => { setCandidatoElegido(persona); setPaso("resultado"); }}
          />
        )}

        {paso === "resultado" && candidatoElegido && (
          <PantallaResultado
            categoria={categoriaActual}
            grupoId={grupoIdActual}
            grupoActivo={grupoDeCategoria(categoriaActual, gruposSanidad)?.activo}
            candidato={candidatoElegido}
            atras={() => setPaso("buscar")}
            estaGuardado={(gerencia, ambito, nombre) => estaGuardado(gerencia, ambito, nombre)}
            onGuardar={guardarSeguimiento}
            onVerListado={(gerencia, ambito) => {
              setListadoCategoria(categoriaActual);
              setListadoGerencia(gerencia);
              setListadoAmbito(ambito || "");
              setListadoGrupoId(grupoIdActual);
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
            grupoActivo={grupoDeCategoria(listadoCategoria, gruposSanidad)?.activo}
            atras={() => setPaso(pantallaPrevia)}
          />
        )}

        {paso === "seguimientos" && (
          <PantallaSeguimientos
            seguimientos={seguimientos}
            atras={() => setPaso(pasoSeguimientosOrigen)}
            gruposSanidad={gruposSanidad}
            onAbrir={abrirSeguimiento}
          />
        )}

        {paso === "simulador-baremo" && (
          <Suspense fallback={<CargandoHerramienta />}>
            <SimuladorBaremo
              C={C}
              Barra={Barra}
              atras={() => setPaso("inicio")}
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
              atras={() => setPaso("inicio")}
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
              atras={() => setPaso("inicio")}
            />
          </Suspense>
        )}

        {paso === "calculadora-nomina" && (
          <Suspense fallback={<CargandoHerramienta />}>
            <CalculadoraNomina C={C} Barra={Barra} atras={() => setPaso("inicio")} />
          </Suspense>
        )}

        {paso === "guia-llamamiento" && (
          <Suspense fallback={<CargandoHerramienta />}>
            <GuiaLlamamiento C={C} Barra={Barra} atras={() => setPaso("inicio")} />
          </Suspense>
        )}

        {paso === "calculadora-meritos" && (
          <Suspense fallback={<CargandoHerramienta />}>
            <CalculadoraMeritos
              C={C}
              Barra={Barra}
              puntosIniciales={herramientasCtx.puntos ?? candidatoElegido?.apariciones?.[0]?.puntos}
              atras={() => setPaso("inicio")}
              onIrGerencia={(puntos) => irSimuladorGerencia(puntos)}
            />
          </Suspense>
        )}

        <AvisoLegal />
      </div>
    </div>
  );
}
