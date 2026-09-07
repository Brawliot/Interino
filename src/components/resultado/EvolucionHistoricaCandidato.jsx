import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useDatos } from "../../datos.jsx";
import { opcionesDesdeIndex } from "../../cursosHistoricos.js";
import { construirSerieEvolucion } from "../../utils/comparativaPosicion.js";
import { C, FONT_BODY } from "../../theme.js";

const GraficoEvolucionPosicion = lazy(() => import("../GraficoEvolucionPosicion.jsx"));

/**
 * Evolución de la posición del candidato en el tiempo (archive + actual).
 */
export default function EvolucionHistoricaCandidato({
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

  const [serie, setSerie] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!opciones.length || !candidato || (ccaaId || "clm") !== "clm") {
      setSerie([]);
      return undefined;
    }
    let cancel = false;
    (async () => {
      setCargando(true);
      setError("");
      try {
        const out = await construirSerieEvolucion({
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
        if (!cancel) setSerie(out);
      } catch {
        if (!cancel) {
          setError("No se pudo cargar la evolución.");
          setSerie([]);
        }
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

  const primero = serie[0];
  const ultimo = serie[serie.length - 1];
  const resumen =
    primero && ultimo && serie.length >= 2
      ? Number(ultimo.posicion) - Number(primero.posicion)
      : null;

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
        <TrendingUp size={16} color={C.navy} />
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.navy, margin: 0 }}>
          Evolución de tu posición
        </p>
      </div>
      <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.4, margin: "0 0 8px" }}>
        Según listados archivados (eje invertido: #1 arriba).
      </p>

      {cargando && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft }}>Cargando gráfica…</p>
      )}
      {error && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay }}>{error}</p>
      )}
      {!cargando && !error && serie.length < 2 && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, lineHeight: 1.4 }}>
          Hacen falta al menos dos puntos (snapshots o actual) para dibujar la evolución.
          Irán apareciendo conforme el vigía archive listados.
        </p>
      )}
      {!cargando && serie.length >= 2 && (
        <Suspense fallback={<p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft }}>Cargando gráfica…</p>}>
          <GraficoEvolucionPosicion serie={serie} colors={C} />
          {resumen != null && (
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 8 }}>
              {resumen === 0
                ? "Sin cambio neto en el periodo mostrado."
                : resumen < 0
                  ? `Mejora neta de ${Math.abs(resumen)} puesto${Math.abs(resumen) === 1 ? "" : "s"} en el periodo.`
                  : `Empeora ${resumen} puesto${resumen === 1 ? "" : "s"} en el periodo.`}
            </p>
          )}
        </Suspense>
      )}
    </div>
  );
}
