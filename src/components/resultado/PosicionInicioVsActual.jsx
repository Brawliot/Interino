import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Flag, Minus } from "lucide-react";
import { useDatos } from "../../datos.jsx";
import {
  cursoDeFecha,
  cursosDisponibles,
  opcionesDesdeIndex,
  snapshotInicioCurso,
} from "../../cursosHistoricos.js";
import {
  deltaPosicion,
  etiquetaFechaOpcion,
  resolverPosicionEnCapa,
  textoDelta,
} from "../../utils/comparativaPosicion.js";
import { C, FONT_BODY, FONT_MONO } from "../../theme.js";

/**
 * Posición al inicio del curso (primer snapshot archivado de ese curso) vs actual.
 */
export default function PosicionInicioVsActual({
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

  const listaCursos = useMemo(() => cursosDisponibles(opciones), [opciones]);
  const cursoHoy = cursoDeFecha(new Date().toISOString().slice(0, 10));
  const [cursoSel, setCursoSel] = useState("");

  useEffect(() => {
    if (cursoSel) return;
    if (cursoHoy && listaCursos.includes(cursoHoy)) setCursoSel(cursoHoy);
    else if (listaCursos[0]) setCursoSel(listaCursos[0]);
  }, [listaCursos, cursoHoy, cursoSel]);

  const inicio = useMemo(
    () => (cursoSel ? snapshotInicioCurso(opciones, { curso: cursoSel }) : null),
    [opciones, cursoSel],
  );

  const [ladoInicio, setLadoInicio] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!inicio?.fecha || !candidato) {
      setLadoInicio(null);
      return undefined;
    }
    let cancel = false;
    (async () => {
      setCargando(true);
      try {
        const capa = datos.paraSector?.("clm", "sanidad", { fechaSnapshot: inicio.fecha });
        const res = await resolverPosicionEnCapa(capa, {
          grupoId,
          categoria,
          persona: {
            nombreCompleto: candidato.nombreCompleto,
            dniParcial: candidato.dniParcial,
          },
          gerencia,
          ambito,
        });
        if (!cancel) setLadoInicio(res);
      } finally {
        if (!cancel) setCargando(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [inicio?.fecha, candidato, grupoId, categoria, gerencia, ambito, datos]);

  if (!opciones.length || (ccaaId || "clm") !== "clm") return null;

  const posActual = Number(posicionActual) || 0;
  const delta =
    ladoInicio?.ok && posActual > 0
      ? deltaPosicion(ladoInicio.posicion, posActual)
      : null;
  const deltaInfo = textoDelta(delta);
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
        border: `1.5px solid ${C.navy}33`,
        borderRadius: "12px 4px 12px 4px",
      }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
        <Flag size={16} color={C.navy} />
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.navy, margin: 0 }}>
          Inicio de curso vs actual
        </p>
      </div>

      {listaCursos.length > 1 && (
        <label style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft, display: "block", marginBottom: 10 }}>
          Curso
          <select
            value={cursoSel}
            onChange={(e) => setCursoSel(e.target.value)}
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
            {listaCursos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}

      {!inicio ? (
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, lineHeight: 1.4, margin: 0 }}>
          Aún no hay un snapshot archivado para el curso {cursoSel || cursoHoy || ""}.
          Cuando el vigía archive listados, podrás ver el cambio desde el inicio.
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <div style={{ flex: 1, background: C.paperDeep, borderRadius: "10px 4px 10px 4px", padding: "12px" }}>
              <p style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft, marginBottom: 6 }}>
                Inicio {inicio.curso}
              </p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkSoft, marginBottom: 4 }}>
                {etiquetaFechaOpcion(inicio.fecha)}
              </p>
              {cargando ? (
                <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft }}>Cargando…</p>
              ) : ladoInicio?.ok ? (
                <p style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 700, color: C.navy, margin: 0 }}>
                  #{ladoInicio.posicion}
                </p>
              ) : (
                <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay }}>
                  {ladoInicio?.motivo === "no_encontrado" ? "No figuraba" : "Sin datos"}
                </p>
              )}
            </div>
            <div style={{ flex: 1, background: C.paperDeep, borderRadius: "10px 4px 10px 4px", padding: "12px" }}>
              <p style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft, marginBottom: 6 }}>
                Actual
              </p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkSoft, marginBottom: 4 }}>
                En vivo
              </p>
              <p style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 700, color: C.navy, margin: 0 }}>
                #{posActual || "—"}
              </p>
              {totalActual > 0 && (
                <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                  de {totalActual.toLocaleString("es-ES")}
                  {puntosActual > 0 ? ` · ${Number(puntosActual).toFixed(1)} pts` : ""}
                </p>
              )}
            </div>
          </div>

          {deltaInfo && (
            <div
              className="flex items-center gap-2"
              style={{ marginTop: 12, padding: "8px 10px", background: C.paperDeep, borderRadius: 8 }}
            >
              <Icono size={16} color={colorDelta} />
              <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: colorDelta, margin: 0 }}>
                Desde el inicio del curso: {deltaInfo.texto.toLowerCase()}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
