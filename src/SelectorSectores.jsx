import { useState } from "react";
import { Lock } from "lucide-react";

const TEMA_SECTOR = {
  sanidad: {
    fondo: "#1A7A4C",
    fondoHover: "#22A364",
    seleccionado: "#E8A830",
    bordeSel: "#FFF0C2",
    tinta: "#FFFFFF",
    subtinta: "#C8EDD8",
  },
  educacion: {
    fondo: "#9A6B12",
    fondoHover: "#B8841A",
    seleccionado: "#E8A830",
    bordeSel: "#FFF0C2",
    tinta: "#FFFFFF",
    subtinta: "#F5E6C8",
  },
  administracion: {
    fondo: "#3D5A73",
    fondoHover: "#4E7190",
    seleccionado: "#E8A830",
    bordeSel: "#FFF0C2",
    tinta: "#FFFFFF",
    subtinta: "#C8D8E8",
  },
};

function PanelSector({ sector, activo, isHover, isSel, onHover, onTap, colors: C }) {
  const tema = TEMA_SECTOR[sector.id] || TEMA_SECTOR.sanidad;
  const Icono = sector.icono;

  let bg = activo ? (isHover ? tema.fondoHover : tema.fondo) : C.paperDeep;
  let color = activo ? tema.tinta : C.inkSoft;
  let subColor = activo ? tema.subtinta : C.inkSoft;
  let border = isSel ? tema.bordeSel : isHover && activo ? "#FFECC0" : activo ? tema.fondo : C.line;
  let borderWidth = isSel ? 3 : isHover && activo ? 2 : 1.5;
  let opacity = activo ? 1 : 0.62;
  let shadow = isSel
    ? "0 0 18px rgba(232,168,48,0.55), 0 4px 12px rgba(0,0,0,0.15)"
    : isHover && activo
      ? "0 0 10px rgba(34,163,100,0.35)"
      : "0 2px 6px rgba(32,40,31,0.08)";

  if (isSel && activo) {
    bg = tema.seleccionado;
    color = C.navyDeep;
    subColor = C.navy;
    border = tema.bordeSel;
    borderWidth = 4;
  }

  return (
    <button
      type="button"
      onClick={() => onTap(sector.id)}
      onMouseEnter={() => onHover(sector.id)}
      onMouseLeave={() => onHover(null)}
      disabled={!activo}
      className="relative w-full text-left focus:outline-none flex flex-col justify-center overflow-hidden"
      style={{
        flex: 1,
        minHeight: 0,
        background: bg,
        border: `${borderWidth}px solid ${border}`,
        borderRadius: sector.id === "sanidad" ? "18px 6px 18px 6px" : sector.id === "educacion" ? "6px 18px 6px 18px" : "14px",
        padding: "20px 18px 18px 22px",
        opacity,
        cursor: activo ? "pointer" : "default",
        boxShadow: shadow,
        transition: "background 0.15s, border 0.15s, box-shadow 0.15s, opacity 0.15s",
      }}
    >
      {/* Esquina doblada — expediente */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 28,
          height: 28,
          background: activo ? "rgba(255,255,255,0.22)" : C.line,
          clipPath: "polygon(100% 0, 0 0, 100% 100%)",
        }}
      />

      {!activo && (
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(243,240,230,0.45)", pointerEvents: "none" }}
        >
          <span
            className="inline-flex items-center gap-1.5 rounded-full"
            style={{
              background: C.card,
              border: `1px solid ${C.line}`,
              padding: "6px 12px",
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              color: C.inkSoft,
            }}
          >
            <Lock size={13} /> Próximamente
          </span>
        </span>
      )}

      <div className="flex items-center gap-4 relative z-10">
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 52,
            height: 52,
            borderRadius: "12px 4px 12px 4px",
            background: activo ? "rgba(255,255,255,0.2)" : C.card,
            border: activo ? "1px solid rgba(255,255,255,0.35)" : `1px solid ${C.line}`,
          }}
        >
          <Icono size={26} color={activo ? (isSel ? C.navyDeep : "#fff") : C.inkSoft} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            style={{
              fontFamily: "'Fraunces', serif",
              fontWeight: 600,
              fontSize: 22,
              color,
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            {sector.nombre}
          </p>
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: subColor,
              marginTop: 6,
              opacity: 0.95,
            }}
          >
            {sector.fuente}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function SelectorSectores({ sectores, onConfirm, colors: C }) {
  const [hoverId, setHoverId] = useState(null);

  const sectorPorId = Object.fromEntries(sectores.map((s) => [s.id, s]));
  const sectorActivo = (id) => sectorPorId[id]?.activo === true;

  const etiqueta =
    (hoverId && sectorPorId[hoverId]?.nombre) || "Toca el sector que quieres consultar";

  const tap = (id) => {
    if (!sectorActivo(id)) return;
    onConfirm(sectorPorId[id]);
  };

  return (
    <div className="flex flex-col" style={{ width: "100%", height: "100%", minHeight: 0 }}>
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

      <div
        className="flex flex-col gap-3"
        style={{ flex: 1, minHeight: 0, marginTop: 10 }}
      >
        {sectores.map((s) => {
          const activo = sectorActivo(s.id);
          const showHint = s.id === "sanidad" && activo;
          return (
            <div key={s.id} className="relative flex flex-col" style={{ flex: 1, minHeight: 0 }}>
              {showHint && (
                <div
                  className="absolute inset-0 pointer-events-none z-20"
                  style={{
                    border: `2px dashed ${TEMA_SECTOR.sanidad.fondoHover}`,
                    borderRadius: "18px 6px 18px 6px",
                    opacity: 0.85,
                  }}
                />
              )}
              <PanelSector
                sector={s}
                activo={activo}
                isHover={hoverId === s.id}
                isSel={false}
                onHover={setHoverId}
                onTap={tap}
                colors={C}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
