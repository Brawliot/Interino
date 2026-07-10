import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

export const FONT_BODY = "'Inter', system-ui, sans-serif";
export const FONT_DISPLAY = "'Fraunces', serif";
export const FONT_MONO = "'JetBrains Mono', 'Courier New', monospace";

export function AvisoEstimacion({ children, C }) {
  return (
    <div
      className="flex items-start gap-2 mx-5"
      style={{ marginTop: 12, marginBottom: 8, padding: "10px 12px", background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px" }}
    >
      <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.clay, lineHeight: 1.45, margin: 0 }}>{children}</p>
    </div>
  );
}

export function SeccionColapsable({ titulo, children, C, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: 10, border: `1px solid ${C.line}`, borderRadius: "12px 4px 12px 4px", background: C.card, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between focus:outline-none"
        style={{ padding: "12px 14px", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5, color: C.navy, background: "transparent" }}
      >
        {titulo}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div style={{ padding: "0 14px 14px" }}>{children}</div>}
    </div>
  );
}

export function CampoNumero({ label, ayuda, value, onChange, C, step = 1, min = 0 }) {
  return (
    <label className="block" style={{ marginTop: 10 }}>
      <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: C.ink }}>{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 focus:outline-none"
        style={{ border: `1.5px solid ${C.line}`, background: C.paper, padding: "10px 12px", fontFamily: FONT_BODY, fontSize: 14, color: C.ink }}
      />
      {ayuda && <span style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkSoft, display: "block", marginTop: 4 }}>{ayuda}</span>}
    </label>
  );
}

export function SelectCampo({ label, value, onChange, opciones, C }) {
  return (
    <label className="block" style={{ marginTop: 10 }}>
      <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: C.ink }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 focus:outline-none"
        style={{ border: `1.5px solid ${C.line}`, background: C.paper, padding: "10px 12px", fontFamily: FONT_BODY, fontSize: 14, color: C.ink }}
      >
        {opciones.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function ResultadoCaja({ titulo, children, C }) {
  return (
    <div style={{ marginTop: 16, padding: 16, background: C.navy, borderRadius: "14px 5px 14px 5px", color: "#fff" }}>
      <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.goldSoft, margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>{titulo}</p>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

export function BotonSecundario({ children, onClick, C, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full font-bold focus:outline-none mt-3"
      style={{
        background: disabled ? C.paperDeep : "transparent",
        color: C.navy,
        padding: "13px",
        fontFamily: FONT_BODY,
        fontSize: 14,
        border: `1.5px solid ${C.line}`,
        borderRadius: "5px 16px 5px 16px",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}
