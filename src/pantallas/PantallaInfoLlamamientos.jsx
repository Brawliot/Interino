import { AlertTriangle, Smartphone, PhoneCall } from "lucide-react";
import Barra from "../components/Barra.jsx";
import { C, FONT_BODY } from "../theme.js";

export default function PantallaInfoLlamamientos({ atras }) {
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
