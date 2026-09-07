import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useDatos, useCapaDatos } from "../../datos.jsx";
import { opcionesDesdeIndex } from "../../cursosHistoricos.js";
import { construirSerieEvolucion } from "../../utils/comparativaPosicion.js";
import {
  analizarTendenciaPosicion,
  textoDireccion,
  diasHastaPosicionObjetivo,
  situacionVsCorte,
} from "../../utils/tendenciaPosicion.js";
import { C, FONT_BODY, FONT_MONO } from "../../theme.js";

/**
 * Estimación lineal de cómo puede moverse la posición (no IA / no llamamiento).
 * Opcionalmente compara con el último corte histórico de la gerencia.
 */
export default function AnalisisTendenciaPredictivo({
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
  const capa = useCapaDatos();
  const opciones = useMemo(
    () =>
      opcionesDesdeIndex(datos.archiveIndex, {
        sectorApp: "sanidad",
        ccaaId: ccaaId || "clm",
      }),
    [datos.archiveIndex, ccaaId],
  );

  const [analisis, setAnalisis] = useState(null);
  const [cargando, setCargando] = useState(false);

  const corteUltimo = useMemo(() => {
    try {
      const h = capa.historialCorte?.(categoria, gerencia, ambito || "", grupoId) || [];
      return h.length ? h[h.length - 1].puntos : null;
    } catch {
      return null;
    }
  }, [capa, categoria, gerencia, ambito, grupoId]);

  const vsCorte = useMemo(
    () => situacionVsCorte(puntosActual, corteUltimo),
    [puntosActual, corteUltimo],
  );

  useEffect(() => {
    if (!opciones.length || !candidato || (ccaaId || "clm") !== "clm") {
      setAnalisis(null);
      return undefined;
    }
    let cancel = false;
    (async () => {
      setCargando(true);
      try {
        const serie = await construirSerieEvolucion({
          datos,
          opciones,
          ctx: {
            grupoId,
            categoria,
            persona: {
              nombreCompleto: candidato.nombreCompleto,
              dniParcial: candidato.dniParcial,
            },
            gerencia,
            ambito,
          },
          live: {
            posicion: posicionActual,
            puntos: puntosActual,
            total: totalActual,
          },
          maxPuntos: 12,
        });
        if (!cancel) setAnalisis(analizarTendenciaPosicion(serie));
      } catch {
        if (!cancel) setAnalisis({ ok: false, motivo: "error" });
      } finally {
        if (!cancel) setCargando(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [
    opciones,
    candidato,
    grupoId,
    categoria,
    gerencia,
    ambito,
    ccaaId,
    posicionActual,
    puntosActual,
    totalActual,
    datos,
  ]);

  if (!opciones.length || (ccaaId || "clm") !== "clm") return null;

  const dir = textoDireccion(analisis);
  const colorDir =
    dir?.tipo === "mejorando" ? C.ok : dir?.tipo === "empeorando" ? C.clay : C.inkSoft;

  const metaPuesto =
    totalActual > 0 ? Math.max(1, Math.round(totalActual * 0.1)) : Math.max(1, Math.round((posicionActual || 100) * 0.5));
  const hastaMeta = analisis?.ok ? diasHastaPosicionObjetivo(analisis, metaPuesto) : null;

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
      <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
        <Sparkles size={16} color={C.navy} />
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.navy, margin: 0 }}>
          Tendencia orientativa
        </p>
      </div>
      <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.4, margin: "0 0 10px" }}>
        Extrapolación lineal sobre tus posiciones archivadas y, si hay dato, comparación con el último corte
        histórico. No es IA ni predicción de plaza o llamamiento.
      </p>

      {vsCorte && (
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12.5,
            fontWeight: 600,
            color: vsCorte.porEncima ? C.ok : C.clay,
            margin: "0 0 10px",
            lineHeight: 1.4,
          }}
        >
          {vsCorte.porEncima
            ? `Tus ${Number(puntosActual).toFixed(1)} pt están por encima del último corte (~${vsCorte.corte.toFixed(1)}; +${vsCorte.gap.toFixed(1)}).`
            : `Tus ${Number(puntosActual).toFixed(1)} pt quedan ~${Math.abs(vsCorte.gap).toFixed(1)} por debajo del último corte (~${vsCorte.corte.toFixed(1)}).`}
        </p>
      )}

      {cargando && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft }}>Calculando…</p>
      )}

      {!cargando && analisis && !analisis.ok && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, lineHeight: 1.4, margin: 0 }}>
          {analisis.motivo === "pocos_datos"
            ? `Hacen falta al menos ${analisis.min} puntos en la serie (tienes ${analisis.n}). Con más archives del vigía saldrá la estimación.`
            : "No se pudo estimar la tendencia."}
        </p>
      )}

      {!cargando && analisis?.ok && (
        <>
          {dir && (
            <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: colorDir, margin: "0 0 12px", lineHeight: 1.4 }}>
              {dir.texto}
            </p>
          )}
          <div className="flex gap-2">
            {analisis.proyecciones.map((p) => (
              <div
                key={p.dias}
                style={{
                  flex: 1,
                  background: C.paperDeep,
                  borderRadius: "10px 4px 10px 4px",
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <p style={{ fontFamily: FONT_BODY, fontSize: 10.5, fontWeight: 700, color: C.inkSoft, margin: 0 }}>
                  {p.label}
                </p>
                <p style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, color: C.navy, margin: "6px 0 0" }}>
                  #{p.posicion}
                </p>
              </div>
            ))}
          </div>
          {hastaMeta?.ok && !hastaMeta.yaAlcanzado && (
            <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, marginTop: 10, lineHeight: 1.4 }}>
              A este ritmo, el puesto ~#{hastaMeta.meta} (aprox. top 10% del listado) llegaría en ~
              {hastaMeta.meses} mes(es). Es una proyección frágil: adjudicaciones y cambios de listado la invalidan.
            </p>
          )}
          {hastaMeta?.ok && hastaMeta.yaAlcanzado && (
            <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.ok, marginTop: 10, lineHeight: 1.4 }}>
              Ya estás en o por encima del umbral orientativo ~#{hastaMeta.meta}.
            </p>
          )}
          <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, marginTop: 10, lineHeight: 1.4 }}>
            Basado en {analisis.n} puntos · span {Math.round(analisis.spanDias)} días. Si el ritmo cambia
            (adjudicaciones, desactivaciones), la proyección deja de valer.
          </p>
        </>
      )}
    </div>
  );
}
