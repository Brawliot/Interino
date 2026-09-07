import { useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { useCapaDatos } from "../datos.jsx";
import { CCAA_LIST, organismoCcaa } from "../regiones.js";
import { mensajeLimiteSeguimientos } from "../plan.js";
import Barra from "../components/Barra.jsx";
import { ResultadoColapsable } from "../components/resultado/ResultadoShell.jsx";
import { etiquetaLista } from "../utils/etiquetasLista.js";
import { grupoDeCategoria } from "../utils/grupoDeCategoria.js";
import { estadoActualizacionEjemplo } from "../utils/estadoActualizacionEjemplo.js";
import { C, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../theme.js";

export default function PantallaSeguimientos({ seguimientos, atras, onAbrir, gruposSanidad, onExportar, onImportar, limiteMax }) {
  const capa = useCapaDatos();
  const inputImportRef = useRef(null);
  return (
    <div>
      <Barra titulo="Mis seguimientos" atras={atras} />
      <div className="px-5 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.navy, margin: 0 }}>
            {seguimientos.length} / {limiteMax}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onExportar}
              disabled={!seguimientos.length}
              className="font-bold focus:outline-none"
              style={{
                fontFamily: FONT_BODY,
                fontSize: 11.5,
                padding: "6px 10px",
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                background: C.card,
                color: seguimientos.length ? C.navy : C.inkSoft,
                opacity: seguimientos.length ? 1 : 0.6,
              }}
            >
              Exportar
            </button>
            <button
              type="button"
              onClick={() => inputImportRef.current?.click()}
              className="font-bold focus:outline-none"
              style={{
                fontFamily: FONT_BODY,
                fontSize: 11.5,
                padding: "6px 10px",
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                background: C.card,
                color: C.navy,
              }}
            >
              Importar
            </button>
            <input
              ref={inputImportRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportar(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <ResultadoColapsable label="Límite y copia de seguridad">
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, lineHeight: 1.45, margin: 0 }}>
            {mensajeLimiteSeguimientos()} Exportar/importar guarda un archivo JSON en tu dispositivo; no hay sincronización entre móviles.
          </p>
        </ResultadoColapsable>

        {seguimientos.length === 0 && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: C.inkSoft, marginTop: 12 }}>
            Todavía no guardas ninguna lista. Puedes seguir varias a la vez — por ejemplo, la general de Enfermería y la de Salud Mental.
          </p>
        )}
        <div className="flex flex-col gap-3 mt-3">
          {seguimientos.map((s, i) => {
            const r = s.candidato;
            const grupo = grupoDeCategoria(s.categoria, gruposSanidad, s.ccaaId);
            const sector = s.sector || r?.sector || "sanidad";
            const ccaaNombre = CCAA_LIST.find((c) => c.id === s.ccaaId)?.nombre;
            const organismo =
              sector === "educacion"
                ? s.ccaaId === "mur"
                  ? "CARM Educación"
                  : "Educación CLM"
                : sector === "administracion"
                  ? "Admin CLM"
                  : organismoCcaa(s.ccaaId || capa.ccaaId);
            const metaPuntos =
              sector === "educacion"
                ? r.total
                  ? `${r.total} en bolsa`
                  : null
                : `${Number(r.puntos || 0).toFixed(2)} pts`;
            const e = grupo?.activo && capa.tieneDatosReales(s.categoria, grupo.id)
              ? { tipo: "ok", texto: "Datos reales disponibles." }
              : grupo?.activo
                ? { tipo: "sin_datos", texto: "Sin listado disponible para esta categoría." }
                : estadoActualizacionEjemplo(s.categoria, gruposSanidad);
            const cambioPill =
              s.ultimoCambio === "subio"
                ? { texto: "Subió", color: C.navy, bg: `${C.navy}12` }
                : s.ultimoCambio === "bajo"
                  ? { texto: "Bajó", color: C.clay, bg: "#F7E9D9" }
                  : null;
            return (
              <button
                key={s.id || i}
                onClick={() => onAbrir(s)}
                className="text-left focus:outline-none focus:ring-2 w-full"
                style={{
                  background: C.card,
                  border: `1.5px solid ${C.line}`,
                  borderRadius: i % 2 === 0 ? "16px 6px 16px 6px" : "6px 16px 6px 16px",
                  padding: "14px 16px",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 11,
                      color: C.inkSoft,
                      margin: 0,
                      lineHeight: 1.35,
                      flex: 1,
                    }}
                  >
                    {etiquetaLista(s.categoria, s.gerencia, s.ambito, { ccaaNombre })}
                  </p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {cambioPill && (
                      <span
                        style={{
                          fontFamily: FONT_BODY,
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: cambioPill.color,
                          background: cambioPill.bg,
                          padding: "3px 8px",
                          borderRadius: 999,
                        }}
                      >
                        {cambioPill.texto}
                      </span>
                    )}
                    {e.tipo !== "ok" && <AlertTriangle size={14} color={C.clay} />}
                  </div>
                </div>
                <p
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 32,
                    fontWeight: 700,
                    color: C.navy,
                    margin: "6px 0 2px",
                    lineHeight: 1,
                  }}
                >
                  #{r.posicion}
                </p>
                <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.ink, margin: "4px 0 0" }}>
                  {r.nombreCompleto}
                </p>
                <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, margin: "4px 0 0" }}>
                  {[metaPuntos, organismo].filter(Boolean).join(" · ")}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
