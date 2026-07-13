import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { Search, ChevronLeft, ChevronRight, Bell, BellRing, Lock, Stethoscope, GraduationCap, Landmark, TrendingUp, Users, AlertTriangle, List as ListIcon, UserCheck, Smartphone, History, ShieldAlert, Info, PhoneCall, Calculator, ArrowLeftRight, Map as MapIcon, Banknote, Award, Pin, Settings } from "lucide-react";
import { useDatos, useCapaDatos, CcaaCapaProvider, ambitoLegible, coincideBusqueda } from "./src/datos.jsx";
import { CCAA_LIST, sectoresParaCcaas, organismoCcaa } from "./src/regiones.js";
import { PROVINCIAS_CLM, tipoBolsaLegible, GERENCIA_EDUCACION, esBolsaOrdinaria, MODOS_LISTADO_EDUCACION } from "./src/educacion.js";
import MapaEspanaCCAA from "./src/MapaEspanaCCAA.jsx";
import LogoInterino from "./src/components/LogoInterino.jsx";
import OverlayBienvenida from "./src/components/OverlayBienvenida.jsx";
import PantallaPoliticaPrivacidad from "./src/components/PantallaPoliticaPrivacidad.jsx";

const SimuladorBaremo = lazy(() => import("./src/herramientas/SimuladorBaremo.jsx"));
const SimuladorGerencia = lazy(() => import("./src/herramientas/SimuladorGerencia.jsx"));
const MapaOportunidades = lazy(() => import("./src/herramientas/MapaOportunidades.jsx"));
const CalculadoraNomina = lazy(() => import("./src/herramientas/CalculadoraNomina.jsx"));
const GuiaLlamamiento = lazy(() => import("./src/herramientas/GuiaLlamamiento.jsx"));
const CalculadoraMeritos = lazy(() => import("./src/herramientas/CalculadoraMeritos.jsx"));
const GraficoHistoricoCorte = lazy(() => import("./src/components/GraficoHistoricoCorte.jsx"));

const LS_SEGUIMIENTOS = "interino_seguimientos_v1";
const LS_RECIENTES = "interino_recientes_v1";
const LS_LAST_CCAA = "interino_last_ccaa_v1";
const LS_BIENVENIDA = "interino_bienvenida_v1";

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

function bienvenidaVista() {
  try {
    return localStorage.getItem(LS_BIENVENIDA) === "1";
  } catch {
    return false;
  }
}

