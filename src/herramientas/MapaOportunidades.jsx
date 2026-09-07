import { useEffect, useMemo, useState } from "react";
import { useDatos } from "../datos.jsx";
import { analizarPorGerencias, colorOportunidad } from "./posicionLista.js";
import { CLM_PATH, geoDeGerencia } from "./gerenciasGeo.js";
import { SelectCampo, CampoNumero, AvisoEstimacion, FONT_BODY, FONT_MONO, FONT_DISPLAY } from "./shared.jsx";
import { desbloquearLogro } from "./gamificacion.js";

export default function MapaOportunidades({ C, Barra, gruposSanidad, grupoDeCategoria, categoriaInicial, puntosIniciales, atras }) {
  const datos = useDatos();
  const capa = useMemo(() => {
    try {
      return datos?.paraSector?.("clm", "sanidad") || datos;
    } catch {
      return datos;
    }
  }, [datos]);

  const categorias = useMemo(() => {
    const grupos = capa?.gruposSanidad?.length ? capa.gruposSanidad : gruposSanidad;
    const out = [];
    const vistos = new Set();
    for (const g of grupos || []) {
      if (!g.activo) continue;
      for (const c of g.categorias || []) {
        if (vistos.has(c) || !capa.tieneDatosReales?.(c, g.id)) continue;
        vistos.add(c);
        out.push(c);
      }
    }
    return out.length ? out : ["Enfermero/a"];
  }, [capa, gruposSanidad]);

  const [categoria, setCategoria] = useState(categoriaInicial || categorias[0]);
  const [puntos, setPuntos] = useState(puntosIniciales != null ? String(puntosIniciales) : "");
  const [snapshot, setSnapshot] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [seleccion, setSeleccion] = useState(null);

  const gruposRef = capa?.gruposSanidad?.length ? capa.gruposSanidad : gruposSanidad;
  const grupo = grupoDeCategoria(categoria, gruposRef);
  const grupoId = grupo?.id || "diplomado";
  const puntosNum = Number(puntos) || 0;

  useEffect(() => {
    desbloquearLogro("mapa_usado");
  }, []);

  useEffect(() => {
    let cancel = false;
    setCargando(true);
    (async () => {
      if (grupo?.activo && capa.tieneDatosReales?.(categoria, grupoId)) {
        try {
          const snap = await capa.cargarCategoria(grupoId, categoria);
          if (!cancel) setSnapshot(snap);
        } catch {
          if (!cancel) setSnapshot(null);
        }
      } else if (!cancel) setSnapshot(null);
      if (!cancel) setCargando(false);
    })();
    return () => {
      cancel = true;
    };
  }, [categoria, grupoId, grupo, capa]);

  const obtenerCorte = (g, ambito) => {
    const h = capa.historialCorte?.(categoria, g, ambito || "", grupoId) || [];
    return h.length ? h[h.length - 1].puntos : null;
  };

  const filas = snapshot && puntosNum > 0 ? analizarPorGerencias(snapshot, puntosNum, obtenerCorte) : [];
  const porNombre = useMemo(() => new Map(filas.map((f) => [f.gerencia, f])), [filas]);

  return (
    <div>
      <Barra titulo="Mi mapa de oportunidades" atras={atras} />
      <div className="px-5 pb-4">
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginBottom: 8, lineHeight: 1.45 }}>
          Mapa de gerencias SESCAM según tu distancia al punto de corte histórico. No indica plazas abiertas ni
          llamamientos.
        </p>
        <SelectCampo
          label="Categoría"
          value={categoria}
          onChange={setCategoria}
          C={C}
          opciones={categorias.map((c) => ({ value: c, label: c }))}
        />
        <CampoNumero label="Tu puntuación" value={puntos} onChange={setPuntos} C={C} step={0.01} />

        {cargando && <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 10 }}>Cargando…</p>}
        {!snapshot && !cargando && <AvisoEstimacion C={C}>Sin listados reales para esta categoría.</AvisoEstimacion>}

        {filas.length > 0 && (
          <div
            style={{
              marginTop: 14,
              background: C.card,
              border: `1.5px solid ${C.line}`,
              borderRadius: "16px 6px 16px 6px",
              padding: 10,
            }}
          >
            <svg viewBox="0 0 100 100" style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Mapa CLM">
              <path d={CLM_PATH} fill={C.paperDeep} stroke={C.navy} strokeWidth="0.6" />
              {Object.entries(
                // dedupe Toledo AE near Toledo for display if both exist
                Object.fromEntries(
                  filas
                    .map((f) => [f.gerencia, f])
                    .filter(([name]) => geoDeGerencia(name)),
                ),
              ).map(([name, g]) => {
                const geo = geoDeGerencia(name);
                if (!geo) return null;
                const col = colorOportunidad(g.distanciaCorte);
                const activo = seleccion === name;
                return (
                  <g key={name} onClick={() => setSeleccion(name)} style={{ cursor: "pointer" }}>
                    <circle
                      cx={geo.x}
                      cy={geo.y}
                      r={activo ? 4.2 : 3.2}
                      fill={col.text}
                      stroke="#fff"
                      strokeWidth="0.5"
                    />
                    <title>
                      {name}: #{g.mejorPosicion} · {col.label}
                    </title>
                  </g>
                );
              })}
            </svg>
            <div className="flex flex-wrap gap-2 mt-2 px-1">
              {["Buena", "Ajustada", "Por debajo"].map((lab) => {
                const sample =
                  lab === "Buena" ? colorOportunidad(50) : lab === "Ajustada" ? colorOportunidad(10) : colorOportunidad(-10);
                return (
                  <span key={lab} style={{ fontFamily: FONT_MONO, fontSize: 10, color: sample.text }}>
                    ● {lab}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {seleccion && porNombre.get(seleccion) && (
          <div style={{ marginTop: 12, padding: 14, background: C.navy, color: "#fff", borderRadius: 12 }}>
            <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, margin: 0 }}>{seleccion}</p>
            <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.goldSoft, margin: "6px 0 0" }}>
              Pos. #{porNombre.get(seleccion).mejorPosicion} · {porNombre.get(seleccion).totalInscritos} inscritos ·{" "}
              {porNombre.get(seleccion).distanciaCorte != null
                ? `${porNombre.get(seleccion).distanciaCorte >= 0 ? "+" : ""}${porNombre.get(seleccion).distanciaCorte.toFixed(1)} al corte`
                : "Sin corte"}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 mt-4">
          {filas.map((g) => {
            const col = colorOportunidad(g.distanciaCorte);
            return (
              <button
                key={g.gerencia}
                type="button"
                onClick={() => setSeleccion(g.gerencia)}
                className="text-left focus:outline-none"
                style={{
                  background: C.card,
                  border: `1.5px solid ${seleccion === g.gerencia ? C.navy : C.line}`,
                  borderLeft: `5px solid ${col.text}`,
                  borderRadius: "12px 4px 12px 4px",
                  padding: "12px 14px",
                }}
              >
                <div className="flex items-center justify-between">
                  <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy, margin: 0 }}>{g.gerencia}</p>
                  <span
                    style={{
                      background: col.bg,
                      color: col.text,
                      fontFamily: FONT_MONO,
                      fontSize: 10,
                      padding: "3px 8px",
                      borderRadius: 8,
                      fontWeight: 600,
                    }}
                  >
                    {col.label}
                  </span>
                </div>
                <div className="flex gap-4 mt-2" style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.inkSoft }}>
                  <span>
                    Pos.{" "}
                    <strong style={{ color: C.navy, fontFamily: FONT_DISPLAY, fontSize: 16 }}>#{g.mejorPosicion}</strong>
                  </span>
                  <span>{g.totalInscritos} inscritos</span>
                  <span>
                    {g.distanciaCorte != null
                      ? `${g.distanciaCorte >= 0 ? "+" : ""}${g.distanciaCorte.toFixed(1)} al corte`
                      : "Sin corte histórico"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
