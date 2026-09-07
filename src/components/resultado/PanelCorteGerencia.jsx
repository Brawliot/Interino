import { lazy, Suspense } from "react";
import { TrendingUp } from "lucide-react";
import { C, FONT_BODY, FONT_MONO } from "../../theme.js";
import { etiquetaLista } from "../../utils/etiquetasLista.js";
import { MIN_HISTORICO_TENDENCIA, zonaRiesgo } from "../../utils/tendenciaCorte.js";

const GraficoHistoricoCorte = lazy(() => import("../GraficoHistoricoCorte.jsx"));

export default function PanelCorteGerencia({ categoria, gerencia, ambito, puntos, historial }) {
  if (historial.length === 0) {
    return (
      <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, lineHeight: 1.45, margin: 0 }}>
        Aún no hay histórico para {etiquetaLista(categoria, gerencia, ambito)}. Se irá completando con
        más publicaciones del listado.
      </p>
    );
  }
  const hayTendencia = historial.length >= MIN_HISTORICO_TENDENCIA;
  const ult = historial[historial.length - 1];
  const diff = (puntos - ult.puntos).toFixed(2);
  const yaLlamado = puntos >= ult.puntos;
  const riesgo = zonaRiesgo(puntos, historial);
  const rango = Math.max(Math.abs(diff) * 2, 1);
  const pct = Math.min(100, Math.max(0, 50 + (diff / rango) * 50));
  const RIESGO_TXT = {
    llamado: { color: C.ok, texto: "Tu puntuación ya supera el punto de corte. Mantente localizable." },
    alto: {
      color: C.clay,
      texto: `Estimación orientativa (no predicción de llamamiento): al ritmo reciente del corte, podrías acercarte en unas ${riesgo.convocatorias} convocatoria${riesgo.convocatorias > 1 ? "s" : ""}.`,
    },
    medio: {
      color: C.gold,
      texto: `Estimación orientativa: unas ${riesgo.convocatorias} convocatorias al ritmo reciente del corte. No garantiza llamamiento.`,
    },
    bajo: {
      color: C.inkSoft,
      texto: "El corte se mueve despacio en esta categoría. Todavía queda camino (estimación orientativa).",
    },
    sin_historico: { color: C.inkSoft, texto: null },
  };
  const info = RIESGO_TXT[riesgo.nivel];

  return (
    <div>
      <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, margin: 0 }}>
        Según el listado publicado · mínimo admitido: {ult.puntos.toFixed(2)} pts ({ult.fecha})
      </p>
      <div
        style={{
          height: 8,
          background: C.paperDeep,
          borderRadius: 6,
          marginTop: 12,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: yaLlamado ? C.ok : C.clay,
            borderRadius: 6,
          }}
        />
      </div>
      <p
        style={{
          fontFamily: FONT_BODY,
          fontSize: 13,
          color: yaLlamado ? C.ok : C.clay,
          fontWeight: 700,
          marginTop: 10,
          marginBottom: 0,
        }}
      >
        {yaLlamado
          ? `Superas el mínimo admitido por ${Math.abs(diff)} puntos.`
          : `Te faltan ${Math.abs(diff)} puntos para el mínimo admitido.`}
      </p>
      {hayTendencia ? (
        <>
          <Suspense fallback={<div style={{ height: 52, marginTop: 14 }} />}>
            <GraficoHistoricoCorte historial={historial} colors={C} />
          </Suspense>
          <p style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.inkSoft, marginTop: 2 }}>
            Punto de corte por convocatoria, últimas {historial.length} publicaciones
          </p>
          {info.texto && (
            <div className="flex items-start gap-2" style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
              <TrendingUp size={14} color={info.color} style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: info.color, lineHeight: 1.4, fontWeight: 600, margin: 0 }}>
                {info.texto}
              </p>
            </div>
          )}
        </>
      ) : (
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            color: C.inkSoft,
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${C.line}`,
            lineHeight: 1.45,
          }}
        >
          Hace falta más historial de publicaciones para estimar tendencia.
        </p>
      )}
    </div>
  );
}
