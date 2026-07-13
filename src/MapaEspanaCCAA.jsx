import { useMemo, useState } from "react";
import { MAPA_ESPANIA } from "./mapa-espana-data.js";

export const SVG_ID_A_CCAA = {
  galicia: "gal",
  asturias: "ast",
  cantabria: "cant",
  "basque-country": "pv",
  navarre: "nav",
  "la-rioja": "rioja",
  aragon: "ar",
  catalonia: "cat",
  valencia: "val",
  "balearic-islands": "bal",
  madrid: "mad",
  "castile-and-leon": "cyl",
  "castile-la-mancha": "clm",
  extremadura: "ext",
  murcia: "mur",
  andalusia: "and",
  "canary-islands": "can",
};

const NOMBRES_CCAA = {
  gal: "Galicia",
  ast: "Asturias",
  cant: "Cantabria",
  pv: "País Vasco",
  nav: "Navarra",
  rioja: "La Rioja",
  ar: "Aragón",
  cat: "Cataluña",
  val: "Comunitat Valenciana",
  bal: "Illes Balears",
  mad: "Comunidad de Madrid",
  cyl: "Castilla y León",
  clm: "Castilla-La Mancha",
  ext: "Extremadura",
  mur: "Región de Murcia",
  and: "Andalucía",
  can: "Canarias",
};

const VIEWBOX = "15 0 575 335";
const CANARIAS_TRANSFORM = "translate(88, 292) scale(2.5) translate(-58, -515)";

/** Colores legacy (pantalla selección antigua). */
const MAP_COLORS = {
  disponible: "#1A7A4C",
  disponibleHover: "#22A364",
  seleccionado: "#E8A830",
  seleccionadoBorde: "#FFF0C2",
  inactivo: "#B5A896",
  inactivoHover: "#9A8F7E",
  borde: "#6B5E4A",
};

function estilosPathHero({ activo, isHover, isClm, C }) {
  if (!activo) {
    return {
      fill: C.paperDeep,
      stroke: C.line,
      strokeWidth: 1.2,
      opacity: 1,
    };
  }
  return {
    fill: isHover ? C.goldSoft : isClm ? C.navyDeep : C.navy,
    stroke: isHover ? C.gold : isClm ? C.navyDeep : C.navy,
    strokeWidth: isHover ? 2 : 1.5,
    opacity: 1,
    filter: isHover ? `drop-shadow(0 0 8px ${C.gold}88)` : undefined,
  };
}

function estilosPathSeleccion({ activo, isHover, isSel }) {
  if (isSel) {
    return {
      fill: MAP_COLORS.seleccionado,
      stroke: MAP_COLORS.seleccionadoBorde,
      strokeWidth: 4,
      opacity: 1,
      filter: "drop-shadow(0 0 10px rgba(232,168,48,0.85)) drop-shadow(0 2px 4px rgba(0,0,0,0.25))",
    };
  }
  if (activo) {
    return {
      fill: isHover ? MAP_COLORS.disponibleHover : MAP_COLORS.disponible,
      stroke: isHover ? "#FFECC0" : "#145A38",
      strokeWidth: isHover ? 2.5 : 1.8,
      opacity: 1,
      filter: isHover ? "drop-shadow(0 0 6px rgba(34,163,100,0.5))" : undefined,
    };
  }
  return {
    fill: isHover ? MAP_COLORS.inactivoHover : MAP_COLORS.inactivo,
    stroke: MAP_COLORS.borde,
    strokeWidth: 1,
    opacity: isHover ? 0.75 : 0.5,
  };
}

function PathCCAA({ loc, ccaaId, activo, isHover, isSel, onHover, onTap, modo, C, isClm }) {
  const st = modo === "hero"
    ? estilosPathHero({ activo, isHover, isClm, C })
    : estilosPathSeleccion({ activo, isHover, isSel });

  return (
    <path
      d={loc.path}
      fill={st.fill}
      stroke={st.stroke}
      strokeWidth={st.strokeWidth}
      opacity={st.opacity}
      style={{
        cursor: activo ? "pointer" : "default",
        transition: "fill 0.15s, stroke 0.15s, opacity 0.15s, filter 0.15s",
        filter: st.filter,
      }}
      onMouseEnter={() => onHover(ccaaId)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onTap(ccaaId)}
    >
      <title>
        {NOMBRES_CCAA[ccaaId]}
        {activo ? "" : " (próximamente)"}
      </title>
    </path>
  );
}

