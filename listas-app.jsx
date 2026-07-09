import { useState, useMemo } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { Search, ChevronLeft, Bell, BellRing, Lock, MapPin, Stethoscope, GraduationCap, Landmark, TrendingUp, Users, AlertTriangle, List as ListIcon, UserCheck, Smartphone, History, ShieldAlert, Info, PhoneCall } from "lucide-react";
import { useDatos } from "./src/datos.jsx";

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
  { id: "clm", nombre: "Castilla-La Mancha", activo: true },
  { id: "mad", nombre: "Madrid", activo: false },
  { id: "and", nombre: "Andalucía", activo: false },
  { id: "cat", nombre: "Cataluña", activo: false },
  { id: "val", nombre: "C. Valenciana", activo: false },
  { id: "gal", nombre: "Galicia", activo: false },
  { id: "pv", nombre: "País Vasco", activo: false },
  { id: "cyl", nombre: "Castilla y León", activo: false },
];

const SECTORES = [
  { id: "sanidad", nombre: "Sanidad", icono: Stethoscope, activo: true, fuente: "SESCAM · Bolsa única SELECTA" },
  { id: "educacion", nombre: "Educación", icono: GraduationCap, activo: false, fuente: "Próximamente" },
  { id: "administracion", nombre: "Administración General", icono: Landmark, activo: false, fuente: "Próximamente" },
];

// Los 5 grupos profesionales del SESCAM. Solo "diplomado" tiene scraper
// funcionando con datos reales; el resto son categorías de EJEMPLO (aún sin
// extraer del portal) y se muestran como "sin scraping activo".
const GRUPOS_SANIDAD = [
  {
    id: "diplomado",
    nombre: "Personal Sanitario Diplomado",
    activo: true,
    categorias: ["Enfermero/a", "Fisioterapeuta", "Logopeda", "Óptico-Optometrista", "Podólogo/a", "Terapeuta Ocupacional", "Dietista-Nutricionista"],
  },
  {
    id: "facultativo",
    nombre: "Personal Facultativo",
    activo: false,
    categorias: ["Médico de Familia", "Pediatra de Atención Primaria", "Facultativo Especialista de Área"],
  },
  {
    id: "licenciados",
    nombre: "Personal Sanitario Licenciado",
    activo: false,
    categorias: ["Farmacéutico/a de Atención Primaria", "Psicólogo/a Clínico"],
  },
  {
    id: "tecnico",
    nombre: "Personal Sanitario Técnico",
    activo: false,
    categorias: ["TCAE", "Técnico de Laboratorio", "Técnico de Radiodiagnóstico", "Técnico de Farmacia"],
  },
  {
    id: "gestion",
    nombre: "Personal de Gestión y Servicios",
    activo: false,
    categorias: ["Auxiliar Administrativo", "Celador/a", "Pinche", "Telefonista"],
  },
];

const grupoDeCategoria = (categoria) => GRUPOS_SANIDAD.find((g) => g.categorias.includes(categoria));

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
  "Tomelloso",
  "Valdepeñas",
  "Villarrobledo",
];

// ---------------------------------------------------------------
// GENERACIÓN DE DATOS DE EJEMPLO
// ---------------------------------------------------------------

// listado completo simulado (así se vería el scraper ya montado) — se busca por apellidos, como hace el SESCAM
const NOMBRES = ["Ana", "Laura", "Carlos", "Elena", "Javier", "Marta", "Alberto", "Cristina", "Pablo", "Lucía", "Diego", "Rocío", "Sergio", "Beatriz", "Manuel"];
const APELLIDOS = ["García", "Martínez", "López", "Sánchez", "Pérez", "Gómez", "Fernández", "Ruiz", "Díaz", "Moreno", "Muñoz", "Álvarez", "Romero", "Navarro", "Torres", "Domínguez"];

const LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";
const TIPOS_CONTRATO = ["Larga TC.", "Larga TP.", "Corta TC.", "Corta TP.", "C.U. TC.", "C.U. TP."];