function marcarBienvenidaVista() {
  try {
    localStorage.setItem(LS_BIENVENIDA, "1");
  } catch { /* quota / modo privado */ }
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
// DATOS DE EJEMPLO — herramientas del hub usan CLM por defecto
// ---------------------------------------------------------------
const ICONOS_SECTOR = {
  sanidad: Stethoscope,
  educacion: GraduationCap,
  administracion: Landmark,
};

const TEXTO_AYUDA_BUSQUEDA_BASE = {
  mur: "Puedes buscar por apellidos, por los últimos dígitos del DNI (como los publica el SMS) o por una combinación de ambos. No te pedimos ni guardamos tu DNI completo.",
  mad: "Puedes buscar por apellidos o DNI parcial (como los publica el SERMAS). Los listados de Madrid aún no están scrapeados en esta app.",
  multi: "Puedes buscar por apellidos o DNI parcial en todas tus comunidades seleccionadas, o elegir grupo y categoría concretos por región. No te pedimos ni guardamos tu DNI completo.",
};

const LS_EDUCACION_LISTADO = "interino-educacion-listado";

function leerModoListadoEducacion(datos) {
  try {
    const guardado = localStorage.getItem(LS_EDUCACION_LISTADO);
    if (guardado === "bolsa" && datos.educacionBolsaActiva) return "bolsa";
    if (guardado === "disponibles" && datos.educacionDisponiblesActiva) return "disponibles";
  } catch { /* quota / modo privado */ }
  if (datos.educacionBolsaActiva) return "bolsa";
  return "disponibles";
}

function textoAyudaBusqueda(ccaaId, numGerencias, modoEducacion, modoListadoEducacion) {
  if (modoEducacion) {
    if (modoListadoEducacion === "bolsa") {
      return "Busca por apellidos o DNI parcial. Verás tu posición en la bolsa ordinaria completa de tu especialidad (orden por puntuación, como en sanidad). No te pedimos ni guardamos tu DNI completo.";
    }
    return "Busca por apellidos o DNI parcial. Este listado semanal solo incluye quienes están disponibles para sustituciones y las provincias donde aceptan. No te pedimos ni guardamos tu DNI completo.";
  }
  if (ccaaId === "mur") return TEXTO_AYUDA_BUSQUEDA_BASE.mur;
  if (ccaaId === "mad") return TEXTO_AYUDA_BUSQUEDA_BASE.mad;
  const gerenciasTxt = numGerencias ? `las ${numGerencias} gerencias` : "las gerencias";
  return `Puedes buscar por apellidos, por los últimos dígitos del DNI (como los publica el SESCAM) o por una combinación de ambos. Buscamos en ${gerenciasTxt} y en Atención Primaria y Especializada. No te pedimos ni guardamos tu DNI completo.`;
}

const HERRAMIENTAS = [
  { id: "simulador-baremo", titulo: "Simulador de baremo", subtitulo: "¿Cuántos puntos tendrías?", icono: Calculator, activo: true },
  { id: "simulador-gerencia", titulo: "Simulador de gerencia", subtitulo: "Tu posición en otra gerencia", icono: ArrowLeftRight, activo: true },
  { id: "mapa-oportunidades", titulo: "Mapa de oportunidades", subtitulo: "Dónde tienes más opciones", icono: MapIcon, activo: true },
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

const grupoDeCategoria = (categoria, grupos, ccaaId) => {
  if (ccaaId) {
    const porRegion = grupos.find((g) => g.ccaaId === ccaaId && g.categorias?.includes(categoria));
    if (porRegion) return porRegion;
  }
  return grupos.find((g) => g.categorias?.includes(categoria));
};

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
  const region = aparicion?.ccaaNombre ? `${aparicion.ccaaNombre} · ` : "";
  const base = `${region}${categoria} · ${gerencia}`;
  const ab = aparicion?.ambitosMerged || (ambito ? ambitoLegible(ambito) : "");
  return ab ? `${base} · ${ab}` : base;
}

function ambitoResumenFila(aparicionesGrupo) {
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

function normalizarAparicion(a) {
  return {
    ...a,
    posicion: Number(a?.posicion ?? a?.pos ?? 0) || 0,
    puntos: Number(a?.puntos ?? 0) || 0,
    total: Number(a?.total ?? 0) || 0,
  };
}

function clavePersonaListado(f) {
  return f.dniParcial || f.nombreCompleto;
}

/** Convierte fila(s) del listado completo al objeto candidato de PantallaResultado. */
function candidatoDesdeFilasListado(filaClickada, todasLasFilas, { categoria, grupoId, ccaaId, esEducacion, tipoListado }) {
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

function construirFilasResumen(apariciones = []) {
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

function grupoIdParaCapa(capa, aparicion, grupoIdFallback) {
  const gid = aparicion?.grupoId || grupoIdFallback;
  if (capa?.multi && aparicion?.ccaaId && gid && !String(gid).includes("::")) {
    return `${aparicion.ccaaId}::${gid}`;
  }
  return gid;
}

function tituloCategoriaResultado(categoria, apariciones) {
  if (categoria) return categoria;
  const cats = [...new Set((apariciones || []).map((a) => a.categoria).filter(Boolean))];
  if (cats.length === 1) return cats[0];
  if (cats.length > 1) return "Varias categorías";
  return "";
}

function aparicionParaDetalle(fila) {
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

function AvisoActualizacion({ categoria, grupoId, grupoActivo, tieneResultado = false }) {
  const capa = useCapaDatos();
  const organismo = capa.sector === "educacion" ? GERENCIA_EDUCACION : organismoCcaa(capa.ccaaId);
  const [e, setE] = useState({ tipo: "ok", texto: "Comprobando actualización…" });

  useEffect(() => {
    let cancel = false;
    const hayDatos = capa.tieneDatosReales(categoria, grupoId);
    if (grupoActivo && (tieneResultado || hayDatos)) {
      capa.estadoActualizacion(categoria, grupoId, true).then((est) => {
        if (cancel) return;
        if (tieneResultado && est.tipo === "sin_datos") {
          setE({ tipo: "ok", texto: "Posición calculada con listados scrapeados." });
        } else {
          setE(est);
        }
      });
    } else if (grupoActivo) {
      setE({ tipo: "sin_datos", texto: "Aún no tenemos listado scrapeado para esta categoría." });
    } else {
      setE(estadoActualizacionEjemplo(categoria, capa.gruposSanidad));
    }
    return () => { cancel = true; };
  }, [categoria, grupoId, grupoActivo, capa, tieneResultado]);
  if (e.tipo === "ok") {
    return (
      <p style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.inkSoft, marginTop: 8, paddingLeft: 2 }}>
        DATO OFICIAL · listado público {organismo}, orden por puntuación · {e.texto}
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

function AvisoLegal({ onAbrirPrivacidad }) {
  return (
    <div className="flex items-start gap-2 mx-5" style={{ marginTop: 18, padding: "10px 12px", background: C.paperDeep, borderRadius: "6px 14px 6px 14px" }}>
      <ShieldAlert size={13} color={C.inkSoft} style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkSoft, lineHeight: 1.4 }}>
        App no oficial, sin afiliación con ninguna administración pública. Los datos proceden de listados públicos y se muestran solo con fines informativos.{" "}
        <a
          href="/politica-privacidad.md"
          onClick={(e) => {
            e.preventDefault();
            onAbrirPrivacidad?.();
          }}
          style={{ color: C.navy, fontWeight: 600, textDecoration: "underline" }}
        >
          Política de privacidad
        </a>
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
// HOME — mapa como hero + barra inferior
// ---------------------------------------------------------------
function BarraInferior({ onBuscar, onSeguimientos, onMas, numSeguimientos }) {
  const items = [
    { id: "buscar", label: "Buscar", icon: Search, onClick: onBuscar },
    { id: "seguimientos", label: "Seguimientos", icon: Pin, onClick: onSeguimientos, badge: numSeguimientos },
    { id: "mas", label: "Más", icon: Settings, onClick: onMas },
  ];

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        background: C.card,
        borderTop: `1px solid ${C.line}`,
        zIndex: 50,
      }}
    >
      <div className="max-w-md mx-auto h-full flex items-stretch">
        {items.map((item) => {
          const Icono = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 focus:outline-none relative"
              style={{ background: "transparent", border: "none", padding: "6px 0" }}
            >
              <div className="relative">
                <Icono size={16} color={C.inkSoft} strokeWidth={2.2} />
                {item.badge > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -5,
                      right: -8,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 999,
                      background: C.navy,
                      color: "#fff",
                      fontFamily: FONT_BODY,
                      fontSize: 9,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 4px",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span style={{ fontFamily: FONT_BODY, fontSize: 10, fontWeight: 600, color: C.inkSoft }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function PantallaHome({ onConfirmCcaas, onBuscar, onSeguimientos, onMas, numSeguimientos }) {
  const [mostrarBienvenida, setMostrarBienvenida] = useState(() => !bienvenidaVista());

  const cerrarBienvenida = () => {
    marcarBienvenidaVista();
    setMostrarBienvenida(false);
  };

  return (
    <>
      {mostrarBienvenida && (
        <OverlayBienvenida
          C={C}
          GRAIN={GRAIN}
          FONT_BODY={FONT_BODY}
          onEmpezar={cerrarBienvenida}
        />
      )}
      <div
        style={{
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          paddingBottom: 56,
        }}
      >
        <header style={{ flex: "0 0 auto", padding: "14px 20px 4px", position: "relative" }}>
          <LogoInterino height={34} C={C} />
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 16,
              fontWeight: 500,
              color: C.ink,
              margin: "8px 0 0",
              lineHeight: 1.35,
              letterSpacing: "-0.01em",
            }}
          >
            Tu posición en la bolsa
          </p>
          {numSeguimientos > 0 && (
            <button
              type="button"
              onClick={onSeguimientos}
              aria-label={`${numSeguimientos} seguimientos`}
              className="focus:outline-none"
              style={{
                position: "absolute",
                top: 16,
                right: 20,
                width: 28,
                height: 28,
                borderRadius: 999,
                background: C.navy,
                color: "#fff",
                fontFamily: FONT_BODY,
                fontSize: 12,
                fontWeight: 700,
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {numSeguimientos}
            </button>
          )}
        </header>

        <div style={{ flex: 1, minHeight: 0, padding: "0 12px 4px", display: "flex", flexDirection: "column" }}>
          <MapaEspanaCCAA modo="hero" onConfirm={onConfirmCcaas} ccaaList={CCAA_LIST} colors={C} />
        </div>
      </div>
      <BarraInferior onBuscar={onBuscar} onSeguimientos={onSeguimientos} onMas={onMas} numSeguimientos={numSeguimientos} />
    </>
  );
}

function PantallaMas({ onHerramienta, onPrivacidad, atras }) {
  return (
    <div className="pb-8">
      <Barra titulo="Más" atras={atras} />
      <div className="px-5">
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.inkSoft, marginBottom: 12 }}>
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
        <div style={{ marginTop: 28 }}>
          <AvisoLegal onAbrirPrivacidad={onPrivacidad} />
        </div>
      </div>
    </div>
  );
}

function SelectorSectorInline({ ccaas, sectorId, onSectorChange, educacionActiva }) {
  const sectores = sectoresParaCcaas(ccaas.map((c) => c.id), { educacionActiva }).map((s) => ({
    ...s,
    icono: ICONOS_SECTOR[s.id] || Stethoscope,
  }));

  return (
    <div>
      <label style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.ink }}>Sector</label>
      <div className="flex gap-2 mt-2">
        {sectores.map((s) => {
          const Icono = s.icono;
          const sel = sectorId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              disabled={!s.activo}
              onClick={() => s.activo && onSectorChange(s)}
              className="flex-1 focus:outline-none flex flex-col items-center gap-1"
              style={{
                background: sel && s.activo ? C.navy : C.card,
                border: `1.5px solid ${sel && s.activo ? C.navy : C.line}`,
                borderRadius: "12px 4px 12px 4px",
                padding: "10px 6px",
                opacity: s.activo ? 1 : 0.62,
                cursor: s.activo ? "pointer" : "default",
              }}
            >
              <Icono size={16} color={sel && s.activo ? C.goldSoft : C.inkSoft} />
              <span
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: sel && s.activo ? "#fff" : C.inkSoft,
                  lineHeight: 1.2,
                  textAlign: "center",
                }}
              >
                {s.nombre}
              </span>
              {!s.activo && <Lock size={10} color={C.inkSoft} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SelectorListadoEducacion({ modo, onModoChange, bolsaActiva, disponiblesActiva }) {
  if (!bolsaActiva && !disponiblesActiva) return null;
  const mostrarToggle = bolsaActiva && disponiblesActiva;

  return (
    <div>
      <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5, color: C.navy, marginBottom: 8 }}>
        Tipo de listado
      </p>
      <div className="flex flex-col gap-2">
        {[MODOS_LISTADO_EDUCACION.bolsa, MODOS_LISTADO_EDUCACION.disponibles].map((m) => {
          const activo = m.id === "bolsa" ? bolsaActiva : disponiblesActiva;
          const seleccionado = modo === m.id;
          return (
            <button
              key={m.id}
              type="button"
              disabled={!activo}
              onClick={() => activo && onModoChange(m.id)}
              className="text-left focus:outline-none"
              style={{
                background: seleccionado ? C.navy : C.card,
                color: seleccionado ? "#fff" : activo ? C.ink : C.inkSoft,
                border: `1.5px solid ${seleccionado ? C.navy : C.line}`,
                borderRadius: m.id === "bolsa" ? "16px 6px 16px 6px" : "6px 16px 6px 16px",
                padding: "12px 14px",
                opacity: activo ? 1 : 0.55,
                cursor: activo && mostrarToggle ? "pointer" : "default",
              }}
            >
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5 }}>{m.titulo}</p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, marginTop: 3, opacity: 0.85 }}>{m.subtitulo}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// PANTALLA 3 — buscar posición
// ---------------------------------------------------------------
function PantallaBuscar({ atras, onBuscar, onBuscarGlobal, onVerListado, recientes, gruposSanidad, ccaas, sectorId, onSectorChange, educacionActiva, educacionBolsaActiva, educacionDisponiblesActiva, modoEducacion, modoListadoEducacion, onModoListadoEducacionChange }) {
  const datos = useDatos();
  const capa = useCapaDatos();
  const multi = ccaas.length > 1;
  const ccaaIds = ccaas.map((c) => c.id);
  const sectores = sectoresParaCcaas(ccaaIds, { educacionActiva });
  const sectorActivo = sectores.find((s) => s.id === sectorId);
  const sectorDisponible = sectorActivo?.activo;
  const [grupoId, setGrupoId] = useState(gruposSanidad[0]?.id || "diplomado");
  const grupo = gruposSanidad.find((g) => g.id === grupoId) || gruposSanidad[0];
  const categoriasGrupo = grupo?.categorias || [];
  const [categoria, setCategoria] = useState(categoriasGrupo[0] || "");
  const [consulta, setConsulta] = useState("");
  const [sinResultados, setSinResultados] = useState(false);
  const [sinResultadosGlobal, setSinResultadosGlobal] = useState(false);
  const [sinDatosCategoria, setSinDatosCategoria] = useState(false);

  const categoriaConDatos = sectorDisponible && grupo?.activo && capa.tieneDatosReales(categoria, grupoId);
  const tituloBarra = multi ? ccaas.map((c) => c.nombre).join(" · ") : (ccaas[0]?.nombre || "Castilla-La Mancha");
  const textoAyuda = multi
    ? TEXTO_AYUDA_BUSQUEDA_BASE.multi
    : textoAyudaBusqueda(ccaaIds[0] || "clm", datos.numGerenciasClm, modoEducacion, modoListadoEducacion);

  const cambiarGrupo = (id) => {
    const g = gruposSanidad.find((x) => x.id === id);
    setGrupoId(id);
    setCategoria(g?.categorias?.[0] || "");
    setSinResultados(false);
    setSinResultadosGlobal(false);
    setSinDatosCategoria(false);
  };

  useEffect(() => {
    const g = gruposSanidad[0];
    if (!g) {
      setGrupoId("");
      setCategoria("");
      return;
    }
    setGrupoId(g.id);
    setCategoria(g.categorias?.[0] || "");
    setSinResultados(false);
    setSinResultadosGlobal(false);
    setSinDatosCategoria(false);
  }, [sectorId, gruposSanidad, modoListadoEducacion]);

  const buscar = async (cat, q) => {
    setSinDatosCategoria(false);
    setSinResultadosGlobal(false);
    const res = await onBuscar(cat, q);
    if (res === -1) {
      setSinDatosCategoria(true);
      setSinResultados(false);
      return;
    }
    setSinResultados(res === 0);
  };

  const buscarGlobal = async (q) => {
    if (!onBuscarGlobal || !q.trim()) return;
    setSinDatosCategoria(false);
    setSinResultados(false);
    const res = await onBuscarGlobal(q);
    setSinResultadosGlobal(res === 0);
  };

  return (
    <div>
      <Barra titulo={tituloBarra} atras={atras} />

      <div className="px-5 flex flex-col gap-5 mt-2 pb-8">
        {multi && (
          <div className="flex flex-wrap gap-2">
            {ccaas.map((c) => (
              <span
                key={c.id}
                style={{
                  background: C.card,
                  border: `1px solid ${C.line}`,
                  borderRadius: 20,
                  padding: "5px 12px",
                  fontFamily: FONT_BODY,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: C.navy,
                }}
              >
                {c.nombre}
              </span>
            ))}
          </div>
        )}

        <SelectorSectorInline
          ccaas={ccaas}
          sectorId={sectorId}
          educacionActiva={educacionActiva}
          onSectorChange={(s) => {
            onSectorChange?.(s);
            setSinResultados(false);
            setSinResultadosGlobal(false);
            setSinDatosCategoria(false);
          }}
        />

        {modoEducacion && (
          <SelectorListadoEducacion
            modo={modoListadoEducacion}
            onModoChange={onModoListadoEducacionChange}
            bolsaActiva={educacionBolsaActiva}
            disponiblesActiva={educacionDisponiblesActiva}
          />
        )}

        {modoEducacion && !gruposSanidad.length && (
          <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
            <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
              No hay listados de educación cargados para este modo. En producción, sube las carpetas <strong>educacion/</strong> y/o <strong>educacion-bolsa/</strong> a R2.
            </p>
          </div>
        )}

        {gruposSanidad.length > 0 && (
        <div>
          <label style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.ink }}>
            {modoEducacion ? "Cuerpo docente" : "Grupo profesional"}
          </label>
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
        )}

        {gruposSanidad.length > 0 && (
        <div>
          <label style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.ink }}>
            {modoEducacion ? "Especialidad" : "Categoría"}
          </label>
          <select
            value={categoria}
            onChange={(e) => { setCategoria(e.target.value); setSinResultados(false); setSinResultadosGlobal(false); setSinDatosCategoria(false); }}
            className="w-full mt-2 focus:outline-none"
            style={{ border: `1.5px solid ${C.line}`, background: C.card, padding: "13px 14px", fontFamily: FONT_BODY, fontSize: 15, color: C.ink }}
          >
            {categoriasGrupo.map((c) => (
              <option key={c} value={c}>
                {c}{capa.tieneDatosReales(c, grupoId) ? "" : " · sin datos"}
              </option>
            ))}
          </select>
        </div>
        )}

        {gruposSanidad.length > 0 && (
        <div>
          <label style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.ink }}>Apellidos o DNI parcial</label>
          <input
            value={consulta}
            onChange={(e) => { setConsulta(e.target.value); setSinResultados(false); setSinResultadosGlobal(false); setSinDatosCategoria(false); }}
            placeholder="Apellidos, DNI parcial o ambos — ej. García 4208"
            className="w-full mt-2 focus:outline-none"
            style={{ border: `1.5px solid ${C.line}`, background: C.card, padding: "13px 14px", fontFamily: FONT_BODY, fontSize: 15, color: C.ink }}
          />
          <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, marginTop: 6 }}>
            {textoAyuda}
          </p>
        </div>
        )}

        {!sectorDisponible && (
          <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
            <Lock size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
              Este sector aún no está disponible en esta comunidad.
            </p>
          </div>
        )}

        {!categoriaConDatos && sectorDisponible && (
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

        {multi && onBuscarGlobal && (
          <button
            onClick={() => buscarGlobal(consulta)}
            disabled={!consulta.trim()}
            className="w-full font-bold focus:outline-none flex items-center justify-center gap-2"
            style={{
              background: consulta.trim() ? "transparent" : C.paperDeep,
              color: consulta.trim() ? C.navy : C.inkSoft,
              padding: "13px",
              fontFamily: FONT_BODY,
              fontSize: 14,
              borderRadius: "5px 16px 5px 16px",
              border: `1.5px solid ${C.line}`,
              cursor: consulta.trim() ? "pointer" : "default",
            }}
          >
            <Search size={15} /> Buscar en todas mis comunidades
          </button>
        )}

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
                    const g = grupoDeCategoria(rec.categoria, gruposSanidad, rec.ccaaId);
                    if (g) setGrupoId(g.id);
                    setCategoria(rec.categoria);
                    setConsulta(rec.consulta);
                    if (rec.global) buscarGlobal(rec.consulta);
                    else buscar(rec.categoria, rec.consulta);
                  }}
                  className="focus:outline-none"
                  style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, padding: "6px 12px", fontFamily: FONT_BODY, fontSize: 12, color: C.navy }}
                >
                  {rec.consulta}{rec.global ? " · todas" : rec.categoria ? ` · ${rec.categoria}` : ""}
                </button>
              ))}
            </div>
          </div>
        )}

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
              No encontramos coincidencias para «{consulta.trim()}»{modoEducacion ? ` en la especialidad ${categoria}` : ` en ninguna gerencia de ${categoria}`}. Comprueba cómo lo has escrito, o puede que aún no estés incluido en esta bolsa.
            </p>
          </div>
        )}

        {sinResultadosGlobal && (
          <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
            <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
              No encontramos coincidencias para «{consulta.trim()}» en ninguna de tus comunidades seleccionadas.
            </p>
          </div>
        )}

        <button
          onClick={() => onVerListado(categoria, modoEducacion ? "" : undefined)}
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
function PantallaConfirmar({ categoria, candidatos, atras, onElegir, global }) {
  return (
    <div>
      <Barra titulo="¿Cuál eres tú?" atras={atras} />
      <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: C.inkSoft, padding: "0 20px 4px" }}>
        {global
          ? `Encontramos ${candidatos.length} personas que coinciden con tu búsqueda en tus comunidades seleccionadas. Toca tu nombre — si dudas, el listado también muestra los últimos dígitos del DNI para confirmar.`
          : `Encontramos ${candidatos.length} personas que coinciden con tu búsqueda en las listas de ${categoria}. Toca tu nombre — si dudas, el listado también muestra los últimos dígitos del DNI para confirmar.`}
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
                En {(c.apariciones || []).length} lista{(c.apariciones || []).length > 1 ? "s" : ""} · mejor posición #{(c.apariciones || []).length ? Math.min(...c.apariciones.map((a) => a.posicion)) : "—"} · DNI {c.dniParcial}
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
function PantallaListado({ categoria, gerencia, ambito, grupoId, grupoActivo, atras, modoEducacion, modoListadoEducacion, onAbrirPersona }) {
  const capa = useCapaDatos();
  const esEducacion = modoEducacion || capa.sector === "educacion";
  const esBolsaCompleta = esEducacion && (modoListadoEducacion === "bolsa" || esBolsaOrdinaria(capa.tipoListado));
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [errorDatos, setErrorDatos] = useState(false);
  const LIMITE_FILAS = 100;
  const esReal = grupoActivo && capa.tieneDatosReales(categoria, grupoId);
  const tituloListado = esEducacion ? categoria : etiquetaLista(categoria, gerencia, ambito);

  useEffect(() => {
    let cancel = false;
    setCargando(true);
    setErrorDatos(false);
    const cargar = async () => {
      if (esReal) {
        try {
          const f = await capa.obtenerListadoCompleto(grupoId, categoria, gerencia, ambito || "");
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
  }, [capa, categoria, gerencia, ambito, grupoId, esReal]);

  const visibles = filtro ? filas.filter((f) => coincideBusqueda(f, filtro)) : filas;
  const mostradas = visibles.slice(0, LIMITE_FILAS);

  return (
    <div>
      <Barra titulo={tituloListado} atras={atras} />
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
              No hay listado scrapeado para esta {esEducacion ? "especialidad" : "categoría"}. No mostramos datos inventados.
            </p>
          </div>
        )}
        <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, margin: "6px 0 4px" }}>
          Útil si un compañero opositor te ha dicho que está en esta lista y quieres ver en qué puesto queda. Toca una fila para ver su perfil.
        </p>

        <div className="mt-2" style={{ border: `1px solid ${C.line}`, borderRadius: "10px 3px 10px 3px", overflow: "hidden" }}>
          <div className="flex" style={{ background: C.navy, padding: "9px 14px" }}>
            <span style={{ flex: "0 0 40px", fontFamily: FONT_MONO, fontSize: 10.5, color: C.goldSoft }}>POS.</span>
            <span style={{ flex: 1, fontFamily: FONT_MONO, fontSize: 10.5, color: C.goldSoft }}>NOMBRE Y APELLIDOS</span>
            {esEducacion ? (
              esBolsaCompleta ? (
                <span style={{ flex: "0 0 56px", fontFamily: FONT_MONO, fontSize: 10.5, color: C.goldSoft, textAlign: "right" }}>BOLSA</span>
              ) : (
                <span style={{ flex: "0 0 72px", fontFamily: FONT_MONO, fontSize: 10.5, color: C.goldSoft, textAlign: "right" }}>PROV.</span>
              )
            ) : (
              <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.goldSoft }}>PUNTOS</span>
            )}
            {onAbrirPersona && <span style={{ flex: "0 0 18px" }} aria-hidden="true" />}
          </div>
          {mostradas.map((f, idx) => (
            <button
              key={`${f.pos}-${f.nombreCompleto}-${f.ambito || ""}-${idx}`}
              type="button"
              onClick={() => onAbrirPersona?.(f, filas)}
              disabled={!onAbrirPersona}
              className="w-full flex items-center text-left focus:outline-none focus:ring-2"
              style={{
                padding: "10px 14px",
                borderTop: `1px solid ${C.line}`,
                background: C.card,
                border: "none",
                cursor: onAbrirPersona ? "pointer" : "default",
                transition: "background .12s ease",
              }}
            >
              <span style={{ flex: "0 0 40px", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: C.navy }}>{f.pos}</span>
              <span style={{ flex: 1, fontFamily: FONT_BODY, fontSize: 13, color: C.ink }}>
                {f.nombreCompleto}
                {f.ambito && <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.inkSoft }}> · {f.ambito}</span>}
                {esEducacion && f.tipo_bolsa && (
                  <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.inkSoft }}> · {tipoBolsaLegible(f.tipo_bolsa)}</span>
                )}
              </span>
              {esEducacion ? (
                esBolsaCompleta ? (
                  <span style={{ flex: "0 0 56px", fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, textAlign: "right" }}>
                    {f.bolsa_codigo ?? "—"}
                  </span>
                ) : (
                  <span style={{ flex: "0 0 72px", fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, textAlign: "right" }}>
                    {(f.provincias || [])
                      .map((c) => PROVINCIAS_CLM.find((p) => p.codigo === c)?.abrev || c)
                      .join(" ")}
                  </span>
                )
              ) : (
                <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.inkSoft }}>{f.puntos?.toFixed?.(2) ?? "—"}</span>
              )}
              {onAbrirPersona && (
                <ChevronRight size={16} color={C.inkSoft} style={{ flex: "0 0 18px", marginLeft: 4 }} />
              )}
            </button>
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
// PANTALLA 4 — resultado: tabla resumen + detalle por gerencia
// ---------------------------------------------------------------

