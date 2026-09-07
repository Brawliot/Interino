import { useState, useEffect, useMemo } from "react";
import { useDatos, useCapaDatos, ambitoLegible } from "../datos.jsx";
import { analizarPorGerencias, analizarGerenciaDestino } from "./posicionLista.js";
import { SelectCampo, CampoNumero, AvisoEstimacion, BotonSecundario, FONT_BODY, FONT_MONO, FONT_DISPLAY } from "./shared.jsx";

/**
 * Simulador de provincia/gerencia: inserta una puntuación hipotética en listados reales SESCAM.
 */
export default function SimuladorGerencia({ C, Barra, gruposSanidad, grupoDeCategoria, categoriaInicial, puntosIniciales, atras }) {
  const datos = useDatos();
  const capaCtx = useCapaDatos();
  // Preferir capa sanidad CLM explícita (evita chocarse con edu/admin activo en Más).
  const capaSanidad = useMemo(() => {
    try {
      return datos?.paraSector?.("clm", "sanidad") || capaCtx || datos;
    } catch {
      return capaCtx || datos;
    }
  }, [datos, capaCtx]);

  const categorias = useMemo(() => {
    const grupos = capaSanidad?.gruposSanidad?.length ? capaSanidad.gruposSanidad : gruposSanidad;
    const vistos = new Set();
    const out = [];
    for (const g of grupos || []) {
      if (!g.activo) continue;
      for (const c of g.categorias || []) {
        if (vistos.has(c) || !capaSanidad.tieneDatosReales?.(c, g.id)) continue;
        vistos.add(c);
        out.push(c);
      }
    }
    return out.length ? out : ["Enfermero/a"];
  }, [gruposSanidad, capaSanidad]);

  const [categoria, setCategoria] = useState(categoriaInicial || categorias[0]);
  const [puntos, setPuntos] = useState(puntosIniciales != null ? String(puntosIniciales) : "");
  const [gerencia, setGerencia] = useState("");
  const [gerencias, setGerencias] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [verTodas, setVerTodas] = useState(false);
  const [expandida, setExpandida] = useState(null);

  const gruposRef = capaSanidad?.gruposSanidad?.length ? capaSanidad.gruposSanidad : gruposSanidad;
  const grupo = grupoDeCategoria(categoria, gruposRef);
  const grupoId = grupo?.id || "diplomado";
  const puntosNum = Number(puntos) || 0;

  useEffect(() => {
    if (categorias.length && !categorias.includes(categoria)) {
      setCategoria(categorias[0]);
    }
  }, [categorias, categoria]);

  useEffect(() => {
    let cancel = false;
    setCargando(true);
    const cargar = async () => {
      if (grupo?.activo && capaSanidad.tieneDatosReales?.(categoria, grupoId)) {
        try {
          const snap = await capaSanidad.cargarCategoria(grupoId, categoria);
          const gs = await capaSanidad.gerenciasDeCategoria(grupoId, categoria);
          if (!cancel) {
            setSnapshot(snap);
            setGerencias(gs);
            setGerencia((g) => g || gs[0] || "");
          }
        } catch {
          if (!cancel) {
            setSnapshot(null);
            setGerencias([]);
            setGerencia("");
          }
        }
      } else if (!cancel) {
        setSnapshot(null);
        setGerencias([]);
        setGerencia("");
      }
      if (!cancel) setCargando(false);
    };
    cargar();
    return () => {
      cancel = true;
    };
  }, [categoria, grupoId, grupo, capaSanidad]);

  const obtenerCorte = (g, ambito) => {
    const h = capaSanidad.historialCorte?.(categoria, g, ambito || "", grupoId) || [];
    return h.length ? h[h.length - 1].puntos : null;
  };

  const destino =
    snapshot && gerencia && puntosNum > 0
      ? analizarGerenciaDestino(snapshot, puntosNum, gerencia, obtenerCorte)
      : null;

  const todas =
    snapshot && puntosNum > 0
      ? analizarPorGerencias(snapshot, puntosNum, obtenerCorte).sort(
          (a, b) => (a.mejorPosicion ?? 9999) - (b.mejorPosicion ?? 9999),
        )
      : [];

  const mejor = destino?.slice().sort((a, b) => a.posicion - b.posicion)[0];

  return (
    <div>
      <Barra titulo="Simulador de provincia" atras={atras} />
      <div className="px-5 pb-4">
        <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft, lineHeight: 1.45, margin: "0 0 14px" }}>
          Estima en qué puesto quedarías en cada gerencia SESCAM (CLM) con una puntuación hipotética. Es una
          inserción en el listado publicado: no simula inscripción real ni cupos.
        </p>
        <SelectCampo
          label="Categoría"
          value={categoria}
          onChange={setCategoria}
          C={C}
          opciones={categorias.map((c) => ({ value: c, label: c }))}
        />
        <CampoNumero label="Tu puntuación" value={puntos} onChange={setPuntos} C={C} step={0.01} />
        <SelectCampo
          label="Gerencia / provincia destino"
          value={gerencia}
          onChange={setGerencia}
          C={C}
          opciones={gerencias.map((g) => ({ value: g, label: g }))}
        />

        {cargando && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 10 }}>Cargando listados…</p>
        )}

        {!snapshot && !cargando && (
          <AvisoEstimacion C={C}>
            Sin datos reales para esta categoría. El simulador necesita listados del SESCAM disponibles en la app.
          </AvisoEstimacion>
        )}

        {mejor && (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              background: C.navy,
              borderRadius: "14px 5px 14px 5px",
              color: "#fff",
            }}
          >
            <p style={{ fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1.5, margin: 0 }}>
              Con <strong>{puntosNum.toFixed(2)}</strong> puntos en <strong>{categoria}</strong> ·{" "}
              <strong>{gerencia}</strong>
              {mejor.ambito ? ` (${ambitoLegible(mejor.ambito)})` : ""}, estarías en la posición{" "}
              <strong style={{ fontFamily: FONT_DISPLAY, fontSize: 22 }}>#{mejor.posicion}</strong> de {mejor.total}{" "}
              personas.
            </p>
            {destino?.length > 1 && (
              <div style={{ marginTop: 12 }}>
                {destino.map((d) => (
                  <p
                    key={d.ambito || "x"}
                    style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.goldSoft, margin: "4px 0 0" }}
                  >
                    {ambitoLegible(d.ambito) || "Ámbito"}: #{d.posicion} / {d.total}
                    {d.corte != null ? ` · corte ${d.corte.toFixed(2)}` : ""}
                  </p>
                ))}
              </div>
            )}
            {mejor.corte != null && destino?.length === 1 && (
              <p style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.goldSoft, marginTop: 10 }}>
                Punto mínimo admitido: {mejor.corte.toFixed(2)} pt · Distancia:{" "}
                {mejor.distanciaCorte >= 0 ? "+" : ""}
                {mejor.distanciaCorte?.toFixed(2)} pt
              </p>
            )}
          </div>
        )}

        {gerencias.length > 0 && (
          <BotonSecundario C={C} onClick={() => setVerTodas(!verTodas)}>
            {verTodas ? "Ocultar todas las gerencias" : `Ver posición en las ${gerencias.length} gerencias`}
          </BotonSecundario>
        )}

        {verTodas && todas.length > 0 && (
          <div className="mt-3" style={{ border: `1px solid ${C.line}`, borderRadius: "10px 3px 10px 3px", overflow: "hidden" }}>
            <div className="flex" style={{ background: C.navy, padding: "9px 14px" }}>
              <span style={{ flex: 1, fontFamily: FONT_MONO, fontSize: 10.5, color: C.goldSoft }}>GERENCIA</span>
              <span style={{ flex: "0 0 50px", fontFamily: FONT_MONO, fontSize: 10.5, color: C.goldSoft }}>POS.</span>
              <span style={{ flex: "0 0 70px", fontFamily: FONT_MONO, fontSize: 10.5, color: C.goldSoft }}>CORTE</span>
            </div>
            {todas.map((g, idx) => (
              <div key={g.gerencia}>
                <button
                  type="button"
                  className="w-full flex items-center text-left focus:outline-none"
                  onClick={() => setExpandida(expandida === g.gerencia ? null : g.gerencia)}
                  style={{
                    padding: "10px 14px",
                    borderTop: `1px solid ${C.line}`,
                    background: idx % 2 ? C.paperDeep : C.card,
                    border: "none",
                  }}
                >
                  <span style={{ flex: 1, fontFamily: FONT_BODY, fontSize: 13, color: C.ink }}>{g.gerencia}</span>
                  <span style={{ flex: "0 0 50px", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: C.navy }}>
                    #{g.mejorPosicion}
                  </span>
                  <span style={{ flex: "0 0 70px", fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft }}>
                    {g.corte?.toFixed(1) ?? "—"}
                  </span>
                </button>
                {expandida === g.gerencia && (g.detalleAmbitos || []).length > 0 && (
                  <div style={{ padding: "0 14px 10px", background: idx % 2 ? C.paperDeep : C.card }}>
                    {(g.detalleAmbitos || []).map((d) => (
                      <p
                        key={`${d.ambito}-${d.posicion}`}
                        style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, margin: "4px 0 0" }}
                      >
                        {ambitoLegible(d.ambito) || "—"}: #{d.posicion} / {d.total}
                        {d.corte != null ? ` · corte ${Number(d.corte).toFixed(1)}` : ""}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