function generarListadoCompletoEjemplo(categoria, gerencia = "") {
  const seed = (categoria + "·" + gerencia).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const total = 2100 + (seed % 900);
  const filas = [];
  for (let i = 1; i <= 60; i++) {
    const puntos = (95 - i * 1.55 + ((seed + i) % 5) * 0.3).toFixed(2);
    const nombre = NOMBRES[(seed + i * 3) % NOMBRES.length];
    const ap1 = APELLIDOS[(seed + i * 5) % APELLIDOS.length];
    const ap2 = APELLIDOS[(seed + i * 7 + 3) % APELLIDOS.length];
    const cifras = String((seed * i * 41) % 9000 + 1000);
    const dniParcial = `****${cifras}${LETRAS_DNI[(seed + i) % LETRAS_DNI.length]}`;
    const tiposContrato = {};
    TIPOS_CONTRATO.forEach((t, idx) => { tiposContrato[t] = ((seed + i + idx) % 3) !== 0; });
    filas.push({
      pos: i, nombre, ap1, ap2, nombreCompleto: `${nombre} ${ap1} ${ap2}`,
      puntos: parseFloat(puntos), total, dniParcial, tiposContrato,
    });
  }
  return filas;
}

const TODAS_GERENCIAS = "Todas las gerencias";

// busca coincidencias por apellido(s) — versión de ejemplo (grupos sin scraper)
function buscarPorApellidoEjemplo(categoria, gerencia, apellidos) {
  const filas = generarListadoCompletoEjemplo(categoria, gerencia);
  const q = apellidos.trim().toLowerCase();
  if (!q) return [];
  return filas.filter((f) => `${f.ap1} ${f.ap2}`.toLowerCase().includes(q));
}

function buscarPersonasEjemplo(categoria, gerencia, apellidos, gerencias) {
  const gs = gerencia === TODAS_GERENCIAS ? gerencias : [gerencia];
  const porPersona = new Map();
  gs.forEach((g) => {
    buscarPorApellidoEjemplo(categoria, g, apellidos).forEach((f) => {
      if (!porPersona.has(f.nombreCompleto)) {
        porPersona.set(f.nombreCompleto, { nombre: f.nombre, ap1: f.ap1, ap2: f.ap2, nombreCompleto: f.nombreCompleto, dniParcial: f.dniParcial, apariciones: [] });
      }
      porPersona.get(f.nombreCompleto).apariciones.push({ gerencia: g, ...filaAResultado(f) });
    });
  });
  return [...porPersona.values()];
}

function filaAResultado(fila) {
  return {
    posicion: fila.pos, total: fila.total, puntos: fila.puntos, delante: fila.pos - 1,
    nombreCompleto: fila.nombreCompleto, dniParcial: fila.dniParcial, tiposContrato: fila.tiposContrato,
  };
}

// histórico simulado del punto de corte oficial en las últimas convocatorias (esto sí sería scrapeable de verdad, guardando cada publicación del SESCAM)
// Nº mínimo de publicaciones guardadas para atrevernos a estimar tendencia.
// El día del lanzamiento habrá 1 sola: la app debe degradar con honestidad,
// no inventar una pendiente con un único punto.
const MIN_HISTORICO_TENDENCIA = 3;

