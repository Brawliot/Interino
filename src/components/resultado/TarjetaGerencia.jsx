import { useCapaDatos } from "../../datos.jsx";
import { organismoCcaa } from "../../regiones.js";
import AvisoActualizacion from "../AvisoActualizacion.jsx";
import {
  ResultadoHero,
  ResultadoChips,
  ResultadoColapsable,
  ResultadoConsejoPortal,
  ResultadoPie,
  ResultadoShell,
} from "./ResultadoShell.jsx";
import { etiquetaLista } from "../../utils/etiquetasLista.js";
import PanelCorteGerencia from "./PanelCorteGerencia.jsx";
import ComparativaPosicionFechas from "./ComparativaPosicionFechas.jsx";
import PosicionInicioVsActual from "./PosicionInicioVsActual.jsx";
import EvolucionHistoricaCandidato from "./EvolucionHistoricaCandidato.jsx";
import AnalisisTendenciaPredictivo from "./AnalisisTendenciaPredictivo.jsx";

export default function TarjetaGerencia({ categoria, gerencia, ambito, grupoId, grupoActivo, ccaaId, r, guardado, onGuardar, onVerListado, onInfoLlamamientos }) {
  const capa = useCapaDatos();
  const regionId = ccaaId || r.ccaaId || capa.ccaaId;
  const organismo = organismoCcaa(regionId);
  const portalNombre = regionId === "clm" ? "Selecta" : organismo;
  const posicion = Number(r?.posicion ?? r?.pos ?? 0) || 0;
  const total = Number(r?.total ?? 0) || 0;
  const puntos = Number(r?.puntos ?? 0) || 0;
  const percentil = total > 0 ? Math.round((1 - posicion / total) * 100) : 0;
  const etiqueta = etiquetaLista(categoria, gerencia, ambito || r.ambito, r);
  const historial =
    grupoActivo && capa.tieneDatosReales(categoria, grupoId)
      ? capa.historialCorte(categoria, gerencia, ambito || r.ambito || "", grupoId)
      : [];
  const contratosActivos = r.tiposContrato
    ? Object.entries(r.tiposContrato).filter(([, activo]) => activo).map(([tipo]) => tipo)
    : [];
  const mostrarHistorico = regionId === "clm" && !capa.modoHistorico;
  const candidato = {
    nombreCompleto: r.nombreCompleto,
    dniParcial: r.dniParcial,
  };
  const propsHist = {
    categoria,
    grupoId,
    gerencia,
    ambito: ambito || r.ambito || "",
    ccaaId: regionId,
    candidato,
    posicionActual: posicion,
    puntosActual: puntos,
    totalActual: total,
  };

  return (
    <ResultadoShell
      hero={
        <ResultadoHero
          sello={etiquetaLista(categoria, gerencia, ambito || r.ambito)}
          posicion={posicion}
          subtitulo={`de ${total.toLocaleString("es-ES")} en la bolsa · por delante del ${percentil}%${
            puntos > 0 ? ` · ${puntos.toFixed(1)} pts` : ""
          }`}
        />
      }
      seguir={{
        ctaLabel: "Seguir esta gerencia",
        etiquetaSeguimiento: etiqueta,
        avisoOficial: `Esto no sustituye la llamada oficial de ${organismo} — esa te la hacen ellos directamente, y tienes horas contadas para responder.`,
        guardado,
        onGuardar,
      }}
      aviso={
        <>
          <AvisoActualizacion
            categoria={categoria}
            grupoId={grupoId}
            grupoActivo={grupoActivo}
            tieneResultado={posicion > 0}
          />
          {mostrarHistorico && <EvolucionHistoricaCandidato {...propsHist} />}
          {mostrarHistorico && <AnalisisTendenciaPredictivo {...propsHist} />}
          {mostrarHistorico && <PosicionInicioVsActual {...propsHist} />}
          {mostrarHistorico && <ComparativaPosicionFechas {...propsHist} />}
        </>
      }
      secondary={
        <ResultadoChips
          label="Disponible:"
          items={contratosActivos.map((tipo) => ({ key: tipo, label: tipo }))}
        />
      }
      colapsable={
        <ResultadoColapsable label="Ver distancia al corte">
          <PanelCorteGerencia
            categoria={categoria}
            gerencia={gerencia}
            ambito={ambito || r.ambito}
            puntos={puntos}
            historial={historial}
          />
          <ResultadoConsejoPortal
            titulo={`Revisa tus datos en ${portalNombre}.`}
            texto="Muchos llamamientos se pierden por un teléfono o email desactualizado."
          />
        </ResultadoColapsable>
      }
      pie={<ResultadoPie onVerListado={onVerListado} onInfoLlamamientos={onInfoLlamamientos} />}
    />
  );
}
