import { useState, useEffect, useMemo } from "react";
import { Search, Lock, Stethoscope, GraduationCap, Landmark, AlertTriangle, List as ListIcon, History, Info } from "lucide-react";
import { useDatos, useCapaDatos } from "../datos.jsx";
import { sectoresParaCcaas } from "../regiones.js";
import { MODOS_LISTADO_EDUCACION } from "../educacion.js";
import { etiquetaFrescuraSector } from "../cobertura-clm.js";
import { opcionesDesdeIndex, resumirPorCurso } from "../cursosHistoricos.js";
import Barra from "../components/Barra.jsx";
import AvisoActualizacion from "../components/AvisoActualizacion.jsx";
import { ResultadoColapsable } from "../components/resultado/ResultadoShell.jsx";
import { grupoDeCategoria } from "../utils/grupoDeCategoria.js";
import { C, FONT_BODY } from "../theme.js";

const ICONOS_SECTOR = {
  sanidad: Stethoscope,
  educacion: GraduationCap,
  administracion: Landmark,
};

const TEXTO_AYUDA_BUSQUEDA_BASE = {
  mur: "Puedes buscar por apellidos, por los últimos dígitos del DNI (como los publica el SMS) o por una combinación de ambos. No te pedimos ni guardamos tu DNI completo.",
  mad: "Puedes buscar por apellidos o DNI parcial (como los publica el SERMAS). Solo las categorías con listado disponible están activas; el resto aparece como «sin datos».",
  multi: "Puedes buscar por apellidos o DNI parcial en todas tus comunidades seleccionadas, o elegir grupo y categoría concretos por región. No te pedimos ni guardamos tu DNI completo.",
};

function textoAyudaBusqueda(ccaaId, numGerencias, modoEducacion, modoListadoEducacion, modoAdministracion) {
  if (modoAdministracion) {
    return "Busca solo por apellidos. Verás tu posición en cada provincia donde figure en la bolsa, con la sub-bolsa (definitiva, provisional, suspensos…). No hay puntuación ni DNI en estos listados.";
  }
  if (modoEducacion) {
    if (modoListadoEducacion === "bolsa") {
      return "Busca por apellidos o DNI parcial. Verás tu posición en la bolsa ordinaria de tu especialidad (orden por puntuación). No te pedimos ni guardamos tu DNI completo.";
    }
    if (modoListadoEducacion === "afin") {
      return "Busca por apellidos o DNI parcial. Verás tu bolsa de origen, otras bolsas donde estés inscrito/a y plazas afines por titulación (Orden 32/2018). No te pedimos ni guardamos tu DNI completo.";
    }
    return "Busca por apellidos o DNI parcial. Este listado semanal solo incluye quienes están disponibles para sustituciones y las provincias donde aceptan. No te pedimos ni guardamos tu DNI completo.";
  }
  if (ccaaId === "mur") return TEXTO_AYUDA_BUSQUEDA_BASE.mur;
  if (ccaaId === "mad") return TEXTO_AYUDA_BUSQUEDA_BASE.mad;
  const gerenciasTxt = numGerencias ? `las ${numGerencias} gerencias` : "las gerencias";
  return `Puedes buscar por apellidos, por los últimos dígitos del DNI (como los publica el SESCAM) o por una combinación de ambos. Buscamos en ${gerenciasTxt} y en Atención Primaria y Especializada. No te pedimos ni guardamos tu DNI completo.`;
}
function AvisoRegionSinListados({ ccaaId, murciaActiva, madridActiva }) {
  if (ccaaId === "mur" && !murciaActiva) {
    return (
      <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
        <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.45 }}>
          Los listados de sanidad de Murcia (SMS) aún no están disponibles aquí. Puedes ver el inventario de categorías; la búsqueda se activará cuando haya listados publicados en la app.
        </p>
      </div>
    );
  }
  if (ccaaId === "mad" && !madridActiva) {
    return (
      <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
        <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.45 }}>
          Madrid (SERMAS): algunas categorías ya tienen listado; el resto aún no.
        </p>
      </div>
    );
  }
  return null;
}
function SelectorSectorInline({ ccaas, sectorId, onSectorChange, educacionActiva, educacionMurciaActiva, administracionActiva }) {
  const sectores = sectoresParaCcaas(ccaas.map((c) => c.id), { educacionActiva, educacionMurciaActiva, administracionActiva }).map((s) => ({
    ...s,
    icono: ICONOS_SECTOR[s.id] || Stethoscope,
  }));

  return (
    <div>
      <label style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.ink }}>Sector</label>
      <div className="flex gap-2 mt-2">
        {sectores.map((s) => {
          const Icono = s.icono;
          const sel = sectorId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              disabled={!s.activo}
              onClick={() => s.activo && onSectorChange(s)}
              className="flex-1 focus:outline-none flex flex-col items-center gap-1"
              style={{
                background: sel && s.activo ? C.navy : C.card,
                border: `1.5px solid ${sel && s.activo ? C.navy : C.line}`,
                borderRadius: "12px 4px 12px 4px",
                padding: "10px 6px",
                opacity: s.activo ? 1 : 0.62,
                cursor: s.activo ? "pointer" : "default",
              }}
            >
              <Icono size={16} color={sel && s.activo ? C.goldSoft : C.inkSoft} />
              <span
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: sel && s.activo ? "#fff" : C.inkSoft,
                  lineHeight: 1.2,
                  textAlign: "center",
                }}
              >
                {s.nombre}
              </span>
              {!s.activo && <Lock size={10} color={C.inkSoft} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LineaFrescura({ sectorId, frescura, modoListadoEducacion }) {
  const texto = etiquetaFrescuraSector(sectorId, frescura, modoListadoEducacion);
  if (!texto) return null;
  return (
    <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, margin: 0, lineHeight: 1.4 }}>
      Datos actualizados: <span style={{ color: C.navy, fontWeight: 600 }}>{texto}</span>
    </p>
  );
}