function historialCorteEjemplo(categoria, gerencia = "") {
  const seed = (categoria + "·" + gerencia).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const fechas = ["oct 2024", "feb 2025", "jun 2025", "oct 2025", "feb 2026", "jun 2026"];
  const base = (60 + (seed % 30)) / 10 + 2.8;
  const completo = fechas.map((fecha, i) => ({
    fecha,
    puntos: parseFloat((base - i * (0.22 + ((seed + i) % 4) * 0.05)).toFixed(2)),
  }));
  // Simulación del "día 1": Logopeda solo tiene una publicación guardada,
  // para poder ver en el prototipo cómo se comporta la app sin histórico.
  if (categoria === "Logopeda") return completo.slice(-1);
  return completo;
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

function estadoActualizacionEjemplo(categoria) {
  const grupo = grupoDeCategoria(categoria);
  if (grupo && !grupo.activo) {
    return { tipo: "sin_activar", texto: `El scraping del grupo ${grupo.nombre} todavía no está activado. Los datos mostrados son de ejemplo.` };
  }
  return { tipo: "ok", texto: "Datos de ejemplo del prototipo." };
}

// ---------------------------------------------------------------
// PIEZAS
// ---------------------------------------------------------------
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

function AvisoActualizacion({ categoria }) {
  const datos = useDatos();
  const grupo = grupoDeCategoria(categoria);
  const e = grupo?.activo && datos.tieneDatosReales(categoria)
    ? datos.estadoActualizacion(categoria, true)
    : estadoActualizacionEjemplo(categoria);
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
// PANTALLA 1 — elegir comunidad
// ---------------------------------------------------------------
function PantallaCCAA({ onSelect }) {
  return (
    <div>
      <div className="px-5 pt-8 pb-2">
        <Sello>Expediente nacional · 17 CC. AA.</Sello>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 600, color: C.navy, lineHeight: 1.15, marginTop: 16 }}>
          Tu posición,<br />
          sin adivinar<span style={{ color: C.clay }}>.</span>
        </h1>
        <Subrayado width={132} style={{ marginLeft: 2 }} />
        <p style={{ fontFamily: FONT_BODY, fontSize: 15, color: C.inkSoft, marginTop: 6, maxWidth: 320 }}>
          Consulta tu lugar en las listas de interinos de sanidad, educación y administración. Elige tu comunidad para empezar.
        </p>
      </div>

      <div className="px-5 mt-5 grid grid-cols-2 gap-3">
        {CCAA.map((c, i) => (
          <button
            key={c.id}
            onClick={() => c.activo && onSelect(c)}
            disabled={!c.activo}
            className="text-left focus:outline-none focus:ring-2"
            style={{
              background: c.activo ? C.navy : C.card,
              border: `1px solid ${c.activo ? C.navy : C.line}`,
              borderRadius: i % 2 === 0 ? "16px 6px 16px 6px" : "6px 16px 6px 16px",
              padding: "16px 14px",
              opacity: c.activo ? 1 : 0.62,
              cursor: c.activo ? "pointer" : "default",
              transform: c.activo ? "rotate(-0.4deg)" : "none",
            }}
          >
            <MapPin size={16} color={c.activo ? C.goldSoft : C.inkSoft} />
            <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: c.activo ? "#fff" : C.ink, marginTop: 8 }}>{c.nombre}</p>
            <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: c.activo ? C.goldSoft : C.inkSoft, marginTop: 4 }}>
              {c.activo ? "DISPONIBLE" : "PRÓXIMAMENTE"}
            </p>
          </button>
        ))}
      </div>

      <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, textAlign: "center", margin: "22px 5px 0" }}>
        Empezamos por Castilla-La Mancha. El resto de comunidades se irán añadiendo.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------