export default function MapaEspanaCCAA({ ccaaList, onConfirm, onSelect, modo = "seleccion", colors: C }) {
  const [hoverId, setHoverId] = useState(null);
  const [seleccionados, setSeleccionados] = useState(() => new Set());
  const [proximamenteId, setProximamenteId] = useState(null);

  const { peninsula, canarias } = useMemo(() => {
    const can = MAPA_ESPANIA.locations.find((l) => l.id === "canary-islands");
    const pen = MAPA_ESPANIA.locations.filter((l) => l.id !== "canary-islands");
    return { peninsula: pen, canarias: can };
  }, []);

  const ccaaPorId = useMemo(
    () => Object.fromEntries(ccaaList.map((c) => [c.id, c])),
    [ccaaList]
  );

  const regionActiva = (ccaaId) => ccaaPorId[ccaaId]?.activo === true;

  const nombresSeleccionados = [...seleccionados].map(
    (id) => ccaaPorId[id]?.nombre || NOMBRES_CCAA[id]
  );

  const etiqueta = (() => {
    if (modo === "hero") return null;
    if (hoverId) return ccaaPorId[hoverId]?.nombre || NOMBRES_CCAA[hoverId];
    if (seleccionados.size === 1) return nombresSeleccionados[0];
    if (seleccionados.size > 1) return `${seleccionados.size} comunidades seleccionadas`;
    return "Toca una o varias comunidades";
  })();

  const tapRegion = (ccaaId) => {
    if (modo === "hero") {
      if (!regionActiva(ccaaId)) {
        setProximamenteId(ccaaId);
        window.setTimeout(() => setProximamenteId(null), 1800);
        return;
      }
      const ccaa = ccaaPorId[ccaaId] || { id: ccaaId, nombre: NOMBRES_CCAA[ccaaId], activo: true };
      onSelect?.(ccaa);
      return;
    }
    if (!regionActiva(ccaaId)) return;
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(ccaaId)) next.delete(ccaaId);
      else next.add(ccaaId);
      return next;
    });
  };

  const confirmar = () => {
    if (seleccionados.size === 0) return;
    const lista = [...seleccionados]
      .filter(regionActiva)
      .map(
        (id) =>
          ccaaPorId[id] || {
            id,
            nombre: NOMBRES_CCAA[id],
            activo: true,
          }
      );
    if (lista.length) onConfirm?.(lista);
  };

  const puedeConfirmar = seleccionados.size > 0 && [...seleccionados].every(regionActiva);

  const textoBoton = (() => {
    if (!puedeConfirmar) return "Seleccionar comunidad";
    if (seleccionados.size === 1) return `Continuar con ${nombresSeleccionados[0]}`;
    return `Continuar con ${seleccionados.size} comunidades`;
  })();

  const renderPath = (loc, ccaaId, extraSel) => {
    const activo = regionActiva(ccaaId);
    const isSel = modo === "seleccion" && (extraSel ?? seleccionados.has(ccaaId));
    const isClm = ccaaId === "clm";
    return (
      <g key={loc.id}>
        {isSel && (
          <path
            d={loc.path}
            fill="none"
            stroke={modo === "hero" ? C.gold : MAP_COLORS.seleccionadoBorde}
            strokeWidth={7}
            opacity={0.9}
            pointerEvents="none"
            style={{ filter: "blur(1px)" }}
          />
        )}
        <PathCCAA
          loc={loc}
          ccaaId={ccaaId}
          activo={activo}
          isHover={hoverId === ccaaId}
          isSel={isSel}
          onHover={setHoverId}
          onTap={tapRegion}
          modo={modo}
          C={C}
          isClm={isClm}
        />
      </g>
    );
  };

  return (
    <div className="flex flex-col" style={{ width: "100%", height: "100%", minHeight: 0, position: "relative" }}>
      {etiqueta && (
        <p
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 15,
            fontWeight: 700,
            color: C.navy,
            textAlign: "center",
            margin: 0,
            height: 28,
            lineHeight: "28px",
            flexShrink: 0,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            padding: "0 8px",
          }}
        >
          {etiqueta}
        </p>
      )}

      {modo === "seleccion" && seleccionados.size > 1 && (
        <p
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 11,
            color: C.inkSoft,
            textAlign: "center",
            margin: "4px 8px 0",
            lineHeight: 1.35,
            flexShrink: 0,
          }}
        >
          {nombresSeleccionados.join(" · ")}
        </p>
      )}

      <div style={{ flex: 1, minHeight: 0, width: "100%" }}>
        <svg
          viewBox={VIEWBOX}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Mapa de España por comunidades autónomas"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          {peninsula.map((loc) => {
            const ccaaId = SVG_ID_A_CCAA[loc.id];
            if (!ccaaId) return null;
            return renderPath(loc, ccaaId);
          })}

          {modo === "seleccion" && seleccionados.size === 0 &&
            peninsula
              .filter((l) => l.id === "castile-la-mancha")
              .map((loc) => (
                <path
                  key="clm-hint"
                  d={loc.path}
                  fill="none"
                  stroke={MAP_COLORS.disponibleHover}
                  strokeWidth={2.5}
                  strokeDasharray="8 5"
                  opacity={0.85}
                  pointerEvents="none"
                />
              ))}

          {canarias && (
            <g transform={CANARIAS_TRANSFORM}>
              {renderPath(canarias, "can", modo === "seleccion" && seleccionados.has("can"))}
            </g>
          )}

          {modo === "hero" && (
            <text
              x={88}
              y={328}
              textAnchor="middle"
              style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fill: C.inkSoft, pointerEvents: "none" }}
            >
              Canarias
            </text>
          )}
        </svg>
      </div>

      {modo === "hero" && proximamenteId && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 8,
            transform: "translateX(-50%)",
            background: C.card,
            border: `1px solid ${C.line}`,
            borderRadius: 20,
            padding: "6px 14px",
            fontFamily: "'Inter', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: C.inkSoft,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          {NOMBRES_CCAA[proximamenteId]} — Próximamente
        </div>
      )}

      {modo === "seleccion" && (
        <>
          <p
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 11,
              color: C.inkSoft,
              textAlign: "center",
              margin: "8px 0 0",
              flexShrink: 0,
            }}
          >
            Vuelve a tocar una región para quitarla de la selección
          </p>
          <button
            type="button"
            onClick={confirmar}
            disabled={!puedeConfirmar}
            className="w-full font-bold focus:outline-none flex-shrink-0"
            style={{
              marginTop: 10,
              background: puedeConfirmar ? C.navy : C.paperDeep,
              color: puedeConfirmar ? "#fff" : C.inkSoft,
              padding: "16px",
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 15,
              borderRadius: "16px 5px 16px 5px",
              border: puedeConfirmar ? `2px solid ${C.gold}` : `1.5px solid ${C.line}`,
              cursor: puedeConfirmar ? "pointer" : "default",
              opacity: puedeConfirmar ? 1 : 0.7,
            }}
          >
            {textoBoton}
          </button>
        </>
      )}
    </div>
  );
}
