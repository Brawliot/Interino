import { useState, useMemo } from "react";
import {
  puntosParaPosicion,
  umbralesIntercambio,
  rankingAnonimo,
  percentilesPuntos,
} from "./posicionLista.js";
import { useListadoSanidad } from "./useListadoSanidad.js";
import { SelectCampo, CampoNumero, AvisoEstimacion, FONT_BODY, FONT_MONO, FONT_DISPLAY } from "./shared.jsx";
import { desbloquearLogro } from "./gamificacion.js";

/**
 * Calculadora inversa + umbrales anónimos #100/#500/#1000 + ranking anónimo.
 */
export default function AnalisisPuntosListado({
  C,
  Barra,
  gruposSanidad,
  grupoDeCategoria,
  categoriaInicial,
  puntosIniciales,
  atras,
  onIrGerencia,
}) {
  const L = useListadoSanidad(gruposSanidad, grupoDeCategoria, categoriaInicial);
  const [puestoObjetivo, setPuestoObjetivo] = useState("100");
  const [misPuntos, setMisPuntos] = useState(puntosIniciales != null ? String(puntosIniciales) : "");

  const inversa = useMemo(
    () => puntosParaPosicion(L.filas, Number(puestoObjetivo) || 0),
    [L.filas, puestoObjetivo],
  );
  const umbrales = useMemo(() => umbralesIntercambio(L.filas), [L.filas]);
  const ranking = useMemo(() => rankingAnonimo(L.filas, Number(misPuntos) || 0), [L.filas, misPuntos]);
  const percentiles = useMemo(() => percentilesPuntos(L.filas), [L.filas]);

  const gap =
    inversa.ok && Number(misPuntos) > 0
      ? Math.round((inversa.puntosMinimos - Number(misPuntos)) * 100) / 100
      : null;

  return (
    <div>
      <Barra titulo="Puntos ↔ posición" atras={atras} />
      <div className="px-5 pb-6">
        <AvisoEstimacion C={C}>
          Umbrales anónimos del listado publicado (sin nombres). No es un intercambio real entre aspirantes ni una
          predicción de llamamiento.
        </AvisoEstimacion>

        <SelectCampo
          label="Categoría"
          value={L.categoria}
          onChange={L.setCategoria}
          C={C}
          opciones={L.categorias.map((c) => ({ value: c, label: c }))}
        />
        <SelectCampo
          label="Gerencia"
          value={L.gerencia}
          onChange={L.setGerencia}
          C={C}
          opciones={L.gerencias.map((g) => ({ value: g, label: g }))}
        />
        {L.ambitos.length > 1 && (
          <SelectCampo
            label="Ámbito"
            value={L.ambito}
            onChange={L.setAmbito}
            C={C}
            opciones={L.ambitos.map((a) => ({ value: a, label: a }))}
          />
        )}

        {L.cargando && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft }}>Cargando listado…</p>
        )}

        <h3 style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy, margin: "18px 0 8px" }}>
          Calculadora inversa
        </h3>
        <CampoNumero label="Puesto objetivo" value={puestoObjetivo} onChange={setPuestoObjetivo} C={C} />
        <CampoNumero label="Tus puntos actuales (opcional)" value={misPuntos} onChange={setMisPuntos} C={C} step={0.01} />

        {inversa.ok && (
          <div style={{ background: C.navy, color: "#fff", borderRadius: "14px 5px 14px 5px", padding: 16, marginTop: 12 }}>
            <p style={{ fontFamily: FONT_BODY, fontSize: 13, margin: 0, lineHeight: 1.45 }}>
              Para el puesto <strong>#{inversa.posicion}</strong> harían falta unos{" "}
              <strong style={{ fontFamily: FONT_DISPLAY, fontSize: 22 }}>{inversa.puntosMinimos.toFixed(2)}</strong> puntos
              (hoy hay {inversa.total} en el listado).
            </p>
            {gap != null && (
              <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.goldSoft, margin: "10px 0 0" }}>
                {gap > 0 ? `Te faltan ~${gap.toFixed(2)} pt` : gap < 0 ? `Vas ~${Math.abs(gap).toFixed(2)} pt por encima` : "En el umbral"}
              </p>
            )}
            <p style={{ fontFamily: FONT_BODY, fontSize: 11, opacity: 0.85, margin: "8px 0 0" }}>{inversa.avisoEmpates}</p>
          </div>
        )}
        {!inversa.ok && inversa.mensaje && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, marginTop: 8 }}>{inversa.mensaje}</p>
        )}

        <h3 style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy, margin: "22px 0 8px" }}>
          Referencias anónimas (#100 / #500 / #1000)
        </h3>
        <div className="flex flex-col gap-2">
          {umbrales.map((u) => (
            <div
              key={u.posicion}
              style={{
                background: C.card,
                border: `1px solid ${C.line}`,
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontFamily: FONT_BODY, fontWeight: 700, color: C.navy }}>#{u.posicion}</span>
              {u.ok ? (
                <span style={{ fontFamily: FONT_MONO, fontSize: 14, color: C.ink }}>{u.puntos.toFixed(2)} pt</span>
              ) : (
                <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft }}>
                  {u.motivo === "fuera_rango" ? `Solo ${u.total} inscritos` : "—"}
                </span>
              )}
            </div>
          ))}
        </div>

        <h3 style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy, margin: "22px 0 8px" }}>
          Ranking anónimo
        </h3>
        {ranking && Number(misPuntos) > 0 ? (
          <div style={{ background: C.paperDeep, borderRadius: 12, padding: 14 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: C.navy, margin: 0 }}>
              #{ranking.posicion}
              <span style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: C.inkSoft }}>
                {" "}
                de {ranking.total}
              </span>
            </p>
            <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, margin: "6px 0 0" }}>
              Por delante del {ranking.percentil}% · {ranking.delante} delante · {ranking.detras} detrás
            </p>
            {percentiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {percentiles.map((p) => (
                  <span
                    key={p.label}
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 10.5,
                      background: C.card,
                      padding: "4px 8px",
                      borderRadius: 8,
                      color: C.inkSoft,
                    }}
                  >
                    {p.label}: {p.puntos.toFixed(1)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft }}>Introduce tus puntos para situarte en el listado.</p>
        )}

        {inversa.ok && onIrGerencia && (
          <button
            type="button"
            onClick={() => {
              desbloquearLogro("baremo_usado");
              onIrGerencia(inversa.puntosMinimos);
            }}
            className="w-full font-bold focus:outline-none mt-4"
            style={{
              background: C.gold,
              color: "#fff",
              padding: "12px",
              borderRadius: 10,
              border: "none",
              fontFamily: FONT_BODY,
              fontSize: 13,
            }}
          >
            Ver oportunidades con {inversa.puntosMinimos.toFixed(1)} pt
          </button>
        )}
      </div>
    </div>
  );
}
