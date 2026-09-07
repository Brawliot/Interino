import { ChevronLeft } from "lucide-react";
import { C, FONT_DISPLAY, FONT_BODY } from "../theme.js";

export default function Barra({ titulo, atras }) {
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
