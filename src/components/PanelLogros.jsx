import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { CATALOGO_LOGROS, leerLogros, syncLogrosDesdeEstado } from "../herramientas/gamificacion.js";
import { C, FONT_BODY } from "../theme.js";

/** Logros locales (sin leaderboard social público). */
export default function PanelLogros({ numFavoritos = 0, notifOn = false }) {
  const [logros, setLogros] = useState(() => leerLogros());

  useEffect(() => {
    syncLogrosDesdeEstado({ numFavoritos, notifOn });
    setLogros(leerLogros());
  }, [numFavoritos, notifOn]);

  const desbloqueados = CATALOGO_LOGROS.filter((l) => logros[l.id]);
  const pendientes = CATALOGO_LOGROS.filter((l) => !logros[l.id]);

  return (
    <div style={{ marginTop: 28, padding: "14px 16px", background: C.card, border: `1px solid ${C.line}`, borderRadius: "12px 4px 12px 4px" }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
        <Trophy size={16} color={C.gold} />
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.navy, margin: 0 }}>
          Logros en este dispositivo
        </p>
      </div>
      <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.4, margin: "0 0 10px" }}>
        Gamificación local y anónima: no hay ranking social ni comparación pública con otros usuarios.
      </p>
      <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.ok, fontWeight: 700, margin: "0 0 8px" }}>
        {desbloqueados.length} / {CATALOGO_LOGROS.length}
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>
        {desbloqueados.map((l) => (
          <li key={l.id} style={{ color: C.navy }}>
            <strong>{l.titulo}</strong> — {l.desc}
          </li>
        ))}
        {pendientes.slice(0, 3).map((l) => (
          <li key={l.id} style={{ opacity: 0.65 }}>
            {l.titulo} — {l.desc}
          </li>
        ))}
      </ul>
    </div>
  );
}
