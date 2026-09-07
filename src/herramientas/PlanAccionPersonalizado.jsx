import { useMemo, useState, useEffect } from "react";
import { useDatos } from "../datos.jsx";
import { analizarPorGerencias, colorOportunidad, puntosParaPosicion, filasAPuntos } from "./posicionLista.js";
import { SelectCampo, CampoNumero, AvisoEstimacion, FONT_BODY, FONT_MONO } from "./shared.jsx";
import { desbloquearLogro } from "./gamificacion.js";
import { puntosMeritoIncremental } from "./baremoReglas.js";

/**
 * Checklist orientativo a partir de puntos, corte y mapa de gerencias.
 */
export default function PlanAccionPersonalizado({
  C,
  Barra,
  gruposSanidad,
  grupoDeCategoria,
  categoriaInicial,
  puntosIniciales,
  atras,
  onAbrirMapa,
  onAbrirInversa,
}) {
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
    return (grupos || [])
      .filter((g) => g.activo)
      .flatMap((g) => g.categorias || [])
      .filter((c, i, arr) => arr.indexOf(c) === i && capa.tieneDatosReales?.(c, grupoDeCategoria(c, grupos)?.id));
  }, [capa, gruposSanidad, grupoDeCategoria]);

  const [categoria, setCategoria] = useState(categoriaInicial || categorias[0] || "");
  const [puntos, setPuntos] = useState(puntosIniciales != null ? String(puntosIniciales) : "");
  const [puestoMeta, setPuestoMeta] = useState("100");
  const [snapshot, setSnapshot] = useState(null);
  const [filasGerencia, setFilasGerencia] = useState([]);

  const gruposRef = capa?.gruposSanidad?.length ? capa.gruposSanidad : gruposSanidad;
  const grupo = grupoDeCategoria(categoria, gruposRef);
  const grupoId = grupo?.id || "diplomado";
  const puntosNum = Number(puntos) || 0;

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!capa.tieneDatosReales?.(categoria, grupoId)) {
        if (!cancel) setSnapshot(null);
        return;
      }
      try {
        const snap = await capa.cargarCategoria(grupoId, categoria);
        if (!cancel) setSnapshot(snap);
        const gs = await capa.gerenciasDeCategoria(grupoId, categoria);
        if (gs[0] && capa.obtenerListadoCompleto) {
          const filas = await capa.obtenerListadoCompleto(grupoId, categoria, gs[0], "");
          if (!cancel) setFilasGerencia(filasAPuntos(filas));
        }
      } catch {
        if (!cancel) {
          setSnapshot(null);
          setFilasGerencia([]);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [capa, categoria, grupoId]);

  const obtenerCorte = (g, ambito) => {
    const h = capa.historialCorte?.(categoria, g, ambito || "", grupoId) || [];
    return h.length ? h[h.length - 1].puntos : null;
  };

  const gerencias =
    snapshot && puntosNum > 0 ? analizarPorGerencias(snapshot, puntosNum, obtenerCorte) : [];
  const buenas = gerencias.filter((g) => (g.distanciaCorte ?? -999) >= 0).slice(0, 5);
  const inversa = puntosParaPosicion(filasGerencia, Number(puestoMeta) || 100);
  const gap = inversa.ok && puntosNum ? Math.round((inversa.puntosMinimos - puntosNum) * 100) / 100 : null;
  const mesesExtra = gap != null && gap > 0 ? Math.ceil(gap / puntosMeritoIncremental("experiencia", 1)) : 0;
  const horasCurso = gap != null && gap > 0 ? Math.ceil(gap / 0.1) : 0;

  const acciones = useMemo(() => {
    const out = [];
    if (!puntosNum) {
      out.push({ id: "pts", texto: "Introduce tu puntuación estimada (simulador de baremo) para personalizar el plan." });
      return out;
    }
    if (buenas.length) {
      out.push({
        id: "geo",
        texto: `Prioriza gerencias con corte a tu favor: ${buenas
          .slice(0, 3)
          .map((g) => g.gerencia)
          .join(", ")}.`,
      });
    } else if (gerencias.length) {
      out.push({
        id: "geo2",
        texto: "Con esos puntos estás por debajo del corte en la mayoría de gerencias: mira el mapa y el gap al corte.",
      });
    }
    if (gap != null && gap > 0) {
      out.push({
        id: "merito",
        texto: `Para ~#${puestoMeta} en una gerencia de referencia te faltan ~${gap.toFixed(1)} pt (≈ ${mesesExtra} mes(es) SNS o ~${horasCurso} h de formación continuada, orientativo).`,
      });
    } else if (gap != null && gap <= 0) {
      out.push({
        id: "ok",
        texto: `Con tus puntos ya estarías en torno al umbral del puesto #${puestoMeta} en el listado de referencia.`,
      });
    }
    out.push({
      id: "portal",
      texto: "Revisa teléfono y email en Selecta: muchos llamamientos se pierden por datos desactualizados.",
    });
    out.push({
      id: "seguir",
      texto: "Guarda favoritos de las gerencias clave y activa avisos si cambia la posición o desaparece alguien del listado.",
    });
    return out;
  }, [puntosNum, buenas, gerencias.length, gap, puestoMeta, mesesExtra, horasCurso]);

  return (
    <div>
      <Barra titulo="Plan de acción" atras={atras} />
      <div className="px-5 pb-6">
        <AvisoEstimacion C={C}>
          Checklist orientativo con datos públicos. No es coaching ni garantía de plaza.
        </AvisoEstimacion>
        <SelectCampo
          label="Categoría"
          value={categoria}
          onChange={setCategoria}
          C={C}
          opciones={categorias.map((c) => ({ value: c, label: c }))}
        />
        <CampoNumero label="Tus puntos" value={puntos} onChange={setPuntos} C={C} step={0.01} />
        <CampoNumero label="Puesto meta (referencia)" value={puestoMeta} onChange={setPuestoMeta} C={C} />

        <ol style={{ margin: "16px 0 0", paddingLeft: 18 }}>
          {acciones.map((a) => (
            <li key={a.id} style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: C.ink, lineHeight: 1.45, marginBottom: 10 }}>
              {a.texto}
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-2 mt-4">
          <button
            type="button"
            onClick={() => {
              desbloquearLogro("plan_usado");
              onAbrirMapa?.(puntosNum, categoria);
            }}
            className="font-bold focus:outline-none"
            style={{
              background: C.navy,
              color: "#fff",
              padding: "12px",
              borderRadius: 10,
              border: "none",
              fontFamily: FONT_BODY,
            }}
          >
            Abrir mapa de oportunidades
          </button>
          <button
            type="button"
            onClick={() => onAbrirInversa?.(puntosNum, categoria)}
            className="font-bold focus:outline-none"
            style={{
              background: "transparent",
              color: C.navy,
              padding: "12px",
              borderRadius: 10,
              border: `1.5px solid ${C.line}`,
              fontFamily: FONT_BODY,
            }}
          >
            Calcular puntos para el puesto meta
          </button>
        </div>

        {buenas.length > 0 && (
          <div className="mt-4">
            <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.navy }}>Gerencias a tu favor</p>
            {buenas.map((g) => {
              const col = colorOportunidad(g.distanciaCorte);
              return (
                <p key={g.gerencia} style={{ fontFamily: FONT_MONO, fontSize: 12, color: col.text, margin: "4px 0" }}>
                  {g.gerencia}: #{g.mejorPosicion} · {col.label}
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
