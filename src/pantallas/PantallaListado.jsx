import { useState, useEffect } from "react";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { useCapaDatos, coincideBusqueda } from "../datos.jsx";
import { PROVINCIAS_CLM, tipoBolsaLegible, esBolsaOrdinaria, esModoAfin } from "../educacion.js";
import { subBolsaLegible } from "../admin-clm.js";
import Barra from "../components/Barra.jsx";
import AvisoActualizacion from "../components/AvisoActualizacion.jsx";
import { etiquetaLista } from "../utils/etiquetasLista.js";
import { C, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../theme.js";

export default function PantallaListado({ categoria, gerencia, ambito, grupoId, grupoActivo, atras, modoEducacion, modoAdministracion, modoListadoEducacion, onAbrirPersona }) {
  const capa = useCapaDatos();
  const esEducacion = modoEducacion || capa.sector === "educacion";
  const esAdministracion = modoAdministracion || capa.sector === "administracion";
  const esBolsaCompleta =
    esEducacion &&
    (modoListadoEducacion === "bolsa" || esModoAfin(modoListadoEducacion) || esBolsaOrdinaria(capa.tipoListado));
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [errorDatos, setErrorDatos] = useState(false);
  const [provincias, setProvincias] = useState([]);
  const [provinciaActiva, setProvinciaActiva] = useState(gerencia || "");
  const LIMITE_FILAS = 100;
  const esReal = grupoActivo && capa.tieneDatosReales(categoria, grupoId);
  const tituloListado = esAdministracion
    ? `${categoria}${provinciaActiva ? ` · ${provinciaActiva}` : ""}`
    : esEducacion
      ? categoria
      : etiquetaLista(categoria, gerencia, ambito);

  useEffect(() => {
    let cancel = false;
    if (!esAdministracion || !esReal) return;
    capa.gerenciasDeCategoria(grupoId, categoria).then((provs) => {
      if (cancel) return;
      setProvincias(provs);
      setProvinciaActiva((prev) => prev || gerencia || provs[0] || "");
    });
    return () => { cancel = true; };
  }, [capa, categoria, grupoId, esAdministracion, esReal, gerencia]);

  useEffect(() => {
    let cancel = false;
    setCargando(true);
    setErrorDatos(false);
    const cargar = async () => {
      if (esReal) {
        try {
          const prov = esAdministracion ? provinciaActiva : gerencia;
          const f = await capa.obtenerListadoCompleto(grupoId, categoria, prov, ambito || "");
          if (!cancel) setFilas(f);
        } catch {
          if (!cancel) { setFilas([]); setErrorDatos(true); }
        }
      } else {
        if (!cancel) { setFilas([]); setErrorDatos(true); }
      }
      if (!cancel) setCargando(false);
    };
    cargar();
    return () => { cancel = true; };
  }, [capa, categoria, gerencia, ambito, grupoId, esReal, esAdministracion, provinciaActiva]);

  const visibles = filtro ? filas.filter((f) => coincideBusqueda(f, filtro)) : filas;
  const mostradas = visibles.slice(0, LIMITE_FILAS);

  return (
    <div>
      <Barra titulo={tituloListado} atras={atras} />
      <div className="px-5">
        <AvisoActualizacion categoria={categoria} grupoId={grupoId} grupoActivo={grupoActivo} />

        {esAdministracion && provincias.length > 1 && (
          <select
            value={provinciaActiva}
            onChange={(e) => setProvinciaActiva(e.target.value)}
            className="w-full mt-3 focus:outline-none"
            style={{ border: `1.5px solid ${C.line}`, background: C.card, padding: "11px 14px", fontFamily: FONT_BODY, fontSize: 14, color: C.ink }}
          >
            {provincias.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}

        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder={esAdministracion ? "Filtrar por apellidos…" : "Apellidos, DNI parcial o ambos…"}
          className="w-full mt-3 focus:outline-none"
          style={{ border: `1.5px solid ${C.line}`, background: C.card, padding: "11px 14px", fontFamily: FONT_BODY, fontSize: 13.5, color: C.ink }}
        />
        {cargando && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 8 }}>Cargando listado…</p>
        )}
        {!cargando && errorDatos && (
          <div className="flex items-start gap-2 mt-3" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
            <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
              No hay listado disponible para esta {esEducacion ? "especialidad" : "categoría"}. No inventamos resultados.
            </p>
          </div>
        )}
        <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, margin: "6px 0 4px" }}>
          Útil si un compañero opositor te ha dicho que está en esta lista y quieres ver en qué puesto queda. Toca una fila para ver su perfil.
        </p>

        <div className="mt-2" style={{ border: `1px solid ${C.line}`, borderRadius: "10px 3px 10px 3px", overflow: "hidden" }}>
          <div className="flex" style={{ background: C.navy, padding: "9px 14px" }}>
            <span style={{ flex: "0 0 40px", fontFamily: FONT_MONO, fontSize: 10.5, color: C.goldSoft }}>POS.</span>
            <span style={{ flex: 1, fontFamily: FONT_MONO, fontSize: 10.5, color: C.goldSoft }}>NOMBRE Y APELLIDOS</span>
            {esEducacion ? (
              esBolsaCompleta ? (
                <span style={{ flex: "0 0 56px", fontFamily: FONT_MONO, fontSize: 10.5, color: C.goldSoft, textAlign: "right" }}>BOLSA</span>
              ) : (
                <span style={{ flex: "0 0 72px", fontFamily: FONT_MONO, fontSize: 10.5, color: C.goldSoft, textAlign: "right" }}>PROV.</span>
              )
            ) : esAdministracion ? (
              <span style={{ flex: "0 0 110px", fontFamily: FONT_MONO, fontSize: 10.5, color: C.goldSoft, textAlign: "right" }}>SUB-BOLSA</span>
            ) : (
              <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.goldSoft }}>PUNTOS</span>
            )}
            {onAbrirPersona && <span style={{ flex: "0 0 18px" }} aria-hidden="true" />}
          </div>
          {mostradas.map((f, idx) => (
            <button
              key={`${f.pos}-${f.nombreCompleto}-${f.ambito || ""}-${idx}`}
              type="button"
              onClick={() => onAbrirPersona?.(f, filas)}
              disabled={!onAbrirPersona}
              className="w-full flex items-center text-left focus:outline-none focus:ring-2"
              style={{
                padding: "10px 14px",
                borderTop: `1px solid ${C.line}`,
                background: C.card,
                border: "none",
                cursor: onAbrirPersona ? "pointer" : "default",
                transition: "background .12s ease",
              }}
            >
              <span style={{ flex: "0 0 40px", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: C.navy }}>{f.pos}</span>
              <span style={{ flex: 1, fontFamily: FONT_BODY, fontSize: 13, color: C.ink }}>
                {f.nombreCompleto}
                {f.ambito && <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.inkSoft }}> · {f.ambito}</span>}
                {esEducacion && f.tipo_bolsa && (
                  <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.inkSoft }}> · {tipoBolsaLegible(f.tipo_bolsa)}</span>
                )}
                {esAdministracion && f.sub_bolsa && (
                  <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.inkSoft }}> · nº bolsa {f.num_bolsa}</span>
                )}
              </span>
              {esEducacion ? (
                esBolsaCompleta ? (
                  <span style={{ flex: "0 0 56px", fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, textAlign: "right" }}>
                    {f.bolsa_codigo ?? "—"}
                  </span>
                ) : (
                  <span style={{ flex: "0 0 72px", fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, textAlign: "right" }}>
                    {(f.provincias || [])
                      .map((c) => PROVINCIAS_CLM.find((p) => p.codigo === c)?.abrev || c)
                      .join(" ")}
                  </span>
                )
              ) : esAdministracion ? (
                <span style={{ flex: "0 0 110px", fontFamily: FONT_MONO, fontSize: 10, color: C.inkSoft, textAlign: "right" }}>
                  {subBolsaLegible(f.sub_bolsa)}
                </span>
              ) : (
                <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.inkSoft }}>{f.puntos?.toFixed?.(2) ?? "—"}</span>
              )}
              {onAbrirPersona && (
                <ChevronRight size={16} color={C.inkSoft} style={{ flex: "0 0 18px", marginLeft: 4 }} />
              )}
            </button>
          ))}
          {mostradas.length === 0 && (
            <p style={{ padding: 16, fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, background: C.card }}>Sin coincidencias con ese nombre.</p>
          )}
        </div>
        {!errorDatos && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, margin: "8px 0 16px" }}>
            {`Mostrando ${mostradas.length} de ${visibles.length} filas${visibles.length > LIMITE_FILAS ? ` (límite ${LIMITE_FILAS}; usa el buscador para acotar)` : ""}.`}
          </p>
        )}
      </div>
    </div>
  );
}
