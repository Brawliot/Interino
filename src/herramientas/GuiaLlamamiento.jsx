import { useState } from "react";
import { PhoneCall, AlertTriangle, Smartphone, ShieldAlert, CheckSquare, Square } from "lucide-react";
import { FONT_BODY } from "./shared.jsx";

const CHECKLIST = [
  "Confirmar que tus datos de contacto en Selecta están al día",
  "Responder dentro del plazo (24 h larga duración / 30 min corta duración)",
  "Preparar documentación: DNI, titulación, certificado de delitos sexuales, vida laboral",
  "Firmar el contrato en el centro asignado",
  "Comunicar fecha de incorporación",
];

export default function GuiaLlamamiento({ C, Barra, atras }) {
  const [checks, setChecks] = useState(() => CHECKLIST.map(() => false));

  const toggle = (i) => setChecks((prev) => prev.map((v, j) => (j === i ? !v : v)));

  const Bloque = ({ icono: Icono, titulo, children }) => (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: "10px 20px 10px 20px", padding: 16, marginTop: 12 }}>
      <div className="flex items-center gap-2">
        <Icono size={16} color={C.navy} />
        <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy, margin: 0 }}>{titulo}</p>
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.ink, lineHeight: 1.5, marginTop: 8 }}>{children}</div>
    </div>
  );

  return (
    <div>
      <Barra titulo="Guía del llamamiento" atras={atras} />
      <div className="px-5 pb-4">
        <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
          <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4, margin: 0 }}>
            Resumen del Pacto de Selección de Personal Temporal del SESCAM. Ante cualquier duda, el pacto oficial manda, no esta app.
          </p>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: "10px 20px 10px 20px", padding: 16, marginTop: 14 }}>
          <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy, margin: "0 0 10px" }}>Checklist al recibir un llamamiento</p>
          {CHECKLIST.map((texto, i) => (
            <button
              key={texto}
              type="button"
              onClick={() => toggle(i)}
              className="w-full flex items-start gap-2 text-left focus:outline-none"
              style={{ padding: "8px 0", borderTop: i ? `1px solid ${C.line}` : "none", background: "transparent" }}
            >
              {checks[i] ? <CheckSquare size={18} color={C.ok} style={{ flexShrink: 0 }} /> : <Square size={18} color={C.inkSoft} style={{ flexShrink: 0 }} />}
              <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: checks[i] ? C.inkSoft : C.ink, textDecoration: checks[i] ? "line-through" : "none" }}>
                {texto}
              </span>
            </button>
          ))}
        </div>

        <Bloque icono={PhoneCall} titulo="Nombramientos de larga duración">
          Te contactan por el medio que elegiste al inscribirte: llamada, SMS o email. Tienes <strong>24 horas</strong> para responder. Si no contestas en ese plazo, se entiende como renuncia y llaman a la siguiente persona de la lista.
        </Bloque>

        <Bloque icono={PhoneCall} titulo="Nombramientos de corta duración">
          Te llaman por teléfono. Si no respondes, hacen una <strong>segunda llamada media hora después</strong>. Si tampoco contestas esa, pasan a la siguiente persona.
        </Bloque>

        <Bloque icono={AlertTriangle} titulo="Qué pasa si no contestas">
          Puede suponer la pérdida de la oferta y penalización con un periodo sin recibir ofertas de la misma categoría, gerencia y tipo de lista. La duración depende del tipo de contrato y de si es reincidente (hasta 18 meses en supuestos graves según el pacto).
        </Bloque>

        <Bloque icono={ShieldAlert} titulo="Qué pasa si rechazas">
          También puede penalizarte: el pacto distingue primera renuncia/rechazo de reincidencias. El periodo de penalización varía según larga o corta duración y la gerencia implicada.
        </Bloque>

        <Bloque icono={Smartphone} titulo="Si ya estás trabajando">
          Mantén actualizado tu teléfono, email y disponibilidad en Selecta. Si estás prestando servicios y no puedes incorporarte de inmediato, el pacto prevé supuestos concretos — consúltalos antes de rechazar sin más.
        </Bloque>

        <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, margin: "16px 0" }}>
          Teléfono gratuito de la bolsa: <strong style={{ color: C.ink }}>900 25 25 25</strong> (8:00–15:00 h).
        </p>
      </div>
    </div>
  );
}