// PANTALLA 2 — elegir sector
// ---------------------------------------------------------------
function PantallaSector({ ccaa, onSelect, atras }) {
  return (
    <div>
      <Barra titulo={ccaa.nombre} atras={atras} />
      <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.inkSoft, padding: "0 20px" }}>¿Qué lista quieres consultar?</p>

      <div className="px-5 mt-4 flex flex-col gap-3">
        {SECTORES.map((s) => {
          const Icono = s.icono;
          return (
            <button
              key={s.id}
              onClick={() => s.activo && onSelect(s)}
              disabled={!s.activo}
              className="text-left rounded-2xl focus:outline-none focus:ring-2 flex items-center gap-4"
              style={{
                background: C.card,
                border: `1.5px solid ${s.activo ? C.navy : C.line}`,
                padding: "18px 16px",
                opacity: s.activo ? 1 : 0.6,
              }}
            >
              <div className="rounded-xl flex items-center justify-center" style={{ width: 46, height: 46, background: s.activo ? C.navy : C.paperDeep }}>
                <Icono size={22} color={s.activo ? C.goldSoft : C.inkSoft} />
              </div>
              <div className="flex-1">
                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: C.navy }}>{s.nombre}</p>
                <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{s.fuente}</p>
              </div>
              {!s.activo && <Candado label="Pronto" />}
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
function PantallaBuscar({ atras, onBuscar, onVerListado, recientes }) {
  const datos = useDatos();
  const [grupoId, setGrupoId] = useState(GRUPOS_SANIDAD[0].id);
  const grupo = GRUPOS_SANIDAD.find((g) => g.id === grupoId);
  const gerencias = grupo?.activo && datos.GERENCIAS.length ? datos.GERENCIAS : GERENCIAS_EJEMPLO;
  const [categoria, setCategoria] = useState(GRUPOS_SANIDAD[0].categorias[0]);
  const [gerencia, setGerencia] = useState(TODAS_GERENCIAS);
  const [apellidos, setApellidos] = useState("");
  const [sinResultados, setSinResultados] = useState(false);

  const cambiarGrupo = (id) => {
    const g = GRUPOS_SANIDAD.find((x) => x.id === id);
    setGrupoId(id);
    setCategoria(g.categorias[0]);
    setSinResultados(false);
  };

  const buscar = (cat, ger, ape) => {
    const encontrados = onBuscar(cat, ger, ape);
    setSinResultados(encontrados === 0);
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
                    const g = grupoDeCategoria(rec.categoria);
                    if (g) setGrupoId(g.id);
                    setCategoria(rec.categoria);
                    setGerencia(rec.gerencia);
                    setApellidos(rec.apellidos);
                    buscar(rec.categoria, rec.gerencia, rec.apellidos);
                  }}
                  className="focus:outline-none"
                  style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, padding: "6px 12px", fontFamily: FONT_BODY, fontSize: 12, color: C.navy }}
                >
                  {rec.apellidos} · {rec.categoria} · {rec.gerencia}
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
            {GRUPOS_SANIDAD.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}{g.activo ? "" : " · datos de ejemplo"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.ink }}>Categoría</label>
          <select
            value={categoria}
            onChange={(e) => { setCategoria(e.target.value); setSinResultados(false); }}
            className="w-full mt-2 focus:outline-none"
            style={{ border: `1.5px solid ${C.line}`, background: C.card, padding: "13px 14px", fontFamily: FONT_BODY, fontSize: 15, color: C.ink }}
          >
            {grupo.categorias.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.ink }}>Gerencia</label>
          <select
            value={gerencia}
            onChange={(e) => { setGerencia(e.target.value); setSinResultados(false); }}
            className="w-full mt-2 focus:outline-none"
            style={{ border: `1.5px solid ${C.line}`, background: C.card, padding: "13px 14px", fontFamily: FONT_BODY, fontSize: 15, color: C.ink }}
          >
            {[TODAS_GERENCIAS, ...gerencias].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, marginTop: 6 }}>
            No hace falta elegir: buscamos en las 13 gerencias y te enseñamos una tarjeta por cada lista en la que aparezcas. Filtra solo si quieres una concreta.
          </p>
        </div>

        <div>
          <label style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.ink }}>Tus apellidos</label>
          <input
            value={apellidos}
            onChange={(e) => { setApellidos(e.target.value); setSinResultados(false); }}
            placeholder="Ej. García Martínez"
            className="w-full mt-2 focus:outline-none"
            style={{ border: `1.5px solid ${C.line}`, background: C.card, padding: "13px 14px", fontFamily: FONT_BODY, fontSize: 15, color: C.ink }}
          />
          <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, marginTop: 6 }}>
            Así es como el SESCAM publica el listado: por nombre y apellidos, no por DNI. No te pedimos ni guardamos tu DNI en ningún momento.
          </p>
        </div>

        <button
          onClick={() => buscar(categoria, gerencia, apellidos)}
          className="w-full font-bold focus:outline-none flex items-center justify-center gap-2"
          style={{ background: C.navy, color: "#fff", padding: "15px", fontFamily: FONT_BODY, fontSize: 15, borderRadius: "16px 5px 16px 5px" }}
        >
          <Search size={16} /> Buscar en la lista
        </button>

        {sinResultados && (
          <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
            <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
              No encontramos ese apellido en {gerencia === TODAS_GERENCIAS ? `ninguna gerencia para ${categoria}` : `el listado de ${categoria} · ${gerencia}`}. Comprueba cómo lo has escrito, o puede que aún no estés incluido en esta bolsa.
            </p>
          </div>
        )}

        <button
          onClick={() => onVerListado(categoria, gerencia === TODAS_GERENCIAS ? gerencias[0] : gerencia)}
          className="w-full font-bold focus:outline-none flex items-center justify-center gap-2"
          style={{ background: "transparent", color: C.navy, padding: "12px", fontFamily: FONT_BODY, fontSize: 13.5, border: `1.5px solid ${C.line}`, borderRadius: "5px 16px 5px 16px" }}
        >
          <ListIcon size={15} /> Ver el listado completo de esta categoría
        </button>

        <AvisoActualizacion categoria={categoria} />
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
        Encontramos {candidatos.length} personas con ese apellido en las listas de {categoria}. Toca tu nombre — si dudas, el listado real también muestra los últimos dígitos del DNI para confirmar.
      </p>

      <div className="px-5 mt-4 flex flex-col gap-3">
        {candidatos.map((c, i) => (
          <button
            key={i}
            onClick={() => onElegir(c)}
            className="text-left flex items-center gap-3 focus:outline-none focus:ring-2"
            style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: i % 2 === 0 ? "16px 6px 16px 6px" : "6px 16px 6px 16px", padding: "14px 16px" }}
          >
            <UserCheck size={18} color={C.navy} />
            <div>
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy }}>{c.nombreCompleto}</p>
              <p style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.inkSoft }}>
                En {c.apariciones.length} gerencia{c.apariciones.length > 1 ? "s" : ""} · mejor posición #{Math.min(...c.apariciones.map((a) => a.posicion))} · DNI {c.dniParcial}
              </p>
            </div>
          </button>
        ))}
      </div>

      <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, padding: "16px 20px 0" }}>
        Si no te encuentras, vuelve atrás y prueba con el nombre de pila incluido, o revisa que el apellido esté bien escrito.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------
