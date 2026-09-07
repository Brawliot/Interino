import { useEffect, useMemo, useState } from "react";
import { useDatos, useCapaDatos } from "../../datos.jsx";
import {
  MODOS_POSICION_CLM,
  filtrosDeModo,
  posicionEnSubconjunto,
} from "../../utils/filtrosListado.js";
import { ResultadoColapsable } from "./ResultadoShell.jsx";
import { C, FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../../theme.js";

/**
 * Posición oficial vs recalculada (sin G.P. / solo con disponibilidad de contrato).
 */
export default function PanelPosicionFiltrada({
  categoria,
  grupoId,
  gerencia,
  ambito,
  candidato,
  posicionOficial,
  totalOficial,
}) {
  const capa = useCapaDatos();
  const [modo, setModo] = useState("oficial");
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancel = false;
    setFilas(null);
    setError(false);
    if (!capa?.obtenerListadoCompleto || !categoria) return undefined;
    (async () => {
      try {
        const f = await capa.obtenerListadoCompleto(grupoId, categoria, gerencia, ambito || "");
        if (!cancel) setFilas(f || []);
      } catch {
        if (!cancel) {
          setFilas([]);
          setError(true);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [capa, categoria, grupoId, gerencia, ambito]);

  const recalculada = useMemo(() => {
    if (modo === "oficial" || !filas) return null;
    return posicionEnSubconjunto(filas, candidato, filtrosDeModo(modo));
  }, [modo, filas, candidato]);

  const modoMeta = MODOS_POSICION_CLM.find((m) => m.id === modo) || MODOS_POSICION_CLM[0];
  const pos = modo === "oficial" ? posicionOficial : recalculada?.posicion;
  const total = modo === "oficial" ? totalOficial : recalculada?.total;

  return (
    <ResultadoColapsable label="Posición con filtros del listado">
      <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.45, margin: "0 0 10px" }}>
        En CLM el SESCAM no publica «promoción interna» ni «desactivados» como en otras CCAA. Aquí usamos
        lo que sí viene en el PDF: lista completa, marca G.P. (grupo preferente) y tipos de contrato.
      </p>
      <div className="flex flex-col gap-2" style={{ marginBottom: 12 }}>
        {MODOS_POSICION_CLM.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setModo(m.id)}
            className="text-left focus:outline-none"
            style={{
              background: modo === m.id ? C.navy : C.paperDeep,
              color: modo === m.id ? "#fff" : C.ink,
              border: `1px solid ${modo === m.id ? C.navy : C.line}`,
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5, margin: 0 }}>{m.label}</p>
            <p style={{ fontFamily: FONT_BODY, fontSize: 10.5, margin: "4px 0 0", opacity: 0.85, lineHeight: 1.35 }}>
              {m.desc}
            </p>
          </button>
        ))}
      </div>

      {error && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, margin: 0 }}>
          No se pudo cargar el listado para recalcular.
        </p>
      )}
      {!error && filas == null && modo !== "oficial" && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, margin: 0 }}>Calculando…</p>
      )}
      {!error && modo !== "oficial" && filas && !recalculada && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, margin: 0 }}>
          No apareces en ese subconjunto (p. ej. solo tienes marca G.P. o sin contratos).
        </p>
      )}

      {pos > 0 && (
        <div style={{ background: C.paperDeep, borderRadius: 10, padding: "12px 14px" }}>
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, margin: 0 }}>{modoMeta.label}</p>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 28, color: C.navy, margin: "4px 0 0" }}>
            #{pos}
            <span style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: C.inkSoft }}>
              {" "}
              de {Number(total || 0).toLocaleString("es-ES")}
            </span>
          </p>
        </div>
      )}
    </ResultadoColapsable>
  );
}
