import { useState } from "react";
import { ChevronDown, Smartphone, List as ListIcon, Info } from "lucide-react";
import Sello from "../Sello.jsx";
import BloqueSeguir from "./BloqueSeguir.jsx";
import { C, GRAIN, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../../theme.js";

export function ResultadoHero({
  sello,
  posicion,
  subtitulo,
  meta,
  eyebrow,
  compact = false,
  decoracion = true,
}) {
  return (
    <div
      style={{
        background: C.navy,
        backgroundImage: `radial-gradient(ellipse at 20% -10%, ${C.gold}22, transparent 55%), url("${GRAIN}")`,
        padding: compact ? "22px 20px 20px" : "28px 22px 24px",
        position: "relative",
        overflow: "hidden",
        borderRadius: compact ? "22px 8px 22px 8px" : "26px 8px 26px 8px",
      }}
    >
      {decoracion && (
        <>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: -22,
              right: -18,
              width: 110,
              height: 110,
              borderRadius: "48% 52% 51% 49% / 53% 47% 53% 47%",
              border: `1.5px solid ${C.gold}`,
              opacity: 0.35,
              transform: "rotate(9deg)",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: -8,
              right: 4,
              width: 76,
              height: 76,
              borderRadius: "47% 53% 49% 51% / 51% 49% 53% 47%",
              border: `1px dashed ${C.gold}`,
              opacity: 0.4,
              transform: "rotate(-6deg)",
            }}
          />
        </>
      )}
      <Sello>{sello}</Sello>
      {eyebrow && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.goldSoft, marginTop: 8, marginBottom: 0 }}>
          {eyebrow}
        </p>
      )}
      <p
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: compact ? 52 : 60,
          fontWeight: 700,
          color: "#fff",
          lineHeight: 1,
          marginTop: compact ? 8 : 14,
          transform: compact ? "none" : "rotate(-1.2deg)",
          display: "inline-block",
        }}
      >
        #{posicion}
      </p>
      {subtitulo && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.goldSoft, marginTop: 8, marginBottom: 0 }}>
          {subtitulo}
        </p>
      )}
      {meta && (
        <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.goldSoft, marginTop: 6, marginBottom: 0 }}>
          {meta}
        </p>
      )}
    </div>
  );
}

export function ResultadoChips({ label, items }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 12 }}>
      {label && (
        <span style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>{label}</span>
      )}
      {items.map((item) => (
        <span
          key={item.key || item.label}
          title={item.title}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            padding: "4px 10px",
            borderRadius: 20,
            background: C.okBg,
            color: C.ok,
            fontWeight: 700,
          }}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function ResultadoColapsable({ label, children }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between gap-2 focus:outline-none"
        style={{
          background: C.card,
          border: `1px solid ${C.line}`,
          borderRadius: "8px 18px 8px 18px",
          padding: "12px 14px",
          fontFamily: FONT_BODY,
          fontSize: 13,
          fontWeight: 700,
          color: C.navy,
          textAlign: "left",
        }}
        aria-expanded={abierto}
      >
        <span>{label}</span>
        <ChevronDown
          size={18}
          color={C.navy}
          style={{ transform: abierto ? "rotate(180deg)" : "none", transition: "transform .15s ease" }}
        />
      </button>
      {abierto && (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.line}`,
            borderTop: "none",
            borderRadius: "0 0 8px 18px",
            padding: "12px 14px 14px",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function ResultadoConsejoPortal({ titulo, texto }) {
  return (
    <div
      className="flex items-start gap-2"
      style={{
        background: C.paperDeep,
        borderRadius: "8px 14px 8px 14px",
        padding: "10px 12px",
        marginTop: 12,
      }}
    >
      <Smartphone size={15} color={C.inkSoft} style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.4, margin: 0 }}>
        <strong style={{ color: C.ink }}>{titulo}</strong> {texto}
      </p>
    </div>
  );
}

export function ResultadoPie({ onVerListado, onInfoLlamamientos, verListadoLabel = "Ver listado" }) {
  if (!onVerListado && !onInfoLlamamientos) return null;
  if (onVerListado && !onInfoLlamamientos) {
    return (
      <button
        type="button"
        onClick={onVerListado}
        className="w-full font-bold focus:outline-none flex items-center justify-center gap-2 mt-3"
        style={{
          background: "transparent",
          color: C.navy,
          padding: "11px",
          fontFamily: FONT_BODY,
          fontSize: 12.5,
          border: `1.5px solid ${C.line}`,
          borderRadius: "5px 14px 5px 14px",
        }}
      >
        <ListIcon size={14} /> {verListadoLabel}
      </button>
    );
  }
  return (
    <div className="flex gap-2 mt-3">
      <button
        type="button"
        onClick={onVerListado}
        className="flex-1 font-bold focus:outline-none flex items-center justify-center gap-2"
        style={{
          background: "transparent",
          color: C.navy,
          padding: "11px",
          fontFamily: FONT_BODY,
          fontSize: 12.5,
          border: `1.5px solid ${C.line}`,
          borderRadius: "5px 14px 5px 14px",
        }}
      >
        <ListIcon size={14} /> {verListadoLabel}
      </button>
      <button
        type="button"
        onClick={onInfoLlamamientos}
        className="flex-1 font-bold focus:outline-none flex items-center justify-center gap-2"
        style={{
          background: "transparent",
          color: C.navy,
          padding: "11px",
          fontFamily: FONT_BODY,
          fontSize: 12.5,
          border: `1.5px solid ${C.line}`,
          borderRadius: "14px 5px 14px 5px",
        }}
      >
        <Info size={14} /> Cómo llaman
      </button>
    </div>
  );
}

/**
 * Shell de resultado: hero → seguir → fuente → secundario → colapsable → pie.
 * Las tarjetas solo rellenan slots; no reordenan la jerarquía.
 */
export function ResultadoShell({
  hero,
  seguir,
  aviso,
  secondary,
  colapsable,
  pie,
  style,
}) {
  return (
    <div style={style}>
      {hero}
      {seguir && <BloqueSeguir {...seguir} />}
      {aviso}
      {secondary}
      {colapsable}
      {pie}
    </div>
  );
}