// PANTALLA 3C — listado completo de la categoría
// ---------------------------------------------------------------
function PantallaListado({ categoria, gerencia, atras }) {
  const datos = useDatos();
  const grupo = grupoDeCategoria(categoria);
  const [filtro, setFiltro] = useState("");
  const LIMITE_FILAS = 100;
  const filas = useMemo(() => {
    if (grupo?.activo && datos.tieneDatosReales(categoria)) {
      return datos.obtenerListadoCompleto(categoria, gerencia);
    }
    return generarListadoCompletoEjemplo(categoria, gerencia);
  }, [datos, categoria, gerencia, grupo]);
  const visibles = filtro ? filas.filter((f) => f.nombreCompleto.toLowerCase().includes(filtro.toLowerCase())) : filas;
  const mostradas = visibles.slice(0, LIMITE_FILAS);
  const esReal = grupo?.activo && datos.tieneDatosReales(categoria);

  return (
    <div>
      <Barra titulo={`${categoria} · ${gerencia}`} atras={atras} />
      <div className="px-5">
        <AvisoActualizacion categoria={categoria} />

        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar por nombre o apellido…"
          className="w-full mt-3 focus:outline-none"
          style={{ border: `1.5px solid ${C.line}`, background: C.card, padding: "11px 14px", fontFamily: FONT_BODY, fontSize: 13.5, color: C.ink }}
        />
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
        <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, margin: "8px 0 16px" }}>
          {esReal
            ? `Mostrando ${mostradas.length} de ${visibles.length} filas${visibles.length > LIMITE_FILAS ? ` (límite ${LIMITE_FILAS}; usa el buscador para acotar)` : ""}.`
            : "Vista de ejemplo con 60 filas. En producción se mostrarían las miles de personas reales de la bolsa, con scroll o paginación."}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// PANTALLA 4 — resultado: una tarjeta por gerencia, deslizables
