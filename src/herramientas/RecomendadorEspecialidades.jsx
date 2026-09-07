import { useMemo, useState } from "react";
import { useDatos, useCapaDatos } from "../datos.jsx";
import { claveEspecialidad, nombreUiDesdeClave, plazasAfinDesdeBolsa, codigoCuerpoDesdeGrupo } from "../educacion-afin.js";
import { CUERPO_SLUG } from "../educacion.js";
import { AvisoEstimacion, SelectCampo, FONT_BODY, FONT_MONO } from "./shared.jsx";

/**
 * Recomendador de especialidades (educación CLM): propia + afines + score simple por tamaño de lista.
 */
export default function RecomendadorEspecialidades({ C, Barra, atras }) {
  const datos = useDatos();
  const capa = useCapaDatos();
  const edu = useMemo(() => {
    try {
      return datos?.paraSector?.("clm", "educacion", { modoListadoEducacion: "bolsa" }) || capa;
    } catch {
      return capa;
    }
  }, [datos, capa]);

  const grupos = edu?.gruposSanidad || [];
  const [grupoId, setGrupoId] = useState(grupos.find((g) => g.activo)?.id || grupos[0]?.id || "secundaria");
  const grupo = grupos.find((g) => g.id === grupoId) || grupos[0];
  const categorias = grupo?.categorias || [];
  const [categoria, setCategoria] = useState(categorias[0] || "");
  const [cargando, setCargando] = useState(false);
  const [resultados, setResultados] = useState([]);

  const afinidad = datos?.afinidadEducacion || edu?.afinidadDoc || null;
  const cuerpo = codigoCuerpoDesdeGrupo(grupoId, CUERPO_SLUG) || "590";

  async function calcular() {
    setCargando(true);
    setResultados([]);
    try {
      const meta = edu?.metaEspecialidad?.(categoria, grupoId) || null;
      const clave = meta
        ? claveEspecialidad(meta.codigo, meta.nombre)
        : categoria;
      const afines = plazasAfinDesdeBolsa(afinidad, cuerpo, clave).map(nombreUiDesdeClave);
      const candidatas = [categoria, ...afines].filter((c, i, a) => c && a.indexOf(c) === i);

      const scored = [];
      for (const cat of candidatas.slice(0, 20)) {
        const gid = grupos.find((g) => (g.categorias || []).includes(cat))?.id || grupoId;
        if (!edu.tieneDatosReales?.(cat, gid)) {
          scored.push({
            categoria: cat,
            propia: cat === categoria,
            afin: cat !== categoria,
            total: null,
            score: cat === categoria ? 50 : 30,
            nota: "Sin listado en la app",
          });
          continue;
        }
        try {
          // eslint-disable-next-line no-await-in-loop
          const filas = await edu.obtenerListadoCompleto(gid, cat, "", "");
          const total = filas?.length || 0;
          // Menos competencia relativa (listas más cortas) → score más alto; propia bolsa bonus
          const base = total > 0 ? Math.max(5, 100 - Math.min(90, Math.log10(total + 1) * 35)) : 20;
          const score = Math.round(base + (cat === categoria ? 15 : 0));
          scored.push({
            categoria: cat,
            propia: cat === categoria,
            afin: cat !== categoria,
            total,
            score,
            nota: total ? `${total.toLocaleString("es-ES")} en bolsa` : "Sin filas",
          });
        } catch {
          scored.push({
            categoria: cat,
            propia: cat === categoria,
            afin: cat !== categoria,
            total: null,
            score: 10,
            nota: "Error al cargar",
          });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      setResultados(scored);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div>
      <Barra titulo="Recomendador de especialidades" atras={atras} />
      <div className="px-5 pb-6">
        <AvisoEstimacion C={C}>
          Solo educación CLM. Combina tu especialidad con plazas afines (Orden 32/2018). El score es orientativo (tamaño
          de lista + bonus propia bolsa), no predice adjudicación.
        </AvisoEstimacion>

        {grupos.length > 0 && (
          <SelectCampo
            label="Cuerpo / grupo"
            value={grupoId}
            onChange={(v) => {
              setGrupoId(v);
              const g = grupos.find((x) => x.id === v);
              setCategoria(g?.categorias?.[0] || "");
            }}
            C={C}
            opciones={grupos.filter((g) => g.activo !== false).map((g) => ({ value: g.id, label: g.nombre || g.id }))}
          />
        )}
        <SelectCampo
          label="Tu especialidad"
          value={categoria}
          onChange={setCategoria}
          C={C}
          opciones={categorias.map((c) => ({ value: c, label: c }))}
        />

        <button
          type="button"
          onClick={calcular}
          disabled={!categoria || cargando}
          className="w-full font-bold focus:outline-none"
          style={{
            background: C.navy,
            color: "#fff",
            padding: "12px",
            borderRadius: 10,
            border: "none",
            fontFamily: FONT_BODY,
            marginTop: 8,
            opacity: !categoria || cargando ? 0.6 : 1,
          }}
        >
          {cargando ? "Calculando…" : "Recomendar"}
        </button>

        <div className="flex flex-col gap-2 mt-4">
          {resultados.map((r) => (
            <div
              key={r.categoria}
              style={{
                background: C.card,
                border: `1px solid ${C.line}`,
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div className="flex justify-between gap-2">
                <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5, color: C.navy, margin: 0 }}>
                  {r.categoria}
                </p>
                <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.gold }}>{r.score}</span>
              </div>
              <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, margin: "4px 0 0" }}>
                {r.propia ? "Propia" : "Afín"} · {r.nota}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
