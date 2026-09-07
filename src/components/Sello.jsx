import { C, FONT_MONO } from "../theme.js";

export default function Sello({ children }) {
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
