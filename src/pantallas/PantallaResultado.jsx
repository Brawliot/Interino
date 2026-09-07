import { useState, useMemo, useEffect } from "react";
import { ChevronRight, Bell, BellRing, List as ListIcon } from "lucide-react";
import { useCapaDatos } from "../datos.jsx";
import { GERENCIA_EDUCACION, esBolsaOrdinaria, esModoAfin } from "../educacion.js";
import Barra from "../components/Barra.jsx";
import TarjetaEducacion from "../components/resultado/TarjetaEducacion.jsx";
import TarjetaGerencia from "../components/resultado/TarjetaGerencia.jsx";
import TarjetaAdmin from "../components/resultado/TarjetaAdmin.jsx";
import { C, FONT_BODY, FONT_MONO } from "../theme.js";
import {
  construirFilasResumen,
  grupoIdParaCapa,
  tituloCategoriaResultado,
  aparicionParaDetalle,
  normalizarAparicion,
} from "../utils/candidatosListado.js";

export default function PantallaResultado({ categoria, grupoId, grupoActivo, candidato, atras, estaGuardado, onGuardar, onVerListado, onInfoLlamamientos, onInformePdf, modoEducacion, modoAdministracion, modoListadoEducacion }) {
  const capa = useCapaDatos();
  const apariciones = candidato?.apariciones ?? [];
  const esEducacion = modoEducacion || apariciones[0]?.sector === "educacion";
  const esAdministracion = modoAdministracion || apariciones[0]?.sector === "administracion";
  const esModoAfinEducacion = esEducacion && (esModoAfin(modoListadoEducacion) || capa.tipoListado === "afin");
  const esBolsaCompleta =
    esEducacion &&
    (modoListadoEducacion === "bolsa" || esModoAfinEducacion || esBolsaOrdinaria(apariciones[0]?.tipoListado ?? capa.tipoListado));
  const [detalleFila, setDetalleFila] = useState(null);
  const [bulkSeguido, setBulkSeguido] = useState(false);

  const filas = useMemo(() => construirFilasResumen(apariciones), [apariciones]);
  const categoriaMostrada = useMemo(() => tituloCategoriaResultado(categoria, apariciones), [categoria, apariciones]);
  const numGerencias = filas.length;
  const numCategorias = useMemo(() => {
    const cats = new Set((apariciones || []).map((a) => a.categoria).filter(Boolean));
    return cats.size;
  }, [apariciones]);

  useEffect(() => {
    setDetalleFila(null);
    setBulkSeguido(false);
  }, [candidato?.dniParcial, candidato?.nombreCompleto]);

  if (esEducacion && apariciones.length > 0 && !esModoAfinEducacion) {
    const a = normalizarAparicion(apariciones[0]);
    const catAparicion = a.categoria || categoriaMostrada || categoria;
    const grupoAparicion = grupoIdParaCapa(capa, a, grupoId);
    return (
      <div>
        <Barra titulo="Resultado" atras={atras} />
        <div className="px-5 pb-6">
          <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, marginBottom: 12 }}>
            Mostrando a <strong style={{ color: C.navy }}>{candidato.nombreCompleto}</strong>
            {candidato.dniParcial && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 11.5 }}> · DNI {candidato.dniParcial}</span>
            )}
          </p>
          {onInformePdf && (
            <button
              type="button"
              onClick={onInformePdf}
              className="focus:outline-none"
              style={{
                fontFamily: FONT_BODY,
                fontSize: 12,
                fontWeight: 600,
                color: C.navy,
                background: C.paperDeep,
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                padding: "8px 12px",
                marginBottom: 12,
              }}
            >
              Generar informe PDF
            </button>
          )}
          <TarjetaEducacion
            categoria={catAparicion}
            grupoId={grupoAparicion}
            grupoActivo={grupoActivo ?? true}
            r={a}
            esModoAfinEducacion={false}
            guardado={estaGuardado(GERENCIA_EDUCACION, "", candidato.nombreCompleto, catAparicion, a.ccaaId || "clm")}
            onGuardar={() =>
              onGuardar(
                GERENCIA_EDUCACION,
                "",
                { ...a, nombreCompleto: candidato.nombreCompleto, dniParcial: candidato.dniParcial },
                catAparicion,
                grupoAparicion,
                a.ccaaId || "clm"
              )
            }
            onVerListado={() => onVerListado("", "", catAparicion, grupoAparicion)}
            onInfoLlamamientos={onInfoLlamamientos}
            esBolsaCompleta={esBolsaCompleta}
          />
        </div>
      </div>
    );
  }

  if (esEducacion && apariciones.length > 0 && esModoAfinEducacion) {
    const aparicionesOrd = [...apariciones]
      .map(normalizarAparicion)
      .sort((a, b) => {
        const peso = { propia: 0, inscrita: 1, afin: 2 };
        const pa = peso[a.viaBolsa] ?? 1;
        const pb = peso[b.viaBolsa] ?? 1;
        if (pa !== pb) return pa - pb;
        return (a.categoria || "").localeCompare(b.categoria || "", "es");
      });
    const catPrincipal = aparicionesOrd[0]?.categoria || categoriaMostrada || categoria;
    const grupoPrincipal = grupoIdParaCapa(capa, aparicionesOrd[0], grupoId);
    const plazasAfin = capa.plazasAfinPara
        ? capa.plazasAfinPara(catPrincipal, grupoPrincipal)
        : [];
    const inscritas = new Set(aparicionesOrd.map((a) => a.categoria).filter(Boolean));
    const plazasSoloNormativas = plazasAfin.filter((p) => !inscritas.has(p));

    return (
      <div>
        <Barra titulo="Resultado" atras={atras} />
        <div className="px-5 pb-6">
          <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, marginBottom: 12 }}>
            Mostrando a <strong style={{ color: C.navy }}>{candidato.nombreCompleto}</strong>
            {candidato.dniParcial && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 11.5 }}> · DNI {candidato.dniParcial}</span>
            )}
          </p>
          {aparicionesOrd.length > 1 && (
            <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: C.navy, fontWeight: 600, marginBottom: 16 }}>
              {catPrincipal}
              <span style={{ color: C.inkSoft, fontWeight: 500 }}>
                {" "}
                · {aparicionesOrd.length} bolsa{aparicionesOrd.length !== 1 ? "s" : ""}
              </span>
            </p>
          )}
          {aparicionesOrd.map((a) => {
            const catAparicion = a.categoria || catPrincipal;
            const grupoAparicion = grupoIdParaCapa(capa, a, grupoId);
            const esPropia = (a.viaBolsa || "propia") === "propia";
            return (
              <div key={`${a.grupoId || grupoAparicion}-${catAparicion}-${a.viaBolsa || "propia"}`} style={{ marginBottom: 14 }}>
              <TarjetaEducacion
                categoria={catAparicion}
                grupoId={grupoAparicion}
                grupoActivo={grupoActivo ?? true}
                r={a}
                plazasAfin={esPropia ? plazasSoloNormativas : []}
                esModoAfinEducacion
                guardado={estaGuardado(GERENCIA_EDUCACION, "", candidato.nombreCompleto, catAparicion, a.ccaaId || "clm")}
                onGuardar={() =>
                  onGuardar(
                    GERENCIA_EDUCACION,
                    "",
                    { ...a, nombreCompleto: candidato.nombreCompleto, dniParcial: candidato.dniParcial },
                    catAparicion,
                    grupoAparicion,
                    a.ccaaId || "clm"
                  )
                }
                onVerListado={() => onVerListado("", "", catAparicion, grupoAparicion)}
                onInfoLlamamientos={onInfoLlamamientos}
                esBolsaCompleta={esBolsaCompleta}
              />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (esAdministracion && apariciones.length > 0) {
    const catAparicion = apariciones[0]?.categoria || categoriaMostrada || categoria;
    const grupoAparicion = grupoIdParaCapa(capa, apariciones[0], grupoId);
    const aparicionesOrd = [...apariciones]
      .map(normalizarAparicion)
      .sort((a, b) => (a.provincia || a.gerencia || "").localeCompare(b.provincia || b.gerencia || "", "es"));
    return (
      <div>
        <Barra titulo="Resultado" atras={atras} />
        <div className="px-5 pb-6">
          <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, marginBottom: 12 }}>
            Mostrando a <strong style={{ color: C.navy }}>{candidato.nombreCompleto}</strong>
          </p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: C.navy, fontWeight: 600, marginBottom: 16 }}>
            {catAparicion}
            <span style={{ color: C.inkSoft, fontWeight: 500 }}> · {aparicionesOrd.length} provincia{aparicionesOrd.length !== 1 ? "s" : ""}</span>
          </p>
          {aparicionesOrd.map((a) => (
            <TarjetaAdmin
              key={a.provincia || a.gerencia}
              categoria={catAparicion}
              grupoId={grupoAparicion}
              grupoActivo={grupoActivo ?? true}
              r={a}
              guardado={estaGuardado(a.provincia || a.gerencia, "", candidato.nombreCompleto, catAparicion, a.ccaaId || "clm")}
              onGuardar={() =>
                onGuardar(
                  a.provincia || a.gerencia,
                  "",
                  { ...a, nombreCompleto: candidato.nombreCompleto, dniParcial: "" },
                  catAparicion,
                  grupoAparicion,
                  a.ccaaId || "clm"
                )
              }
              onVerListado={() => onVerListado(a.provincia || a.gerencia, "", catAparicion, grupoAparicion)}
            />
          ))}
        </div>
      </div>
    );
  }

  const mejorPosicion = filas.length ? Math.min(...filas.map((f) => f.posicion)) : 0;

  const todasGuardadas = apariciones.every((a) => {
    const cat = a.categoria || categoria;
    return estaGuardado(a.gerencia, a.ambito, candidato.nombreCompleto, cat, a.ccaaId);
  });

  const seguirTodas = () => {
    apariciones.forEach((a) => {
      const cat = a.categoria || categoria;
      const gid = a.grupoId || grupoId;
      if (!estaGuardado(a.gerencia, a.ambito, candidato.nombreCompleto, cat, a.ccaaId)) {
        onGuardar(
          a.gerencia,
          a.ambito,
          { ...a, nombreCompleto: candidato.nombreCompleto, dniParcial: candidato.dniParcial },
          cat,
          gid,
          a.ccaaId
        );
      }
    });
    setBulkSeguido(true);
  };

  if (detalleFila) {
    const a = aparicionParaDetalle(detalleFila);
    const catAparicion = a.categoria || categoriaMostrada || categoria;
    const grupoAparicion = grupoIdParaCapa(capa, a, grupoId);
    const grupoActivoAparicion = grupoActivo ?? true;
    return (
      <div>
        <Barra titulo="Resultado" atras={() => setDetalleFila(null)} />
        <div className="px-5 pb-6">
          <TarjetaGerencia
            categoria={catAparicion}
            gerencia={a.gerencia}
            ambito={a.ambito}
            grupoId={grupoAparicion}
            grupoActivo={grupoActivoAparicion}
            ccaaId={a.ccaaId}
            r={{
              ...a,
              nombreCompleto: candidato.nombreCompleto,
              dniParcial: candidato.dniParcial,
            }}
            guardado={estaGuardado(a.gerencia, a.ambito, candidato.nombreCompleto, catAparicion, a.ccaaId)}
            onGuardar={() =>
              onGuardar(
                a.gerencia,
                a.ambito,
                { ...a, nombreCompleto: candidato.nombreCompleto, dniParcial: candidato.dniParcial },
                catAparicion,
                grupoAparicion,
                a.ccaaId
              )
            }
            onVerListado={() => onVerListado(a.gerencia, a.ambito, catAparicion, grupoAparicion)}
            onInfoLlamamientos={onInfoLlamamientos}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Barra titulo="Resultado" atras={atras} />

      <div className="px-5">
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, marginBottom: 4 }}>
          Mostrando a <strong style={{ color: C.navy }}>{candidato.nombreCompleto}</strong>
          {candidato.dniParcial && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 11.5 }}> · DNI {candidato.dniParcial}</span>
          )}
        </p>
        {onInformePdf && (
          <button
            type="button"
            onClick={onInformePdf}
            className="focus:outline-none"
            style={{
              fontFamily: FONT_BODY,
              fontSize: 12,
              fontWeight: 600,
              color: C.navy,
              background: C.paperDeep,
              border: `1px solid ${C.line}`,
              borderRadius: 8,
              padding: "8px 12px",
              marginBottom: 12,
            }}
          >
            Generar informe PDF
          </button>
        )}
        <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: C.navy, fontWeight: 600, marginBottom: 16 }}>
          {categoriaMostrada || "Resultado"}
          {numCategorias > 1 && (
            <span style={{ color: C.inkSoft, fontWeight: 500 }}>
              {" "}
              · {numCategorias} bolsas/categorías
            </span>
          )}
          {numGerencias > 0 && (
            <span style={{ color: C.inkSoft, fontWeight: 500 }}>
              {" "}
              · {numGerencias} gerencia{numGerencias !== 1 ? "s" : ""}
            </span>
          )}
        </p>

        {filas.length === 0 && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.clay, marginBottom: 16, lineHeight: 1.45 }}>
            No hay posiciones que mostrar para esta búsqueda. Vuelve atrás e inténtalo de nuevo.
          </p>
        )}

        <div
          style={{
            background: C.card,
            border: `1.5px solid ${C.line}`,
            borderRadius: "16px 6px 16px 6px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto 22px",
              gap: "8px 10px",
              padding: "10px 14px",
              borderBottom: `1px solid ${C.line}`,
              background: C.paperDeep,
            }}
          >
            <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Gerencia
            </span>
            <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>
              Pos.
            </span>
            <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>
              Puntos
            </span>
            <span aria-hidden="true" />
          </div>

          {filas.map((fila, i) => {
            const esMejor = fila.posicion === mejorPosicion;
            const catApar = fila.categoria || fila.apariciones?.[0]?.categoria;
            const etiquetaGerencia = [
              catApar && numCategorias > 1 ? catApar : null,
              fila.ccaaNombre ? `${fila.ccaaNombre} · ${fila.gerencia}` : fila.gerencia,
              fila.ambitoLabel,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <button
                key={fila.key}
                type="button"
                onClick={() => setDetalleFila(fila)}
                className="w-full text-left focus:outline-none focus:ring-2"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto 22px",
                  gap: "8px 10px",
                  alignItems: "center",
                  padding: "12px 14px",
                  border: "none",
                  borderBottom: i < filas.length - 1 ? `1px solid ${C.line}` : "none",
                  background: esMejor ? C.okBg : C.card,
                  cursor: "pointer",
                  transition: "background .15s ease",
                }}
              >
                <span
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 13,
                    fontWeight: esMejor ? 700 : 500,
                    color: esMejor ? C.ok : C.ink,
                    lineHeight: 1.35,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {etiquetaGerencia}
                </span>
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: esMejor ? C.ok : C.navy,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  #{fila.posicion}
                </span>
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 12,
                    color: C.inkSoft,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  {Number(fila.puntos).toFixed(2)}
                </span>
                <ChevronRight size={16} color={C.inkSoft} style={{ flexShrink: 0 }} />
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2" style={{ marginTop: 16 }}>
          {todasGuardadas || bulkSeguido ? (
            <div
              className="flex items-center justify-center gap-2"
              style={{ background: C.okBg, borderRadius: "16px 5px 16px 5px", padding: "13px" }}
            >
              <BellRing size={16} color={C.ok} />
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5, color: C.ok }}>
                Siguiendo {numGerencias} gerencia{numGerencias !== 1 ? "s" : ""} en este dispositivo
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={seguirTodas}
              className="w-full font-bold focus:outline-none flex items-center justify-center gap-2"
              style={{
                background: C.gold,
                color: "#fff",
                padding: "14px",
                fontFamily: FONT_BODY,
                fontSize: 14,
                borderRadius: "16px 5px 16px 5px",
              }}
            >
              <Bell size={16} /> Seguir todas las gerencias
            </button>
          )}
          <button
            type="button"
            onClick={() => onVerListado("", "", categoriaMostrada || categoria, grupoIdParaCapa(capa, apariciones[0], grupoId))}
            className="w-full font-bold focus:outline-none flex items-center justify-center gap-2"
            style={{
              background: "transparent",
              color: C.navy,
              padding: "12px",
              fontFamily: FONT_BODY,
              fontSize: 13.5,
              border: `1.5px solid ${C.line}`,
              borderRadius: "5px 16px 5px 16px",
            }}
          >
            <ListIcon size={15} /> Ver listado completo
          </button>
        </div>
      </div>
    </div>
  );
}
