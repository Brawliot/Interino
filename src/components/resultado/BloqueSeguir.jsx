import { useState, useEffect } from "react";
import { Bell, BellRing, Smartphone } from "lucide-react";
import { activarNotificacionesSeguimiento, notificacionesSoportadas } from "../../notificaciones.js";
import { C, FONT_BODY } from "../../theme.js";

async function confirmarNotificaciones(etiqueta, setNotifEstado, onGuardar) {
  if (!notificacionesSoportadas()) {
    setNotifEstado("guardado");
    onGuardar?.();
    return;
  }
  const perm = await activarNotificacionesSeguimiento(etiqueta);
  if (perm === "granted") setNotifEstado("activo");
  else if (perm === "denied") setNotifEstado("denegado");
  else setNotifEstado("guardado");
  onGuardar?.();
}

function AvisoNotifDenegada() {
  return (
    <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.clay, marginTop: 8, lineHeight: 1.4 }}>
      Sin permiso de notificaciones. Actívalas en ajustes del navegador para recibir avisos al abrir la app.
    </p>
  );
}

function AvisoSeguimientoSinNotif() {
  return (
    <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5, color: C.ok }}>
      Seguimiento guardado en este dispositivo (sin avisos del sistema).
    </p>
  );
}

const TEXTO_AVISO_AL_ABRIR =
  "Al abrir la app te avisaremos si ha cambiado tu posición. No es un aviso en tiempo real.";

/** CTA seguir + estados de notificación (compartible en Fase B). */
export default function BloqueSeguir({
  ctaLabel = "Seguir",
  etiquetaSeguimiento,
  avisoOficial,
  guardado = false,
  onGuardar,
}) {
  const [notifEstado, setNotifEstado] = useState(guardado ? "activo" : "inicial");

  useEffect(() => {
    if (guardado) {
      setNotifEstado((s) => (s === "inicial" || s === "pidiendo" ? "activo" : s));
    }
  }, [guardado]);

  return (
    <div style={{ marginTop: 14 }}>
      {notifEstado === "inicial" && (
        <button
          type="button"
          onClick={() => setNotifEstado("pidiendo")}
          className="w-full font-bold focus:outline-none flex items-center justify-center gap-2"
          style={{
            background: C.gold,
            color: "#fff",
            padding: "14px",
            fontFamily: FONT_BODY,
            fontSize: 14,
            borderRadius: "16px 5px 16px 5px",
          }}
        >
          <Bell size={16} /> {ctaLabel}
        </button>
      )}

      {notifEstado === "pidiendo" && (
        <div
          style={{
            background: C.card,
            border: `1.5px solid ${C.navy}`,
            borderRadius: "10px 20px 10px 20px",
            padding: 16,
          }}
        >
          <div className="flex items-center gap-3">
            <Smartphone size={20} color={C.navy} />
            <div>
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy }}>
                Permitir notificaciones
              </p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 2, lineHeight: 1.45 }}>
                {TEXTO_AVISO_AL_ABRIR} {etiquetaSeguimiento ? `Lista: ${etiquetaSeguimiento}.` : ""}{" "}
                {avisoOficial && (
                  <strong style={{ color: C.clay }}>{avisoOficial}</strong>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={() => setNotifEstado("inicial")}
              className="flex-1 font-bold focus:outline-none"
              style={{
                background: "transparent",
                color: C.inkSoft,
                padding: "10px",
                fontFamily: FONT_BODY,
                fontSize: 13,
                border: `1px solid ${C.line}`,
                borderRadius: 10,
              }}
            >
              Ahora no
            </button>
            <button
              type="button"
              onClick={() =>
                confirmarNotificaciones(etiquetaSeguimiento || ctaLabel, setNotifEstado, onGuardar)
              }
              className="flex-1 font-bold focus:outline-none"
              style={{
                background: C.navy,
                color: "#fff",
                padding: "10px",
                fontFamily: FONT_BODY,
                fontSize: 13,
                borderRadius: 10,
              }}
            >
              Permitir
            </button>
          </div>
        </div>
      )}

      {notifEstado === "denegado" && <AvisoNotifDenegada />}

      {notifEstado === "guardado" && (
        <div
          className="flex items-center gap-2 justify-center"
          style={{ background: C.paperDeep, borderRadius: "16px 5px 16px 5px", padding: "13px" }}
        >
          <BellRing size={16} color={C.ok} />
          <AvisoSeguimientoSinNotif />
        </div>
      )}

      {notifEstado === "activo" && (
        <div
          className="flex items-center gap-2 justify-center"
          style={{ background: C.paperDeep, borderRadius: "16px 5px 16px 5px", padding: "13px" }}
        >
          <BellRing size={16} color={C.ok} />
          <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5, color: C.ok, margin: 0 }}>
            Siguiendo {etiquetaSeguimiento || "lista"} — te avisaremos al abrir la app
          </p>
        </div>
      )}
    </div>
  );
}

export { confirmarNotificaciones, AvisoNotifDenegada, AvisoSeguimientoSinNotif, TEXTO_AVISO_AL_ABRIR, BloqueSeguir };