function PanelHuecosEducacion({ cobertura, modoListadoEducacion }) {
  const [abierto, setAbierto] = useState(false);
  if (!cobertura) return null;

  const faltantes =
    modoListadoEducacion === "disponibles"
      ? cobertura.faltantesDisponibles
      : modoListadoEducacion === "bolsa"
        ? cobertura.faltantesBolsa
        : cobertura.faltantesBolsa;
  const n = faltantes.length;
  if (n === 0) return null;

  const tituloModo =
    modoListadoEducacion === "disponibles"
      ? "disponibles (PDF semanal)"
      : "bolsa ordinaria";

  return (
    <div style={{ background: C.paperDeep, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px" }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full text-left focus:outline-none flex items-start gap-2"
      >
        <Info size={15} color={C.navy} style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.ink, lineHeight: 1.45, flex: 1 }}>
          <strong>{n}</strong> especialidad{n !== 1 ? "es" : ""} del catálogo sin datos de {tituloModo} en el servidor.
          {modoListadoEducacion === "afin" && " AFIN usa la bolsa ordinaria como base."}
          {" "}
          <span style={{ color: C.navy, fontWeight: 600 }}>{abierto ? "Ocultar" : "Ver listado"}</span>
        </span>
      </button>
      {abierto && (
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5 }}>
          {faltantes.slice(0, 12).map((f) => (
            <li key={f.rel}>{f.cuerpo}: {f.especialidad.replace(/^\d{3}\s+/, "")}</li>
          ))}
          {n > 12 && <li>… y {n - 12} más (sin PDF público en el portal)</li>}
        </ul>
      )}
      <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, margin: "8px 0 0", lineHeight: 1.4 }}>
        Portal:{" "}
        <a href={cobertura.urlPortal} target="_blank" rel="noopener noreferrer" style={{ color: C.navy }}>
          Educación CLM · bolsas
        </a>
      </p>
    </div>
  );
}

