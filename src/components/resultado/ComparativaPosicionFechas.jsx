import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Minus, GitCompareArrows } from "lucide-react";
import { useDatos } from "../../datos.jsx";
import { opcionesDesdeIndex } from "../../cursosHistoricos.js";
import {
  deltaPosicion,
  etiquetaFechaOpcion,
  resolverPosicionEnCapa,
  textoDelta,
} from "../../utils/comparativaPosicion.js";
import { C, FONT_BODY, FONT_MONO } from "../../theme.js";

function CeldaFecha({ titulo, pos, puntos, total, cargando, error }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: C.paperDeep,
        borderRadius: "10px 4px 10px 4px",
        padding: "12px 12px",
      }}
    >
      <p style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft, marginBottom: 6 }}>
        {titulo}
      </p>
      {cargando ? (
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft }}>Cargando…</p>
      ) : error ? (
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.35 }}>{error}</p>
      ) : (
        <>
          <p style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 700, color: C.navy, margin: 0 }}>
            #{pos}
          </p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
            {total > 0 ? `de ${total.toLocaleString("es-ES")}` : ""}
            {puntos > 0 ? ` · ${puntos.toFixed(1)} pts` : ""}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Compara posición actual vs otra fecha (o dos fechas de archive) en la misma pantalla.
 * Solo útil con archive/index.json (CLM sanidad).
 */
export default function ComparativaPosicionFechas({
  categoria,
  grupoId,
  gerencia,
  ambito,
  candidato,
  ccaaId = "clm",
  posicionActual,
  puntosActual = 0,
  totalActual = 0,
}) {
  const datos = useDatos();
  const opciones = useMemo(
    () =>
      opcionesDesdeIndex(datos.archiveIndex, {
        sectorApp: "sanidad",
        ccaaId: ccaaId || "clm",
      }),
    [datos.archiveIndex, ccaaId],
  );

  const [fechaA, setFechaA] = useState(""); // "" = actual
  const [fechaB, setFechaB] = useState("");
  const [ladoA, setLadoA] = useState(null);
  const [ladoB, setLadoB] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!fechaB && opciones[0]?.fecha) setFechaB(opciones[0].fecha);
  }, [opciones, fechaB]);

  useEffect(() => {
    if (!opciones.length || !candidato) return undefined;
    let cancel = false;

    (async () => {
      setCargando(true);
      const persona = {
        nombreCompleto: candidato.nombreCompleto,
        dniParcial: candidato.dniParcial,
      };
      const ctx = { grupoId, categoria, persona, gerencia, ambito };

      const resolve = async (fecha) => {
        if (!fecha) {
          const pos = Number(posicionActual) || 0;
          if (!pos) return { ok: false, motivo: "sin_actual" };
          return {
            ok: true,
            posicion: pos,
            puntos: Number(puntosActual) || 0,
            total: Number(totalActual) || 0,
          };
        }
        if (!datos.paraSector) return { ok: false, motivo: "sin_capa" };
        const capa = datos.paraSector("clm", "sanidad", { fechaSnapshot: fecha });
        return resolverPosicionEnCapa(capa, ctx);
      };

      try {
        const [a, b] = await Promise.all([resolve(fechaA || null), resolve(fechaB || null)]);
        if (cancel) return;
        setLadoA(a);
        setLadoB(b);
      } finally {
        if (!cancel) setCargando(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [
    opciones.length,
    candidato,
    grupoId,
    categoria,
    gerencia,
    ambito,
    fechaA,
    fechaB,
    posicionActual,
    puntosActual,
    totalActual,
    datos,
  ]);

  if (!opciones.length) return null;
  if ((ccaaId || "clm") !== "clm") return null;

  const errMsg = (r) => {
    if (!r || r.ok) return null;
    if (r.motivo === "no_encontrado") return "No figura en ese listado";
    if (r.motivo === "error_red") return "No se pudo cargar";
    return "Sin datos";
  };

  const delta =
    ladoA?.ok && ladoB?.ok ? deltaPosicion(ladoA.posicion, ladoB.posicion) : null;
  // Interpretación: A = referencia (izquierda), B = comparación (derecha)
  // deltaPosicion(A,B) = B - A; si B < A subió (mejoró)
  const deltaInfo = textoDelta(delta);
  const mismasFechas = Boolean(fechaA) && fechaA === fechaB;

  const Icono =
    deltaInfo?.tipo === "subio" ? ArrowUp : deltaInfo?.tipo === "bajo" ? ArrowDown : Minus;
  const colorDelta =
    deltaInfo?.tipo === "subio" ? C.ok : deltaInfo?.tipo === "bajo" ? C.clay : C.inkSoft;

  return (
    <div
      style={{
        marginTop: 14,
        padding: "14px 14px",
        background: C.card,
        border: `1px solid ${C.line}`,
        borderRadius: "12px 4px 12px 4px",
      }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
        <GitCompareArrows size={16} color={C.navy} />
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.navy, margin: 0 }}>
          Comparar dos fechas
        </p>
      </div>

      <div className="flex flex-col gap-2" style={{ marginBottom: 12 }}>
        <label style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft }}>
          Fecha A
          <select
            value={fechaA}
            onChange={(e) => setFechaA(e.target.value)}
            className="w-full mt-1 focus:outline-none"
            style={{
              border: `1.5px solid ${C.line}`,
              background: C.paperDeep,
              padding: "8px 10px",
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: C.ink,
              borderRadius: 8,
            }}
          >
            <option value="">{etiquetaFechaOpcion(null, { esActual: true })}</option>
            {opciones.map((o) => (
              <option key={`a-${o.fecha}`} value={o.fecha}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft }}>
          Fecha B
          <select
            value={fechaB}
            onChange={(e) => setFechaB(e.target.value)}
            className="w-full mt-1 focus:outline-none"
            style={{
              border: `1.5px solid ${C.line}`,
              background: C.paperDeep,
              padding: "8px 10px",
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: C.ink,
              borderRadius: 8,
            }}
          >
            {opciones.map((o) => (
              <option key={`b-${o.fecha}`} value={o.fecha}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-2">
        <CeldaFecha
          titulo={fechaA ? etiquetaFechaOpcion(fechaA) : "Actual"}
          pos={ladoA?.posicion}
          puntos={ladoA?.puntos}
          total={ladoA?.total}
          cargando={cargando}
          error={errMsg(ladoA)}
        />
        <CeldaFecha
          titulo={fechaB ? etiquetaFechaOpcion(fechaB) : "—"}
          pos={ladoB?.posicion}
          puntos={ladoB?.puntos}
          total={ladoB?.total}
          cargando={cargando}
          error={errMsg(ladoB)}
        />
      </div>

      {mismasFechas && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, marginTop: 10 }}>
          Elige dos fechas distintas para comparar.
        </p>
      )}

      {deltaInfo && !mismasFechas && (
        <div
          className="flex items-center gap-2"
          style={{
            marginTop: 12,
            padding: "8px 10px",
            background: C.paperDeep,
            borderRadius: 8,
          }}
        >
          <Icono size={16} color={colorDelta} />
          <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: colorDelta, margin: 0 }}>
            De A → B: {deltaInfo.texto}
          </p>
        </div>
      )}
    </div>
  );
}