// ---------------------------------------------------------------

// Bloque de detalle de UNA gerencia (posición, puntos, contratos, corte y avisos)
function TarjetaGerencia({ categoria, gerencia, r, guardado, onGuardar, onVerListado, onInfoLlamamientos }) {
  const datos = useDatos();
  const grupo = grupoDeCategoria(categoria);
  const [notifEstado, setNotifEstado] = useState(guardado ? "activo" : "inicial");
  const percentil = Math.round((1 - r.posicion / r.total) * 100);
  const historial = grupo?.activo && datos.tieneDatosReales(categoria)
    ? datos.historialCorte(categoria, gerencia)
    : historialCorteEjemplo(categoria, gerencia);

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

        <Sello>{categoria} · {gerencia}</Sello>
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
      <AvisoActualizacion categoria={categoria} />

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
                Aún no hay histórico guardado para esta categoría y gerencia. Se irá acumulando con cada actualización del scraper.
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
            <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.ink }}>Distancia al último llamamiento</p>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
              DATO OFICIAL · último corte conocido: {ult.puntos.toFixed(2)} puntos ({ult.fecha})
            </p>
            <div style={{ height: 8, background: C.paperDeep, borderRadius: 6, marginTop: 12, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: yaLlamado ? C.ok : C.clay, borderRadius: 6 }} />
            </div>
            <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: yaLlamado ? C.ok : C.clay, fontWeight: 700, marginTop: 10 }}>
              {yaLlamado
                ? `Tu puntuación ya supera el último punto de corte por ${Math.abs(diff)} puntos.`
                : `Te faltan ${Math.abs(diff)} puntos para alcanzar el último punto de corte.`}
            </p>

            {hayTendencia ? (
              <>
                <div style={{ height: 52, marginTop: 14 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historial}>
                      <YAxis hide domain={["dataMin - 0.5", "dataMax + 0.5"]} />
                      <Line type="monotone" dataKey="puntos" stroke={C.gold} strokeWidth={2.5} dot={{ r: 2.5, fill: C.navy }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
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
          <Bell size={16} /> Seguir esta gerencia y activar avisos
        </button>
      )}

      {notifEstado === "pidiendo" && (
        <div style={{ background: C.card, border: `1.5px solid ${C.navy}`, borderRadius: "10px 20px 10px 20px", padding: 16, marginTop: 16 }}>
          <div className="flex items-center gap-3">
            <Smartphone size={20} color={C.navy} />
            <div>
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy }}>Permitir notificaciones</p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                Te avisaremos cuando cambie tu posición en {categoria} · {gerencia}. <strong style={{ color: C.clay }}>Esto no sustituye la llamada oficial del SESCAM</strong> — esa te la hacen ellos directamente, y tienes horas contadas para responder.
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
          <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5, color: C.ok }}>Siguiendo {gerencia} — te avisaremos</p>
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