function PanelAdminSinPdf({ bolsas }) {
  if (!bolsas?.length) return null;
  return (
    <div style={{ background: C.paperDeep, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px" }}>
      <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12, color: C.navy, margin: "0 0 6px" }}>
        Bolsas sin listado PDF en el portal
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5 }}>
        {bolsas.map((b) => (
          <li key={`${b.colectivo}-${b.categoria}`}>
            {b.categoria}
            {b.url ? (
              <>
                {" "}
                (<a href={b.url} target="_blank" rel="noopener noreferrer" style={{ color: C.navy }}>pagina</a>)
              </>
            ) : null}
            {b.nota ? ` — ${b.nota}` : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SelectorListadoEducacion({ modo, onModoChange, bolsaActiva, disponiblesActiva, afinActiva }) {
  if (!bolsaActiva && !disponiblesActiva && !afinActiva) return null;

  const modos = [
    MODOS_LISTADO_EDUCACION.bolsa,
    MODOS_LISTADO_EDUCACION.disponibles,
    MODOS_LISTADO_EDUCACION.afin,
  ];

  return (
    <div>
      <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5, color: C.navy, marginBottom: 8 }}>
        Tipo de listado
      </p>
      <div className="flex flex-col gap-2">
        {modos.map((m) => {
          const activo =
            m.id === "bolsa" ? bolsaActiva : m.id === "disponibles" ? disponiblesActiva : afinActiva;
          const seleccionado = modo === m.id;
          const radius =
            m.id === "bolsa" ? "16px 6px 16px 6px" : m.id === "disponibles" ? "6px 16px 6px 16px" : "12px 12px 6px 6px";
          return (
            <button
              key={m.id}
              type="button"
              disabled={!activo}
              onClick={() => activo && onModoChange(m.id)}
              className="text-left focus:outline-none"
              style={{
                background: seleccionado ? C.navy : C.card,
                color: seleccionado ? "#fff" : activo ? C.ink : C.inkSoft,
                border: `1.5px solid ${seleccionado ? C.navy : C.line}`,
                borderRadius: radius,
                padding: "12px 14px",
                opacity: activo ? 1 : 0.55,
                cursor: activo ? "pointer" : "default",
              }}
            >
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5 }}>{m.titulo}</p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, marginTop: 3, opacity: 0.85 }}>{m.subtitulo}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InfoListadoBusqueda({
  esEducacionClm,
  esEducacionMurcia,
  modoAdministracion,
  modoListadoEducacion,
  cobertura,
  adminSinPdf,
}) {
  const faltantes =
    cobertura &&
    (modoListadoEducacion === "disponibles"
      ? cobertura.faltantesDisponibles
      : cobertura.faltantesBolsa);
  const hayHuecos = Boolean(faltantes?.length);
  const hayAdmin = Boolean(adminSinPdf?.length);
  const hayCobertura = Boolean(esEducacionClm && cobertura);
  if (!hayHuecos && !hayAdmin && !hayCobertura && !esEducacionMurcia) return null;

  return (
    <ResultadoColapsable label="Información del listado">
      <div className="flex flex-col gap-3">
        {hayCobertura && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, margin: 0, lineHeight: 1.45 }}>
            Cobertura:{" "}
            <span style={{ color: C.navy, fontWeight: 600 }}>
              {cobertura.disponibles}/{cobertura.catalogo} disponibles
            </span>
            {" · "}
            <span style={{ color: C.navy, fontWeight: 600 }}>
              {cobertura.bolsa}/{cobertura.catalogo} bolsa
            </span>
          </p>
        )}
        {esEducacionMurcia && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, lineHeight: 1.4, margin: 0 }}>
            Listas definitivas de interinos (Cuerpo de Maestros). Incluye BLOQUE I y BLOQUE II cuando
            constan en el listado.
          </p>
        )}
        {hayHuecos && (
          <PanelHuecosEducacion cobertura={cobertura} modoListadoEducacion={modoListadoEducacion} />
        )}
        {modoAdministracion && hayAdmin && <PanelAdminSinPdf bolsas={adminSinPdf} />}
      </div>
    </ResultadoColapsable>
  );
}

