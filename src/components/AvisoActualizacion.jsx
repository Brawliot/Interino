import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useCapaDatos } from "../datos.jsx";
import { organismoCcaa } from "../regiones.js";
import { GERENCIA_EDUCACION } from "../educacion.js";
import { estadoActualizacionEjemplo } from "../utils/estadoActualizacionEjemplo.js";
import { C, FONT_BODY, FONT_MONO } from "../theme.js";

export default function AvisoActualizacion({ categoria, grupoId, grupoActivo, tieneResultado = false }) {
  const capa = useCapaDatos();
  const organismo = capa.sector === "educacion" ? GERENCIA_EDUCACION : organismoCcaa(capa.ccaaId);
  const [e, setE] = useState({ tipo: "ok", texto: "Comprobando actualización…" });

  useEffect(() => {
    let cancel = false;
    const hayDatos = capa.tieneDatosReales(categoria, grupoId);
    if (grupoActivo && (tieneResultado || hayDatos)) {
      capa.estadoActualizacion(categoria, grupoId, true).then((est) => {
        if (cancel) return;
        if (tieneResultado && est.tipo === "sin_datos") {
          setE({ tipo: "ok", texto: "Posición según el listado público disponible." });
        } else {
          setE(est);
        }
      });
    } else if (grupoActivo) {
      setE({ tipo: "sin_datos", texto: "Aún no hay listado disponible para esta categoría." });
    } else {
      setE(estadoActualizacionEjemplo(categoria, capa.gruposSanidad));
    }
    return () => { cancel = true; };
  }, [categoria, grupoId, grupoActivo, capa, tieneResultado]);
  if (e.tipo === "ok") {
    return (
      <p style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.inkSoft, marginTop: 8, paddingLeft: 2 }}>
        Fuente pública · {organismo}, orden por puntuación · {e.texto}
      </p>
    );
  }
  return (
    <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px", marginTop: 8 }}>
      <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
        <strong>{e.tipo === "sin_activar" ? "Sin listados aún. " : e.tipo === "sin_datos" ? "Sin listado disponible. " : "Listado desactualizado. "}</strong>
        {e.texto}
      </p>
    </div>
  );
}
