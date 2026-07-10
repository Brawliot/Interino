import { useState, useEffect, useMemo } from "react";
import { useDatos } from "../datos.jsx";
import { analizarPorGerencias, colorOportunidad } from "./posicionLista.js";
import { SelectCampo, CampoNumero, AvisoEstimacion, FONT_BODY, FONT_MONO, FONT_DISPLAY } from "./shared.jsx";

export default function MapaOportunidades({ C, Barra, gruposSanidad, grupoDeCategoria, categoriaInicial, puntosIniciales, atras }) {
  const datos = useDatos();
  const categorias = useMemo(() => {
    const g = gruposSanidad.find((x) => x.activo) || gruposSanidad[0];
    return g?.categorias || ["Enfermero/a"];
  }, [gruposSanidad]);

  const [categoria, setCategoria] = useState(categoriaInicial || categorias[0]);
  const [puntos, setPuntos] = useState(puntosIniciales != null ? String(puntosIniciales) : "");
  const [snapshot, setSnapshot] = useState(null);
  const [cargando, setCargando] = useState(false);

  const grupo = grupoDeCategoria(categoria, gruposSanidad);
  const grupoId = grupo?.id || "diplomado";
  const puntosNum = Number(puntos) || 0;

  useEffect(() => {
    let cancel = false;
    setCargando(true);
    const cargar = async () => {
      if (grupo?.activo && datos.tieneDatosReales(categoria, grupoId)) {
        try {
          const snap = await datos.cargarCategoria(grupoId, categoria);
          if (!cancel) setSnapshot(snap);
        } catch {
          if (!cancel) setSnapshot(null);
        }
      } else if (!cancel) setSnapshot(null);
      if (!cancel) setCargando(false);
    };
    cargar();
    return () => { cancel = true; };
  }, [categoria, grupoId, grupo, datos]);

  const obtenerCorte = (g, ambito) => {
    const h = datos.historialCorte(categoria, g, ambito || "");
    return h.length ? h[h.length - 1].puntos : null;
  };

  const filas = snapshot && puntosNum > 0 ? analizarPorGerencias(snapshot, puntosNum, obtenerCorte) : [];

  return (
    <div>
      <Barra titulo="Mapa de oportunidades" atras={atras} />
      <div className="px-5 pb-4">
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginBottom: 8 }}>
          Ordenado de más a menos oportunidad según tu distancia al punto de corte de cada gerencia.
        </p>
        <SelectCampo label="Categoría" value={categoria} onChange={setCategoria} C={C}
          opciones={categorias.map((c) => ({ value: c, label: c }))} />
        <CampoNumero label="Tu puntuación" value={puntos} onChange={setPuntos} C={C} step={0.01} />

        {cargando && <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 10 }}>Cargando…</p>}
        {!snapshot && !cargando && (
          <AvisoEstimacion C={C}>Sin listados reales para esta categoría.</AvisoEstimacion>
        )}

        <div className="flex flex-col gap-2 mt-4">
          {filas.map((g) => {
            const col = colorOportunidad(g.distanciaCorte);
            return (
              <div
                key={g.gerencia}
                style={{
                  background: C.card,
                  border: `1.5px solid ${C.line}`,
                  borderLeft: `5px solid ${col.text}`,
                  borderRadius: "12px 4px 12px 4px",
                  padding: "12px 14px",
                }}
              >
                <div className="flex items-center justify-between">
                  <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy, margin: 0 }}>{g.gerencia}</p>
                  <span style={{ background: col.bg, color: col.text, fontFamily: FONT_MONO, fontSize: 10, padding: "3px 8px", borderRadius: 8, fontWeight: 600 }}>
                    {col.label}
                  </span>
                </div>
                <div className="flex gap-4 mt-2" style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.inkSoft }}>
                  <span>Pos. <strong style={{ color: C.navy, fontFamily: FONT_DISPLAY, fontSize: 16 }}>#{g.mejorPosicion}</strong></span>
                  <span>{g.totalInscritos} inscritos</span>
                  <span>
                    {g.distanciaCorte != null
                      ? `${g.distanciaCorte >= 0 ? "+" : ""}${g.distanciaCorte.toFixed(1)} al corte`
                      : "Sin corte histórico"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