// Contenedor: una tarjeta por gerencia donde aparece la persona, con
// scroll horizontal + snap (deslizar en móvil) y puntos indicadores.
function PantallaResultado({ categoria, candidato, atras, estaGuardado, onGuardar, onVerListado, onInfoLlamamientos }) {
  const apariciones = candidato.apariciones;
  const [indice, setIndice] = useState(0);
  const varias = apariciones.length > 1;

  const alDesplazar = (e) => {
    const el = e.currentTarget;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== indice) setIndice(Math.min(apariciones.length - 1, Math.max(0, i)));
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
            Apareces en {apariciones.length} gerencias — desliza para ver cada una.
          </p>
        )}
      </div>

      {/* carrusel de tarjetas, una por gerencia */}
      <div
        onScroll={varias ? alDesplazar : undefined}
        style={{
          display: "flex",
          overflowX: varias ? "auto" : "visible",
          scrollSnapType: varias ? "x mandatory" : "none",
          scrollbarWidth: "none",
          gap: 0,
          marginTop: 8,
        }}
      >
        {apariciones.map((a) => (
          <div
            key={a.gerencia}
            style={{ flex: "0 0 100%", scrollSnapAlign: "start", padding: "0 20px", boxSizing: "border-box" }}
          >
            <TarjetaGerencia
              categoria={categoria}
              gerencia={a.gerencia}
              r={a}
              guardado={estaGuardado(a.gerencia, candidato.nombreCompleto)}
              onGuardar={() => onGuardar(a.gerencia, { ...a, nombreCompleto: candidato.nombreCompleto, dniParcial: candidato.dniParcial })}
              onVerListado={() => onVerListado(a.gerencia)}
              onInfoLlamamientos={onInfoLlamamientos}
            />
          </div>
        ))}
      </div>

      {varias && (
        <div className="flex items-center justify-center gap-2" style={{ marginTop: 14 }}>
          {apariciones.map((a, i) => (
            <span
              key={a.gerencia}
              aria-label={a.gerencia}
              style={{
                width: i === indice ? 22 : 7,
                height: 7,
                borderRadius: 6,
                background: i === indice ? C.navy : C.line,
                transition: "width .2s ease, background .2s ease",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
// ---------------------------------------------------------------
// PANTALLA — Mis seguimientos (varias listas a la vez)
// ---------------------------------------------------------------
function PantallaSeguimientos({ seguimientos, atras, onAbrir }) {
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
            const grupo = grupoDeCategoria(s.categoria);
            const e = grupo?.activo && datos.tieneDatosReales(s.categoria)
              ? datos.estadoActualizacion(s.categoria, true)
              : estadoActualizacionEjemplo(s.categoria);
            return (
              <button
                key={i}
                onClick={() => onAbrir(s)}
                className="text-left focus:outline-none focus:ring-2"
                style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: i % 2 === 0 ? "16px 6px 16px 6px" : "6px 16px 6px 16px", padding: "16px 18px" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy }}>{s.categoria} · {s.gerencia}</p>
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
  const gerenciasActivas = datos.GERENCIAS.length ? datos.GERENCIAS : GERENCIAS_EJEMPLO;
  const [paso, setPaso] = useState("ccaa"); // ccaa | sector | buscar | confirmar | resultado | listado | seguimientos | info-llamamientos
  const [ccaa, setCcaa] = useState(null);
  const [sector, setSector] = useState(null);
  const [categoriaActual, setCategoriaActual] = useState("");
  const [candidatos, setCandidatos] = useState([]);
  const [candidatoElegido, setCandidatoElegido] = useState(null);
  const [seguimientos, setSeguimientos] = useState([]);
  const [recientes, setRecientes] = useState([]);
  const [listadoCategoria, setListadoCategoria] = useState(GRUPOS_SANIDAD[0].categorias[0]);
  const [listadoGerencia, setListadoGerencia] = useState(gerenciasActivas[0]);
  const [pantallaPrevia, setPantallaPrevia] = useState("buscar");

  // devuelve cuántas personas hubo, para que PantallaBuscar sepa si mostrar "sin resultados"
  const iniciarBusqueda = (categoria, gerencia, apellidos) => {
    const grupo = grupoDeCategoria(categoria);
    const personas = grupo?.activo && datos.tieneDatosReales(categoria)
      ? datos.buscarPersonas(categoria, gerencia, apellidos, TODAS_GERENCIAS, gerenciasActivas)
      : buscarPersonasEjemplo(categoria, gerencia, apellidos, gerenciasActivas);
    setCategoriaActual(categoria);
    if (apellidos.trim()) {
      setRecientes((prev) => {
        const sinDuplicado = prev.filter((r) => !(r.categoria === categoria && r.gerencia === gerencia && r.apellidos === apellidos));
        return [{ categoria, gerencia, apellidos }, ...sinDuplicado].slice(0, 4);
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

  const estaGuardado = (categoria, gerencia, nombreCompleto) => seguimientos.some((s) => s.categoria === categoria && s.gerencia === gerencia && s.candidato.nombreCompleto === nombreCompleto);

  const guardarSeguimiento = (gerencia, resultado) => {
    setSeguimientos((prev) => {
      if (prev.some((s) => s.categoria === categoriaActual && s.gerencia === gerencia && s.candidato.nombreCompleto === resultado.nombreCompleto)) return prev;
      return [...prev, { categoria: categoriaActual, gerencia, candidato: resultado }];
    });
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: C.paper, backgroundImage: `url("${GRAIN}")`, fontFamily: FONT_BODY, color: C.ink }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        button { cursor: pointer; transition: transform .08s ease, opacity .15s ease; }
        button:not(:disabled):active { transform: scale(.98); }
        select, input { font-family: inherit; border-radius: 14px 5px 14px 5px !important; }
        *:focus-visible { outline: none; box-shadow: 0 0 0 3px ${C.gold}66; }
        @media (prefers-reduced-motion: reduce) { button { transition: none; } }
      `}</style>

      <div className="max-w-md mx-auto pb-10">
        {paso !== "ccaa" && seguimientos.length > 0 && (
          <div className="flex justify-end px-5 pt-4">
            <button
              onClick={() => setPaso("seguimientos")}
              className="flex items-center gap-1.5 focus:outline-none"
              style={{ background: C.navy, color: "#fff", padding: "7px 13px", borderRadius: "12px 4px 12px 4px", fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700 }}
            >
              <BellRing size={13} /> {seguimientos.length}
            </button>
          </div>
        )}

        {paso === "ccaa" && <PantallaCCAA onSelect={(c) => { setCcaa(c); setPaso("sector"); }} />}

        {paso === "sector" && (
          <PantallaSector ccaa={ccaa} atras={() => setPaso("ccaa")} onSelect={(s) => { setSector(s); setPaso("buscar"); }} />
        )}

        {paso === "buscar" && (
          <PantallaBuscar
            atras={() => setPaso("sector")}
            onBuscar={iniciarBusqueda}
            onVerListado={(categoria, gerencia) => { setListadoCategoria(categoria); setListadoGerencia(gerencia); setPantallaPrevia("buscar"); setPaso("listado"); }}
            recientes={recientes}
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
            candidato={candidatoElegido}
            atras={() => setPaso("buscar")}
            estaGuardado={(gerencia, nombre) => estaGuardado(categoriaActual, gerencia, nombre)}
            onGuardar={guardarSeguimiento}
            onVerListado={(gerencia) => { setListadoCategoria(categoriaActual); setListadoGerencia(gerencia); setPantallaPrevia("resultado"); setPaso("listado"); }}
            onInfoLlamamientos={() => setPaso("info-llamamientos")}
          />
        )}

        {paso === "info-llamamientos" && (
          <PantallaInfoLlamamientos atras={() => setPaso("resultado")} />
        )}

        {paso === "listado" && (
          <PantallaListado categoria={listadoCategoria} gerencia={listadoGerencia} atras={() => setPaso(pantallaPrevia)} />
        )}

        {paso === "seguimientos" && (
          <PantallaSeguimientos
            seguimientos={seguimientos}
            atras={() => setPaso("buscar")}
            onAbrir={(s) => {
              setCategoriaActual(s.categoria);
              setCandidatoElegido({
                nombreCompleto: s.candidato.nombreCompleto,
                dniParcial: s.candidato.dniParcial,
                apariciones: [{ gerencia: s.gerencia, ...s.candidato }],
              });
              setPaso("resultado");
            }}
          />
        )}

        <AvisoLegal />
      </div>
    </div>
  );
}