// ---------------------------------------------------------------
// PANTALLA 3 — buscar posición
// ---------------------------------------------------------------
export default function PantallaBuscar({
  atras,
  onBuscar,
  onBuscarGlobal,
  onVerListado,
  recientes,
  gruposSanidad,
  ccaas,
  sectorId,
  onSectorChange,
  educacionActiva,
  educacionMurciaActiva,
  administracionActiva,
  educacionBolsaActiva,
  educacionDisponiblesActiva,
  educacionAfinActiva,
  murciaActiva,
  madridActiva,
  modoEducacion,
  modoAdministracion,
  modoListadoEducacion,
  onModoListadoEducacionChange,
  fechaSnapshot,
  onFechaSnapshotChange,
  archiveIndex,
}) {
  const datos = useDatos();
  const capa = useCapaDatos();
  const ccaaIds = ccaas.map((c) => c.id);
  const multi = ccaaIds.length > 1;
  const sectores = sectoresParaCcaas(ccaaIds, { educacionActiva, educacionMurciaActiva, administracionActiva });
  const esEducacionMurcia = modoEducacion && ccaaIds[0] === "mur";
  const esEducacionClm = modoEducacion && !esEducacionMurcia;
  const sectorActivo = sectores.find((s) => s.id === sectorId);
  const sectorDisponible = sectorActivo?.activo;
  const [grupoId, setGrupoId] = useState(gruposSanidad[0]?.id || "diplomado");
  const grupo = gruposSanidad.find((g) => g.id === grupoId) || gruposSanidad[0];
  const categoriasGrupo = grupo?.categorias || [];
  const [categoria, setCategoria] = useState(categoriasGrupo[0] || "");
  const [consulta, setConsulta] = useState("");
  const [sinResultados, setSinResultados] = useState(false);
  const [sinResultadosGlobal, setSinResultadosGlobal] = useState(false);
  const [sinDatosCategoria, setSinDatosCategoria] = useState(false);

  const puedeHistorico =
    !multi &&
    !modoEducacion &&
    !modoAdministracion &&
    (ccaaIds[0] || "clm") === "clm" &&
    sectorId === "sanidad";

  const opcionesCurso = useMemo(() => {
    if (!puedeHistorico) return [];
    return resumirPorCurso(
      opcionesDesdeIndex(archiveIndex || datos.archiveIndex, {
        sectorApp: "sanidad",
        ccaaId: "clm",
      }),
    );
  }, [puedeHistorico, archiveIndex, datos.archiveIndex]);

  const categoriaConDatos = sectorDisponible && grupo?.activo && capa.tieneDatosReales(categoria, grupoId);
  const tituloBarra = multi ? ccaas.map((c) => c.nombre).join(" · ") : (ccaas[0]?.nombre || "Castilla-La Mancha");
  const textoAyuda = multi
    ? TEXTO_AYUDA_BUSQUEDA_BASE.multi
    : textoAyudaBusqueda(ccaaIds[0] || "clm", datos.numGerenciasClm, modoEducacion, modoListadoEducacion, modoAdministracion);

  const cambiarGrupo = (id) => {
    const g = gruposSanidad.find((x) => x.id === id);
    setGrupoId(id);
    setCategoria(g?.categorias?.[0] || "");
    setSinResultados(false);
    setSinResultadosGlobal(false);
    setSinDatosCategoria(false);
  };

  useEffect(() => {
    const g = gruposSanidad[0];
    if (!g) {
      setGrupoId("");
      setCategoria("");
      return;
    }
    setGrupoId(g.id);
    setCategoria(g.categorias?.[0] || "");
    setSinResultados(false);
    setSinResultadosGlobal(false);
    setSinDatosCategoria(false);
  }, [sectorId, gruposSanidad, modoListadoEducacion]);

  const buscar = async (cat, q) => {
    setSinDatosCategoria(false);
    setSinResultadosGlobal(false);
    const res = await onBuscar(cat, q);
    if (res === -1) {
      setSinDatosCategoria(true);
      setSinResultados(false);
      return;
    }
    setSinResultados(res === 0);
  };

  const buscarGlobal = async (q) => {
    if (!onBuscarGlobal || !q.trim()) return;
    setSinDatosCategoria(false);
    setSinResultados(false);
    const res = await onBuscarGlobal(q);
    setSinResultadosGlobal(res === 0);
  };

  return (
    <div>
      <Barra titulo={tituloBarra} atras={atras} />

      <div className="px-5 flex flex-col gap-4 mt-2 pb-8">
        {multi && (
          <div className="flex flex-wrap gap-2">
            {ccaas.map((c) => (
              <span
                key={c.id}
                style={{
                  background: C.card,
                  border: `1px solid ${C.line}`,
                  borderRadius: 20,
                  padding: "5px 12px",
                  fontFamily: FONT_BODY,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: C.navy,
                }}
              >
                {c.nombre}
              </span>
            ))}
          </div>
        )}

        <SelectorSectorInline
          ccaas={ccaas}
          sectorId={sectorId}
          educacionActiva={educacionActiva}
          educacionMurciaActiva={educacionMurciaActiva}
          administracionActiva={administracionActiva}
          onSectorChange={(s) => {
            onSectorChange?.(s);
            setSinResultados(false);
            setSinResultadosGlobal(false);
            setSinDatosCategoria(false);
          }}
        />

        {puedeHistorico && (
          <div>
            <label
              htmlFor="selector-curso-historico"
              style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.ink }}
            >
              Datos del listado
            </label>
            <select
              id="selector-curso-historico"
              value={fechaSnapshot || ""}
              onChange={(e) => onFechaSnapshotChange?.(e.target.value || null)}
              className="w-full mt-2 focus:outline-none"
              style={{
                border: `1.5px solid ${fechaSnapshot ? C.navy : C.line}`,
                background: C.card,
                padding: "12px 14px",
                fontFamily: FONT_BODY,
                fontSize: 14,
                color: C.ink,
                borderRadius: "10px 4px 10px 4px",
              }}
            >
              <option value="">Actual (en vivo)</option>
              {opcionesCurso.map((o) => (
                <option key={o.fecha} value={o.fecha}>
                  {o.label}
                </option>
              ))}
            </select>
            {fechaSnapshot ? (
              <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.clay, marginTop: 6, lineHeight: 1.4 }}>
                Estás consultando un snapshot histórico. Los seguimientos siguen usando el listado actual.
              </p>
            ) : opcionesCurso.length === 0 ? (
              <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, marginTop: 6, lineHeight: 1.4 }}>
                Aún no hay cursos archivados. Irán apareciendo tras las subidas del vigía a R2.
              </p>
            ) : null}
          </div>
        )}

        {!multi && !modoEducacion && !modoAdministracion && (
          <AvisoRegionSinListados ccaaId={ccaaIds[0]} murciaActiva={murciaActiva} madridActiva={madridActiva} />
        )}

        {sectorDisponible && (
          <LineaFrescura
            sectorId={sectorId}
            frescura={datos.frescura}
            modoListadoEducacion={modoListadoEducacion}
          />
        )}

        {esEducacionClm && (
          <SelectorListadoEducacion
            modo={modoListadoEducacion}
            onModoChange={onModoListadoEducacionChange}
            bolsaActiva={educacionBolsaActiva}
            disponiblesActiva={educacionDisponiblesActiva}
            afinActiva={educacionAfinActiva}
          />
        )}

        <InfoListadoBusqueda
          esEducacionClm={esEducacionClm}
          esEducacionMurcia={esEducacionMurcia}
          modoAdministracion={modoAdministracion}
          modoListadoEducacion={modoListadoEducacion}
          cobertura={datos.coberturaEducacion}
          adminSinPdf={datos.adminSinPdf}
        />

        {modoAdministracion && datos.listo && !gruposSanidad.length && (
          <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
            <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
              No hay listados de administración disponibles por ahora. Vuelve más tarde o consulta el portal de Empleo Público.
            </p>
          </div>
        )}

        {modoEducacion && datos.listo && !gruposSanidad.length && (
          <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
            <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
              {esEducacionMurcia
                ? <>No hay listados de educación Murcia disponibles por ahora. Vuelve más tarde o consulta el portal de la CARM.</>
                : <>No hay listados de educación disponibles para este modo. Vuelve más tarde o consulta Educación CLM.</>}
            </p>
          </div>
        )}

        {!datos.listo && !gruposSanidad.length && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, lineHeight: 1.45 }}>
            Cargando categorías del listado…
          </p>
        )}

        {gruposSanidad.length > 0 && (
        <div>
          <label style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.ink }}>
            {modoEducacion ? "Cuerpo docente" : modoAdministracion ? "Colectivo" : "Grupo profesional"}
          </label>
          <select
            value={grupoId}
            onChange={(e) => cambiarGrupo(e.target.value)}
            className="w-full mt-2 focus:outline-none"
            style={{ border: `1.5px solid ${C.line}`, background: C.card, padding: "13px 14px", fontFamily: FONT_BODY, fontSize: 15, color: C.ink }}
          >
            {gruposSanidad.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}{g.activo ? "" : " · sin datos todavía"}
              </option>
            ))}
          </select>
          {grupo?.nota && (
            <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, marginTop: 8, lineHeight: 1.45 }}>
              {grupo.nota}
            </p>
          )}
        </div>
        )}

        {gruposSanidad.length > 0 && (
        <div>
          <label style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.ink }}>
            {modoEducacion ? "Especialidad" : "Categoría"}
          </label>
          <select
            value={categoria}
            onChange={(e) => { setCategoria(e.target.value); setSinResultados(false); setSinResultadosGlobal(false); setSinDatosCategoria(false); }}
            className="w-full mt-2 focus:outline-none"
            style={{ border: `1.5px solid ${C.line}`, background: C.card, padding: "13px 14px", fontFamily: FONT_BODY, fontSize: 15, color: C.ink }}
          >
            {categoriasGrupo.map((c) => (
              <option key={c} value={c}>
                {c}{capa.tieneDatosReales(c, grupoId) ? "" : " · sin datos"}
              </option>
            ))}
          </select>
        </div>
        )}

        {gruposSanidad.length > 0 && (
        <div>
          <label style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.ink }}>
            {modoAdministracion ? "Apellidos" : "Apellidos o DNI parcial"}
          </label>
          <input
            value={consulta}
            onChange={(e) => { setConsulta(e.target.value); setSinResultados(false); setSinResultadosGlobal(false); setSinDatosCategoria(false); }}
            placeholder={modoAdministracion ? "Apellidos — ej. García López" : "Apellidos, DNI parcial o ambos — ej. García 4208"}
            className="w-full mt-2 focus:outline-none"
            style={{ border: `1.5px solid ${C.line}`, background: C.card, padding: "13px 14px", fontFamily: FONT_BODY, fontSize: 15, color: C.ink }}
          />
          <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, marginTop: 6, lineHeight: 1.4 }}>
            {modoAdministracion ? "Busca por apellidos." : "Busca por apellidos o DNI parcial."}
          </p>
          <ResultadoColapsable label="Ayuda de búsqueda">
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, lineHeight: 1.45, margin: 0 }}>
              {textoAyuda}
            </p>
          </ResultadoColapsable>
        </div>
        )}

        {!sectorDisponible && (
          <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
            <Lock size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
              Este sector aún no está disponible en esta comunidad.
            </p>
          </div>
        )}

        {!categoriaConDatos && sectorDisponible && (
          <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
            <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
              {grupo?.activo
                ? "Esta categoría aún no tiene listado disponible. Elige otra del mismo grupo o vuelve más tarde."
                : "Este grupo profesional aún no tiene datos. Sin datos todavía."}
            </p>
          </div>
        )}

        <button
          onClick={() => buscar(categoria, consulta)}
          disabled={!categoriaConDatos || !consulta.trim()}
          className="w-full font-bold focus:outline-none flex items-center justify-center gap-2"
          style={{
            background: categoriaConDatos && consulta.trim() ? C.navy : C.paperDeep,
            color: categoriaConDatos && consulta.trim() ? "#fff" : C.inkSoft,
            padding: "15px",
            fontFamily: FONT_BODY,
            fontSize: 15,
            borderRadius: "16px 5px 16px 5px",
            cursor: categoriaConDatos && consulta.trim() ? "pointer" : "default",
          }}
        >
          <Search size={16} /> Buscar en la lista
        </button>

        {multi && onBuscarGlobal && (
          <button
            onClick={() => buscarGlobal(consulta)}
            disabled={!consulta.trim()}
            className="w-full font-bold focus:outline-none flex items-center justify-center gap-2"
            style={{
              background: consulta.trim() ? "transparent" : C.paperDeep,
              color: consulta.trim() ? C.navy : C.inkSoft,
              padding: "13px",
              fontFamily: FONT_BODY,
              fontSize: 14,
              borderRadius: "5px 16px 5px 16px",
              border: `1.5px solid ${C.line}`,
              cursor: consulta.trim() ? "pointer" : "default",
            }}
          >
            <Search size={15} /> Buscar en todas mis comunidades
          </button>
        )}

        {recientes.length > 0 && (
          <div>
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, color: C.inkSoft, display: "flex", alignItems: "center", gap: 5 }}>
              <History size={13} /> Últimas búsquedas
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {recientes.map((rec, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const g = grupoDeCategoria(rec.categoria, gruposSanidad, rec.ccaaId);
                    if (g) setGrupoId(g.id);
                    setCategoria(rec.categoria);
                    setConsulta(rec.consulta);
                    if (rec.global) buscarGlobal(rec.consulta);
                    else buscar(rec.categoria, rec.consulta);
                  }}
                  className="focus:outline-none"
                  style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, padding: "6px 12px", fontFamily: FONT_BODY, fontSize: 12, color: C.navy }}
                >
                  {rec.consulta}{rec.global ? " · todas" : rec.categoria ? ` · ${rec.categoria}` : ""}
                </button>
              ))}
            </div>
          </div>
        )}

        {sinDatosCategoria && (
          <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
            <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
              No hay datos reales para buscar en esta categoría. No mostramos resultados inventados.
            </p>
          </div>
        )}

        {sinResultados && !sinDatosCategoria && (
          <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
            <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
              No encontramos coincidencias para «{consulta.trim()}»{modoEducacion ? ` en la especialidad ${categoria}` : modoAdministracion ? ` en ${categoria}` : ` en ninguna gerencia de ${categoria}`}. Comprueba cómo lo has escrito, o puede que aún no estés incluido en esta bolsa.
            </p>
          </div>
        )}

        {sinResultadosGlobal && (
          <div className="flex items-start gap-2" style={{ background: "#F7E9D9", border: `1px solid ${C.gold}55`, borderRadius: "6px 14px 6px 14px", padding: "10px 12px" }}>
            <AlertTriangle size={15} color={C.clay} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, lineHeight: 1.4 }}>
              No encontramos coincidencias para «{consulta.trim()}» en ninguna de tus comunidades seleccionadas.
            </p>
          </div>
        )}

        <button
          onClick={() => onVerListado(categoria, modoEducacion || modoAdministracion ? "" : undefined)}
          disabled={!categoriaConDatos}
          className="w-full font-bold focus:outline-none flex items-center justify-center gap-2"
          style={{
            background: "transparent",
            color: categoriaConDatos ? C.navy : C.inkSoft,
            padding: "12px",
            fontFamily: FONT_BODY,
            fontSize: 13.5,
            border: `1.5px solid ${C.line}`,
            borderRadius: "5px 16px 5px 16px",
            opacity: categoriaConDatos ? 1 : 0.6,
          }}
        >
          <ListIcon size={15} /> Ver el listado completo de esta categoría
        </button>

        <AvisoActualizacion categoria={categoria} grupoId={grupoId} grupoActivo={grupo?.activo} />
      </div>
    </div>
  );
}