// Bloque de detalle educación CLM: posición en bolsa + provincias
function TarjetaEducacion({ categoria, grupoId, grupoActivo, r, guardado, onGuardar, onVerListado, onInfoLlamamientos, esBolsaCompleta }) {
  const capa = useCapaDatos();
  const bolsaCompleta = esBolsaCompleta ?? esBolsaOrdinaria(r?.tipoListado ?? capa.tipoListado);
  const [notifEstado, setNotifEstado] = useState(guardado ? "activo" : "inicial");
  const posicion = Number(r?.posicion ?? r?.pos ?? r?.bolsa_orden ?? 0) || 0;
  const total = Number(r?.total ?? 0) || 0;
  const ordenLista = Number(r?.orden_lista ?? 0) || 0;
  const bolsaGeneral = Number(r?.bolsa_orden ?? 0) || 0;
  const provincias = new Set(r?.provincias || []);
  const percentil = total > 0 ? Math.round((1 - posicion / total) * 100) : 0;
  const idiomas = r?.idiomas || {};
  const idiomasActivos = Object.entries(idiomas).filter(([, v]) => v).map(([k]) => k);

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
        <Sello>{categoria}</Sello>
        <p
          style={{
            fontFamily: FONT_DISPLAY, fontSize: 60, fontWeight: 700, color: "#fff",
            lineHeight: 1, marginTop: 14, transform: "rotate(-1.2deg)", display: "inline-block",
          }}
        >
          #{posicion}
        </p>
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.goldSoft, marginTop: 8 }}>
          {total > 0
            ? bolsaCompleta
              ? `de ${total.toLocaleString("es-ES")} personas en la bolsa ordinaria · por delante del ${percentil}%`
              : `de ${total.toLocaleString("es-ES")} personas en la bolsa · por delante del ${percentil}%`
            : bolsaCompleta
              ? "Posición en la bolsa ordinaria completa"
              : "Posición en la bolsa de sustituciones"}
        </p>
        {r?.tipo_bolsa && (
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.goldSoft, marginTop: 6 }}>
            {tipoBolsaLegible(r.tipo_bolsa)}
            {ordenLista > 0 ? ` · orden en listado ${ordenLista}` : ""}
          </p>
        )}
      </div>
      <AvisoActualizacion categoria={categoria} grupoId={grupoId} grupoActivo={grupoActivo} tieneResultado={posicion > 0} />

      {!bolsaCompleta && (
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: "18px 6px 18px 6px", padding: 16, marginTop: 12 }}>
        <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.ink }}>Provincias donde acepta sustituciones</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {PROVINCIAS_CLM.map((prov) => {
            const activa = provincias.has(prov.codigo);
            return (
              <span
                key={prov.codigo}
                title={prov.nombre}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 12,
                  padding: "6px 12px",
                  borderRadius: 20,
                  background: activa ? C.okBg : C.paperDeep,
                  color: activa ? C.ok : C.inkSoft,
                  fontWeight: activa ? 700 : 400,
                  border: `1px solid ${activa ? C.ok : C.line}`,
                  textDecoration: activa ? "none" : "line-through",
                }}
              >
                {prov.abrev}
              </span>
            );
          })}
        </div>
        <p style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkSoft, marginTop: 10 }}>
          AB = Albacete · CR = Ciudad Real · CU = Cuenca · GU = Guadalajara · TO = Toledo
        </p>
      </div>
      )}

      {bolsaCompleta && (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: "18px 6px 18px 6px", padding: 16, marginTop: 12 }}>
          <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.ink }}>Bolsa ordinaria completa</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 6, lineHeight: 1.45 }}>
            Listado por puntuación publicado en la renovación anual (junio/julio). Incluye a todas las personas admitidas en la bolsa, no solo quienes están disponibles para sustituciones.
          </p>
          {r?.bolsa_codigo != null && (
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, marginTop: 8 }}>
              Código bolsa: {r.bolsa_codigo} · acceso {r.acceso ?? "—"}
            </p>
          )}
        </div>
      )}

      {!bolsaCompleta && idiomasActivos.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: "6px 18px 6px 18px", padding: 16, marginTop: 12 }}>
          <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.ink }}>Idiomas acreditados</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {idiomasActivos.map((id) => (
              <span
                key={id}
                style={{
                  fontFamily: FONT_MONO, fontSize: 11, padding: "4px 10px", borderRadius: 20,
                  background: C.okBg, color: C.ok, fontWeight: 700,
                }}
              >
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2" style={{ background: C.paperDeep, borderRadius: "8px 18px 8px 18px", padding: 14, marginTop: 12 }}>
        <Smartphone size={15} color={C.inkSoft} style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.4 }}>
          <strong style={{ color: C.ink }}>Revisa tus datos en Educación CLM.</strong> Los llamamientos para sustituciones dependen de que tus datos de contacto estén actualizados en el portal oficial.
        </p>
      </div>

      {notifEstado === "inicial" && (
        <button
          onClick={() => setNotifEstado("pidiendo")}
          className="w-full font-bold focus:outline-none flex items-center justify-center gap-2 mt-4"
          style={{ background: C.gold, color: "#fff", padding: "14px", fontFamily: FONT_BODY, fontSize: 14, borderRadius: "16px 5px 16px 5px" }}
        >
          <Bell size={16} /> Seguir esta especialidad
        </button>
      )}

      {notifEstado === "pidiendo" && (
        <div style={{ background: C.card, border: `1.5px solid ${C.navy}`, borderRadius: "10px 20px 10px 20px", padding: 16, marginTop: 16 }}>
          <div className="flex items-center gap-3">
            <Smartphone size={20} color={C.navy} />
            <div>
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy }}>Permitir notificaciones</p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                Te avisaremos cuando cambie tu posición en {categoria}. <strong style={{ color: C.clay }}>Esto no sustituye la llamada oficial de Educación CLM</strong>.
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
          <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5, color: C.ok }}>Siguiendo {categoria} — te avisaremos</p>
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

