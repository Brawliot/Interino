import { useCapaDatos } from "../../datos.jsx";
import { PROVINCIAS_CLM, tipoBolsaLegible, esBolsaOrdinaria } from "../../educacion.js";
import { viaBolsaLegible, TEXTO_AFIN_NORMATIVA } from "../../educacion-afin.js";
import AvisoActualizacion from "../AvisoActualizacion.jsx";
import {
  ResultadoHero,
  ResultadoChips,
  ResultadoColapsable,
  ResultadoConsejoPortal,
  ResultadoPie,
  ResultadoShell,
} from "./ResultadoShell.jsx";
import { C, FONT_BODY, FONT_MONO } from "../../theme.js";

export default function TarjetaEducacion({ categoria, grupoId, grupoActivo, r, guardado, onGuardar, onVerListado, onInfoLlamamientos, esBolsaCompleta, esModoAfinEducacion, plazasAfin = [] }) {
  const capa = useCapaDatos();
  const bolsaCompleta = esBolsaCompleta ?? esBolsaOrdinaria(r?.tipoListado ?? capa.tipoListado);
  const viaBolsa = r?.viaBolsa || "propia";
  const viaTxt = viaBolsaLegible(viaBolsa);
  const posicion = Number(r?.posicion ?? r?.pos ?? r?.bolsa_orden ?? 0) || 0;
  const total = Number(r?.total ?? 0) || 0;
  const ordenLista = Number(r?.orden_lista ?? 0) || 0;
  const bolsaGeneral = Number(r?.bolsa_orden ?? 0) || 0;
  const provincias = new Set(r?.provincias || []);
  const percentil = total > 0 ? Math.round((1 - posicion / total) * 100) : 0;
  const idiomas = r?.idiomas || {};
  const idiomasActivos = Object.entries(idiomas).filter(([, v]) => v).map(([k]) => k);
  const provinciasActivas = PROVINCIAS_CLM.filter((p) => provincias.has(p.codigo));

  const subtitulo =
    total > 0
      ? bolsaCompleta
        ? `de ${total.toLocaleString("es-ES")} en bolsa ordinaria · por delante del ${percentil}%`
        : `de ${total.toLocaleString("es-ES")} en la bolsa · por delante del ${percentil}%`
      : bolsaCompleta
        ? "Posición en la bolsa ordinaria"
        : "Posición en la bolsa de sustituciones";

  let meta = viaTxt && viaBolsa !== "propia" ? viaTxt : null;
  if (r?.tipo_bolsa) {
    const tipo = tipoBolsaLegible(r.tipo_bolsa);
    const extra =
      !bolsaCompleta && bolsaGeneral > 0 && bolsaGeneral !== posicion
        ? ` · bolsa general #${bolsaGeneral}`
        : bolsaCompleta && ordenLista > 0 && ordenLista !== posicion
          ? ` · orden listado ${ordenLista}`
          : "";
    meta = meta ? `${meta} · ${tipo}${extra}` : `${tipo}${extra}`;
  }

  return (
    <ResultadoShell
      hero={
        <ResultadoHero
          sello={categoria}
          posicion={posicion}
          subtitulo={subtitulo}
          meta={meta}
          decoracion={false}
        />
      }
      seguir={{
        ctaLabel: "Seguir esta especialidad",
        etiquetaSeguimiento: categoria,
        avisoOficial: "Esto no sustituye la llamada oficial de Educación CLM.",
        guardado,
        onGuardar,
      }}
      aviso={
        <AvisoActualizacion
          categoria={categoria}
          grupoId={grupoId}
          grupoActivo={grupoActivo}
          tieneResultado={posicion > 0}
        />
      }
      secondary={
        <>
          {!bolsaCompleta && (
            <ResultadoChips
              label="Provincias:"
              items={provinciasActivas.map((p) => ({
                key: p.codigo,
                label: p.abrev,
                title: p.nombre,
              }))}
            />
          )}
          {!bolsaCompleta && (
            <ResultadoChips
              label="Idiomas:"
              items={idiomasActivos.map((id) => ({
                key: id,
                label: id.charAt(0).toUpperCase() + id.slice(1),
              }))}
            />
          )}
        </>
      }
      colapsable={
        <ResultadoColapsable label="Ver más detalles">
          {!bolsaCompleta && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.ink, margin: "0 0 8px" }}>
                Provincias donde acepta sustituciones
              </p>
              <div className="flex flex-wrap gap-2">
                {PROVINCIAS_CLM.map((prov) => {
                  const activa = provincias.has(prov.codigo);
                  return (
                    <span
                      key={prov.codigo}
                      title={prov.nombre}
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 12,
                        padding: "6px 12px",
                        borderRadius: 20,
                        background: activa ? C.okBg : C.paperDeep,
                        color: activa ? C.ok : C.inkSoft,
                        fontWeight: activa ? 700 : 400,
                        border: `1px solid ${activa ? C.ok : C.line}`,
                        textDecoration: activa ? "none" : "line-through",
                      }}
                    >
                      {prov.abrev}
                    </span>
                  );
                })}
              </div>
              <p style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkSoft, marginTop: 10, marginBottom: 0 }}>
                AB = Albacete · CR = Ciudad Real · CU = Cuenca · GU = Guadalajara · TO = Toledo
              </p>
            </div>
          )}
          {bolsaCompleta && !esModoAfinEducacion && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.ink, margin: "0 0 6px" }}>
                Bolsa ordinaria
              </p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, lineHeight: 1.45, margin: 0 }}>
                Listado por puntuación de la renovación anual (junio/julio). Incluye a todas las
                personas admitidas, no solo quienes están disponibles para sustituciones.
              </p>
              {r?.bolsa_codigo != null && (
                <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, marginTop: 8, marginBottom: 0 }}>
                  Código bolsa: {r.bolsa_codigo} · acceso {r.acceso ?? "—"}
                </p>
              )}
            </div>
          )}
          {bolsaCompleta && esModoAfinEducacion && viaBolsa === "propia" && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.ink, margin: "0 0 6px" }}>
                Tu bolsa de origen
              </p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, lineHeight: 1.45, margin: 0 }}>
                Posición en la bolsa ordinaria de {categoria}. En adjudicaciones «a la carta» compites
                primero por plazas de propia bolsa; esta posición también cuenta para desempate entre
                afines.
              </p>
              {r?.bolsa_codigo != null && (
                <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, marginTop: 8, marginBottom: 0 }}>
                  Código bolsa: {r.bolsa_codigo} · acceso {r.acceso ?? "—"}
                </p>
              )}
            </div>
          )}
          {esModoAfinEducacion && viaBolsa === "propia" && plazasAfin.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.ink, margin: "0 0 6px" }}>
                Plazas afines (titulación)
              </p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.45, margin: "0 0 8px" }}>
                {TEXTO_AFIN_NORMATIVA}
              </p>
              <div className="flex flex-wrap gap-2">
                {plazasAfin.slice(0, 12).map((esp) => (
                  <span
                    key={esp}
                    style={{
                      fontFamily: FONT_BODY,
                      fontSize: 11,
                      padding: "5px 10px",
                      borderRadius: 16,
                      background: C.paperDeep,
                      color: C.navy,
                      border: `1px solid ${C.line}`,
                    }}
                  >
                    {esp}
                  </span>
                ))}
                {plazasAfin.length > 12 && (
                  <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, alignSelf: "center" }}>
                    +{plazasAfin.length - 12} más
                  </span>
                )}
              </div>
            </div>
          )}
          <ResultadoConsejoPortal
            titulo="Revisa tus datos en Educación CLM."
            texto="Los llamamientos dependen de que el contacto esté actualizado en el portal."
          />
        </ResultadoColapsable>
      }
      pie={<ResultadoPie onVerListado={onVerListado} onInfoLlamamientos={onInfoLlamamientos} />}
    />
  );
}
