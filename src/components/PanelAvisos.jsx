import { Bell } from "lucide-react";
import { FRECUENCIAS } from "../notifPrefs.js";
import {
  activarNotificacionesSeguimiento,
  notificacionesHabilitadasEnDispositivo,
  notificacionesSoportadas,
  solicitarPermisoNotificaciones,
  marcarNotificacionesHabilitadas,
} from "../notificaciones.js";
import { C, FONT_BODY } from "../theme.js";

/**
 * Configuración de avisos: frecuencia de comprobación + tipos (posición / adjudicación).
 */
export default function PanelAvisos({
  prefs,
  onChangePrefs,
  seguimientos = [],
  habilitadas,
}) {
  if (!notificacionesSoportadas()) return null;

  const activas = habilitadas ?? notificacionesHabilitadasEnDispositivo();

  async function activar() {
    const perm = await solicitarPermisoNotificaciones();
    if (perm !== "granted") return;
    marcarNotificacionesHabilitadas();
    await activarNotificacionesSeguimiento("tus seguimientos", seguimientos);
    onChangePrefs?.({ ...prefs });
  }

  function setField(patch) {
    onChangePrefs?.({ ...prefs, ...patch });
  }

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.line}`,
        borderRadius: "12px 4px 12px 4px",
        padding: "14px 14px",
        marginBottom: 14,
      }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
        <Bell size={16} color={C.navy} />
        <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5, color: C.navy, margin: 0 }}>
          Avisos
        </p>
      </div>

      {!activas ? (
        <>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, lineHeight: 1.45, margin: "0 0 10px" }}>
            Activa las notificaciones para avisos en segundo plano: cambios de posición y cuando alguien ya no aparece en el listado.
          </p>
          <button
            type="button"
            onClick={activar}
            className="font-bold focus:outline-none"
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              background: C.navy,
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              width: "100%",
            }}
          >
            Activar notificaciones
          </button>
        </>
      ) : (
        <>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, lineHeight: 1.45, margin: "0 0 12px" }}>
            El servidor comprueba según la frecuencia que elijas (el vigía corre a diario; si eliges menos a menudo, se omite hasta que toque).
          </p>

          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ fontFamily: FONT_BODY, fontSize: 11.5, fontWeight: 700, color: C.inkSoft }}>
              Frecuencia de comprobación
            </span>
            <select
              value={prefs.frecuencia}
              onChange={(e) => setField({ frecuencia: e.target.value })}
              style={{
                display: "block",
                width: "100%",
                marginTop: 6,
                fontFamily: FONT_BODY,
                fontSize: 13,
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${C.line}`,
                background: C.paper,
                color: C.ink,
              }}
            >
              {FRECUENCIAS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-start gap-2" style={{ marginBottom: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={prefs.avisosPosicion}
              onChange={(e) => setField({ avisosPosicion: e.target.checked })}
              style={{ marginTop: 3 }}
            />
            <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.ink, lineHeight: 1.4 }}>
              Cambios de posición (sube / baja)
            </span>
          </label>

          <label className="flex items-start gap-2" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={prefs.avisosAdjudicacion}
              onChange={(e) => setField({ avisosAdjudicacion: e.target.checked })}
              style={{ marginTop: 3 }}
            />
            <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.ink, lineHeight: 1.4 }}>
              Cuando un seguimiento ya no aparece en el listado (posible adjudicación o desactivación)
            </span>
          </label>
        </>
      )}
    </div>
  );
}