// Bloque de detalle de UNA lista (gerencia + ámbito): posición, puntos, contratos, corte y avisos
function TarjetaGerencia({ categoria, gerencia, ambito, grupoId, grupoActivo, ccaaId, r, guardado, onGuardar, onVerListado, onInfoLlamamientos }) {
  const capa = useCapaDatos();
  const regionId = ccaaId || r.ccaaId || capa.ccaaId;
  const organismo = organismoCcaa(regionId);
  const portalNombre = regionId === "clm" ? "Selecta" : organismo;
  const [notifEstado, setNotifEstado] = useState(guardado ? "activo" : "inicial");
  const posicion = Number(r?.posicion ?? r?.pos ?? 0) || 0;
  const total = Number(r?.total ?? 0) || 0;
  const puntos = Number(r?.puntos ?? 0) || 0;
  const percentil = total > 0 ? Math.round((1 - posicion / total) * 100) : 0;
  const historial = grupoActivo && capa.tieneDatosReales(categoria, grupoId)
    ? capa.historialCorte(categoria, gerencia, ambito || r.ambito || "", grupoId)
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
          #{posicion}
        </p>
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.goldSoft, marginTop: 8 }}>
          de {total.toLocaleString("es-ES")} personas en la bolsa · por delante del {percentil}%
        </p>
      </div>
      <AvisoActualizacion categoria={categoria} grupoId={grupoId} grupoActivo={grupoActivo} tieneResultado={posicion > 0} />

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: "18px 6px 18px 6px", padding: 16 }}>
          <Users size={16} color={C.navy} />
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: C.navy, marginTop: 6 }}>{r.delante}</p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft }}>personas por delante</p>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: "6px 18px 6px 18px", padding: 16 }}>
          <TrendingUp size={16} color={C.ok} />
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: C.navy, marginTop: 6 }}>{puntos.toFixed(1)}</p>
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
        const diff = (puntos - ult.puntos).toFixed(2);
        const yaLlamado = puntos >= ult.puntos;
        const riesgo = zonaRiesgo(puntos, historial);
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
              <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}`, lineHeight: 1.45 }}>
                Tendencia disponible próximamente.
              </p>
            )}
          </div>
        );
      })()}

      <div className="flex items-start gap-2" style={{ background: C.paperDeep, borderRadius: "8px 18px 8px 18px", padding: 14, marginTop: 12 }}>
        <Smartphone size={15} color={C.inkSoft} style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.4 }}>
          <strong style={{ color: C.ink }}>Revisa tus datos en {portalNombre}.</strong> Muchos llamamientos se pierden por un teléfono o email desactualizado, no por la posición en la bolsa.
        </p>
      </div>

      {notifEstado === "inicial" && (
        <button
          onClick={() => setNotifEstado("pidiendo")}
          className="w-full font-bold focus:outline-none flex items-center justify-center gap-2 mt-4"
          style={{ background: C.gold, color: "#fff", padding: "14px", fontFamily: FONT_BODY, fontSize: 14, borderRadius: "16px 5px 16px 5px" }}
        >
          <Bell size={16} /> Seguir esta gerencia
        </button>
      )}

      {notifEstado === "pidiendo" && (
        <div style={{ background: C.card, border: `1.5px solid ${C.navy}`, borderRadius: "10px 20px 10px 20px", padding: 16, marginTop: 16 }}>
          <div className="flex items-center gap-3">
            <Smartphone size={20} color={C.navy} />
            <div>
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy }}>Permitir notificaciones</p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                Te avisaremos cuando cambie tu posición en {etiquetaLista(categoria, gerencia, ambito || r.ambito, r)}. <strong style={{ color: C.clay }}>Esto no sustituye la llamada oficial de {organismo}</strong> — esa te la hacen ellos directamente, y tienes horas contadas para responder.
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

// Contenedor: tabla resumen de gerencias + detalle al tocar una fila.
function PantallaResultado({ categoria, grupoId, grupoActivo, candidato, atras, estaGuardado, onGuardar, onVerListado, onInfoLlamamientos, modoEducacion, modoListadoEducacion }) {
  const capa = useCapaDatos();
  const apariciones = candidato?.apariciones ?? [];
  const esEducacion = modoEducacion || apariciones[0]?.sector === "educacion";
  const esBolsaCompleta = esEducacion && (modoListadoEducacion === "bolsa" || esBolsaOrdinaria(apariciones[0]?.tipoListado ?? capa.tipoListado));
  const [detalleFila, setDetalleFila] = useState(null);
  const [bulkSeguido, setBulkSeguido] = useState(false);

  const filas = useMemo(() => construirFilasResumen(apariciones), [apariciones]);
  const categoriaMostrada = useMemo(() => tituloCategoriaResultado(categoria, apariciones), [categoria, apariciones]);
  const numGerencias = filas.length;

  useEffect(() => {
    setDetalleFila(null);
    setBulkSeguido(false);
  }, [candidato?.dniParcial, candidato?.nombreCompleto]);

  if (esEducacion && apariciones.length > 0) {
    const a = normalizarAparicion(apariciones[0]);
    const catAparicion = a.categoria || categoriaMostrada || categoria;
    const grupoAparicion = grupoIdParaCapa(capa, a, grupoId);
    return (
      <div>
        <Barra titulo="Resultado" atras={atras} />
        <div className="px-5 pb-6">
          <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, marginBottom: 12 }}>
            Mostrando a <strong style={{ color: C.navy }}>{candidato.nombreCompleto}</strong>
            {candidato.dniParcial && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 11.5 }}> · DNI {candidato.dniParcial}</span>
            )}
          </p>
          <TarjetaEducacion
            categoria={catAparicion}
            grupoId={grupoAparicion}
            grupoActivo={grupoActivo ?? true}
            r={a}
            guardado={estaGuardado(GERENCIA_EDUCACION, "", candidato.nombreCompleto, catAparicion, a.ccaaId || "clm")}
            onGuardar={() =>
              onGuardar(
                GERENCIA_EDUCACION,
                "",
                { ...a, nombreCompleto: candidato.nombreCompleto, dniParcial: candidato.dniParcial },
                catAparicion,
                grupoAparicion,
                a.ccaaId || "clm"
              )
            }
            onVerListado={() => onVerListado("", "", catAparicion, grupoAparicion)}
            onInfoLlamamientos={onInfoLlamamientos}
            esBolsaCompleta={esBolsaCompleta}
          />
        </div>
      </div>
    );
  }

  const mejorPosicion = filas.length ? Math.min(...filas.map((f) => f.posicion)) : 0;

  const todasGuardadas = apariciones.every((a) => {
    const cat = a.categoria || categoria;
    return estaGuardado(a.gerencia, a.ambito, candidato.nombreCompleto, cat, a.ccaaId);
  });

  const seguirTodas = () => {
    apariciones.forEach((a) => {
      const cat = a.categoria || categoria;
      const gid = a.grupoId || grupoId;
      if (!estaGuardado(a.gerencia, a.ambito, candidato.nombreCompleto, cat, a.ccaaId)) {
        onGuardar(
          a.gerencia,
          a.ambito,
          { ...a, nombreCompleto: candidato.nombreCompleto, dniParcial: candidato.dniParcial },
          cat,
          gid,
          a.ccaaId
        );
      }
    });
    setBulkSeguido(true);
  };

  if (detalleFila) {
    const a = aparicionParaDetalle(detalleFila);
    const catAparicion = a.categoria || categoriaMostrada || categoria;
    const grupoAparicion = grupoIdParaCapa(capa, a, grupoId);
    const grupoActivoAparicion = grupoActivo ?? true;
    return (
      <div>
        <Barra titulo="Resultado" atras={() => setDetalleFila(null)} />
        <div className="px-5 pb-6">
          <TarjetaGerencia
            categoria={catAparicion}
            gerencia={a.gerencia}
            ambito={a.ambito}
            grupoId={grupoAparicion}
            grupoActivo={grupoActivoAparicion}
            ccaaId={a.ccaaId}
            r={a}
            guardado={estaGuardado(a.gerencia, a.ambito, candidato.nombreCompleto, catAparicion, a.ccaaId)}
            onGuardar={() =>
              onGuardar(
                a.gerencia,
                a.ambito,
                { ...a, nombreCompleto: candidato.nombreCompleto, dniParcial: candidato.dniParcial },
                catAparicion,
                grupoAparicion,
                a.ccaaId
              )
            }
            onVerListado={() => onVerListado(a.gerencia, a.ambito, catAparicion, grupoAparicion)}
            onInfoLlamamientos={onInfoLlamamientos}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Barra titulo="Resultado" atras={atras} />

      <div className="px-5">
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, marginBottom: 4 }}>
          Mostrando a <strong style={{ color: C.navy }}>{candidato.nombreCompleto}</strong>
          {candidato.dniParcial && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 11.5 }}> · DNI {candidato.dniParcial}</span>
          )}
        </p>
        <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: C.navy, fontWeight: 600, marginBottom: 16 }}>
          {categoriaMostrada || "Resultado"}
          {numGerencias > 0 && (
            <span style={{ color: C.inkSoft, fontWeight: 500 }}> · {numGerencias} gerencia{numGerencias !== 1 ? "s" : ""}</span>
          )}
        </p>

        {filas.length === 0 && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.clay, marginBottom: 16, lineHeight: 1.45 }}>
            No hay posiciones que mostrar para esta búsqueda. Vuelve atrás e inténtalo de nuevo.
          </p>
        )}

        <div
          style={{
            background: C.card,
            border: `1.5px solid ${C.line}`,
            borderRadius: "16px 6px 16px 6px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto 22px",
              gap: "8px 10px",
              padding: "10px 14px",
              borderBottom: `1px solid ${C.line}`,
              background: C.paperDeep,
            }}
          >
            <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Gerencia
            </span>
            <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>
              Pos.
            </span>
            <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>
              Puntos
            </span>
            <span aria-hidden="true" />
          </div>

          {filas.map((fila, i) => {
            const esMejor = fila.posicion === mejorPosicion;
            const etiquetaGerencia = [
              fila.ccaaNombre ? `${fila.ccaaNombre} · ${fila.gerencia}` : fila.gerencia,
              fila.ambitoLabel,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <button
                key={fila.key}
                type="button"
                onClick={() => setDetalleFila(fila)}
                className="w-full text-left focus:outline-none focus:ring-2"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto 22px",
                  gap: "8px 10px",
                  alignItems: "center",
                  padding: "12px 14px",
                  border: "none",
                  borderBottom: i < filas.length - 1 ? `1px solid ${C.line}` : "none",
                  background: esMejor ? C.okBg : C.card,
                  cursor: "pointer",
                  transition: "background .15s ease",
                }}
              >
                <span
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 13,
                    fontWeight: esMejor ? 700 : 500,
                    color: esMejor ? C.ok : C.ink,
                    lineHeight: 1.35,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {etiquetaGerencia}
                </span>
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: esMejor ? C.ok : C.navy,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  #{fila.posicion}
                </span>
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 12,
                    color: C.inkSoft,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  {Number(fila.puntos).toFixed(2)}
                </span>
                <ChevronRight size={16} color={C.inkSoft} style={{ flexShrink: 0 }} />
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2" style={{ marginTop: 16 }}>
          {todasGuardadas || bulkSeguido ? (
            <div
              className="flex items-center justify-center gap-2"
              style={{ background: C.okBg, borderRadius: "16px 5px 16px 5px", padding: "13px" }}
            >
              <BellRing size={16} color={C.ok} />
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5, color: C.ok }}>
                Siguiendo {numGerencias} gerencia{numGerencias !== 1 ? "s" : ""}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={seguirTodas}
              className="w-full font-bold focus:outline-none flex items-center justify-center gap-2"
              style={{
                background: C.gold,
                color: "#fff",
                padding: "14px",
                fontFamily: FONT_BODY,
                fontSize: 14,
                borderRadius: "16px 5px 16px 5px",
              }}
            >
              <Bell size={16} /> Seguir todas las gerencias
            </button>
          )}
          <button
            type="button"
            onClick={() => onVerListado("", "", categoriaMostrada || categoria, grupoIdParaCapa(capa, apariciones[0], grupoId))}
            className="w-full font-bold focus:outline-none flex items-center justify-center gap-2"
            style={{
              background: "transparent",
              color: C.navy,
              padding: "12px",
              fontFamily: FONT_BODY,
              fontSize: 13.5,
              border: `1.5px solid ${C.line}`,
              borderRadius: "5px 16px 5px 16px",
            }}
          >
            <ListIcon size={15} /> Ver listado completo
          </button>
        </div>
      </div>
    </div>
  );
}
// ---------------------------------------------------------------
// PANTALLA — Mis seguimientos (varias listas a la vez)
// ---------------------------------------------------------------
function PantallaSeguimientos({ seguimientos, atras, onAbrir, gruposSanidad }) {
  const capa = useCapaDatos();
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
            const grupo = grupoDeCategoria(s.categoria, gruposSanidad, s.ccaaId);
            const organismo = organismoCcaa(s.ccaaId || capa.ccaaId);
            const e = grupo?.activo && capa.tieneDatosReales(s.categoria, grupo.id)
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
                    <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy }}>{etiquetaLista(s.categoria, s.gerencia, s.ambito, { ccaaNombre: CCAA_LIST.find((c) => c.id === s.ccaaId)?.nombre })}</p>
                    <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>{r.nombreCompleto}</p>
                  </div>
                  {e.tipo !== "ok" && <AlertTriangle size={14} color={C.clay} />}
                </div>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, color: C.navy, marginTop: 4 }}>#{r.posicion}</p>
                <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft }}>{r.puntos.toFixed(2)} puntos · {organismo}</p>
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
        datos.educacionDisponiblesClm ||
        datos.paraCcaa("clm")
      );
    }
    if (ids.length === 0) return datos.paraCcaa("clm");
    return datos.paraCcaas(ids);
  }, [datos, ccaas, sectorId, listadoEducacionModo]);
  const modoEducacion = sectorId === "educacion" || capaDatos.sector === "educacion";
  const gruposSanidad = useMemo(() => {
    const g = capaDatos.gruposSanidad;
    if (g?.length) return g;
    if (modoEducacion) return [];
    return GRUPOS_SANIDAD_FALLBACK;
  }, [capaDatos, modoEducacion]);
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

  useEffect(() => {
    try {
      localStorage.setItem(LS_EDUCACION_LISTADO, listadoEducacionModo);
    } catch { /* quota / modo privado */ }
  }, [listadoEducacionModo]);

  useEffect(() => {
    if (sectorId !== "educacion") return;
    if (listadoEducacionModo === "bolsa" && !datos.educacionBolsaActiva && datos.educacionDisponiblesActiva) {
      setListadoEducacionModo("disponibles");
    } else if (listadoEducacionModo === "disponibles" && !datos.educacionDisponiblesActiva && datos.educacionBolsaActiva) {
      setListadoEducacionModo("bolsa");
    }
  }, [sectorId, listadoEducacionModo, datos.educacionBolsaActiva, datos.educacionDisponiblesActiva]);

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

  const irSeguimientos = () => {
    setPasoSeguimientosOrigen(paso);
    setPaso("seguimientos");
  };

  const irSimuladorGerencia = (puntos, categoria = herramientasCtx.categoria || categoriaActual) => {
    setHerramientasCtx({ puntos, categoria: categoria || "" });
    setPaso("simulador-gerencia");
  };

  const iniciarBusqueda = async (categoria, consulta) => {
    const grupo = grupoDeCategoria(categoria, gruposSanidad);
    setBusquedaGlobal(false);
    setCategoriaActual(categoria);
    setGrupoIdActual(grupo?.id || "diplomado");
    if (!grupo?.activo || !grupo?.id || !capaDatos.tieneDatosReales(categoria, grupo.id)) {
      return -1;
    }
    try {
      const res = await capaDatos.buscarPersonas(grupo.id, categoria, consulta);
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
    if (!capaDatos.buscarGlobal) return 0;
    setBusquedaGlobal(true);
    setCategoriaActual("");
    const res = await capaDatos.buscarGlobal(consulta);
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
            s.candidato.nombreCompleto === resultado.nombreCompleto
        )
      ) {
        return prev;
      }
      return [
        ...prev,
        {
          categoria,
          gerencia,
          ambito: ambito || "",
          grupoId,
          ccaaId: ccaaId || capaDatos.ccaaId,
          candidato: resultado,
        },
      ];
    });
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

      <div className={`max-w-md mx-auto ${paso === "inicio" ? "" : "pb-10"}`}>
        {paso === "inicio" && (
          <PantallaHome
            onConfirmCcaas={irABuscarConCcaas}
            onBuscar={irABuscarUltima}
            onSeguimientos={irSeguimientos}
            onMas={() => setPaso("mas")}
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
            onBuscarGlobal={!modoEducacion && capaDatos.multi ? iniciarBusquedaGlobal : undefined}
            onVerListado={(categoria, gerencia) => {
              const g = grupoDeCategoria(categoria, gruposSanidad);
              setListadoCategoria(categoria);
              setListadoGerencia(gerencia || "");
              setListadoAmbito("");
              setListadoGrupoId(g?.id || (modoEducacion ? "secundaria" : "diplomado"));
              setPantallaPrevia("buscar");
              setPaso("listado");
            }}
            recientes={recientes}
            gruposSanidad={gruposSanidad}
            sectorId={sectorId}
            educacionActiva={datos.educacionActiva}
            educacionBolsaActiva={datos.educacionBolsaActiva}
            educacionDisponiblesActiva={datos.educacionDisponiblesActiva}
            modoEducacion={modoEducacion}
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
            modoListadoEducacion={listadoEducacionModo}
            atras={() => setPaso(pantallaPrevia)}
            onAbrirPersona={(fila, todasLasFilas) => {
              const esEducacionListado = modoEducacion || capaDatos.sector === "educacion";
              setCategoriaActual(listadoCategoria);
              setGrupoIdActual(listadoGrupoId);
              setBusquedaGlobal(false);
              setCandidatoElegido(
                candidatoDesdeFilasListado(fila, todasLasFilas, {
                  categoria: listadoCategoria,
                  grupoId: listadoGrupoId,
                  ccaaId: capaDatos.ccaaId || "clm",
                  esEducacion: esEducacionListado,
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
      </div>
    </div>
    </CcaaCapaProvider>
  );
}
