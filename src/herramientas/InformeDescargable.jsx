import { useMemo, useState } from "react";
import { desbloquearLogro } from "./gamificacion.js";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, AvisoEstimacion } from "./shared.jsx";

/**
 * Informe imprimible / «Guardar como PDF» vía diálogo del navegador.
 */
export default function InformeDescargable({
  C,
  Barra,
  atras,
  contexto = {},
}) {
  const {
    nombre = "",
    dniParcial = "",
    categoria = "",
    gerencia = "",
    ambito = "",
    posicion = 0,
    total = 0,
    puntos = 0,
    percentil = null,
    notas = [],
  } = contexto;

  const [extra, setExtra] = useState("");
  const fecha = useMemo(() => new Date().toLocaleString("es-ES"), []);

  function imprimir() {
    desbloquearLogro("pdf_export");
    window.print();
  }

  return (
    <div>
      <Barra titulo="Informe PDF" atras={atras} />
      <div className="px-5 pb-6 print:px-0">
        <div className="print:hidden">
          <AvisoEstimacion C={C}>
            Usa «Imprimir» → «Guardar como PDF». El informe no es un documento oficial del SESCAM ni de ninguna
            administración.
          </AvisoEstimacion>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, color: C.inkSoft }}>Notas personales</span>
            <textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value.slice(0, 500))}
              rows={3}
              className="w-full focus:outline-none"
              style={{
                marginTop: 6,
                fontFamily: FONT_BODY,
                fontSize: 13,
                padding: 10,
                border: `1px solid ${C.line}`,
                borderRadius: 10,
                background: C.paper,
              }}
            />
          </label>
          <button
            type="button"
            onClick={imprimir}
            className="w-full font-bold focus:outline-none"
            style={{
              background: C.navy,
              color: "#fff",
              padding: "14px",
              borderRadius: 10,
              border: "none",
              fontFamily: FONT_BODY,
              fontSize: 14,
            }}
          >
            Imprimir / Guardar PDF
          </button>
        </div>

        <article
          id="informe-interino"
          style={{
            marginTop: 20,
            background: "#fff",
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            padding: 20,
            color: "#20281F",
          }}
        >
          <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: "#5B6355", margin: 0 }}>
            Interino · informe orientativo · {fecha}
          </p>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, color: "#233D30", margin: "8px 0 4px" }}>
            Resumen de posición
          </h1>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: "#B5562F", margin: "0 0 16px", lineHeight: 1.4 }}>
            Documento no oficial. Los datos proceden de listados públicos y pueden estar desactualizados. No sustituye
            la información ni la llamada de la administración.
          </p>

          {(nombre || dniParcial) && (
            <p style={{ fontFamily: FONT_BODY, fontSize: 14, margin: "0 0 8px" }}>
              <strong>{nombre || "Aspirante"}</strong>
              {dniParcial ? ` · ${dniParcial}` : ""}
            </p>
          )}
          <p style={{ fontFamily: FONT_BODY, fontSize: 13, margin: "0 0 4px" }}>
            {categoria}
            {gerencia ? ` · ${gerencia}` : ""}
            {ambito ? ` · ${ambito}` : ""}
          </p>
          {posicion > 0 && (
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 36, fontWeight: 700, color: "#233D30", margin: "12px 0" }}>
              #{posicion}
              <span style={{ fontFamily: FONT_BODY, fontSize: 16, fontWeight: 600, color: "#5B6355" }}>
                {" "}
                de {Number(total || 0).toLocaleString("es-ES")}
              </span>
            </p>
          )}
          <p style={{ fontFamily: FONT_MONO, fontSize: 13, margin: 0 }}>
            {puntos > 0 ? `${Number(puntos).toFixed(2)} puntos` : ""}
            {percentil != null ? ` · percentil ~${percentil}` : ""}
          </p>

          {(notas.length > 0 || extra) && (
            <div style={{ marginTop: 18 }}>
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, margin: "0 0 6px" }}>Notas</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontFamily: FONT_BODY, fontSize: 12, lineHeight: 1.45 }}>
                {notas.map((n) => (
                  <li key={n}>{n}</li>
                ))}
                {extra ? <li>{extra}</li> : null}
              </ul>
            </div>
          )}
        </article>
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #informe-interino, #informe-interino * { visibility: visible !important; }
          #informe-interino { position: absolute; left: 0; top: 0; width: 100%; border: none !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
