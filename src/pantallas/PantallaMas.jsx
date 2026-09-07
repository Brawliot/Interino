import { Calculator, ArrowLeftRight, Map as MapIcon, Banknote, PhoneCall, Award, ShieldAlert, Lock } from "lucide-react";
import { PLAN, mensajeLimiteSeguimientos, FEATURES_HOY, FEATURES_PREVISTAS } from "../plan.js";
import Barra from "../components/Barra.jsx";
import { C, FONT_BODY } from "../theme.js";

const CONTACTO_EMAIL = "fedebotija@gmail.com";
const CONTACTO_FEEDBACK = `mailto:${CONTACTO_EMAIL}?subject=${encodeURIComponent("Feedback Interino")}`;

const HERRAMIENTAS = [
  { id: "simulador-baremo", titulo: "Simulador de baremo", subtitulo: "¿Cuántos puntos tendrías?", icono: Calculator, activo: true },
  { id: "simulador-gerencia", titulo: "Simulador de gerencia", subtitulo: "Tu posición en otra gerencia", icono: ArrowLeftRight, activo: true },
  { id: "mapa-oportunidades", titulo: "Mapa de oportunidades", subtitulo: "Dónde tienes más opciones", icono: MapIcon, activo: true },
  { id: "calculadora-nomina", titulo: "Calculadora de nómina", subtitulo: "¿Cuánto cobrarías?", icono: Banknote, activo: true },
  { id: "guia-llamamiento", titulo: "Guía del llamamiento", subtitulo: "Te han llamado, ¿ahora qué?", icono: PhoneCall, activo: true },
  { id: "calculadora-meritos", titulo: "Calculadora de méritos", subtitulo: "¿Cuánto sube tu baremo?", icono: Award, activo: true },
];

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

export default function PantallaMas({ onHerramienta, onPrivacidad, atras }) {
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
        <div style={{ marginTop: 28, padding: "14px 16px", background: C.card, border: `1px solid ${C.line}`, borderRadius: "12px 4px 12px 4px" }}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 6 }}>
            Plan · {PLAN.nombre}
          </p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, lineHeight: 1.45, marginBottom: 10 }}>
            {mensajeLimiteSeguimientos()}
          </p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft, marginBottom: 6 }}>
            Qué hace la app hoy
          </p>
          <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5 }}>
            {FEATURES_HOY.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft, marginBottom: 6 }}>
            Previsto (aún no disponible)
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5 }}>
            {FEATURES_PREVISTAS.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
        <div style={{ marginTop: 28, padding: "14px 16px", background: C.card, border: `1px solid ${C.line}`, borderRadius: "12px 4px 12px 4px" }}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
            Feedback y contacto
          </p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, lineHeight: 1.45, marginBottom: 12 }}>
            Beta gratuita. Cuéntanos errores, datos desactualizados o ideas de mejora.
          </p>
          <a
            href={CONTACTO_FEEDBACK}
            style={{
              display: "inline-block",
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              background: C.navy,
              padding: "10px 16px",
              borderRadius: "10px 4px 10px 4px",
              textDecoration: "none",
            }}
          >
            Enviar email
          </a>
          <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, marginTop: 10 }}>
            {CONTACTO_EMAIL}
          </p>
        </div>
        <div style={{ marginTop: 28 }}>
          <AvisoLegal onAbrirPrivacidad={onPrivacidad} />
        </div>
      </div>
    </div>
  );
}
