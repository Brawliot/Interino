import { subBolsaLegible } from "../../admin-clm.js";
import AvisoActualizacion from "../AvisoActualizacion.jsx";
import {
  ResultadoHero,
  ResultadoPie,
  ResultadoShell,
} from "./ResultadoShell.jsx";

export default function TarjetaAdmin({ categoria, grupoId, grupoActivo, r, guardado, onGuardar, onVerListado }) {
  const posicion = Number(r?.posicion ?? r?.pos ?? 0) || 0;
  const total = Number(r?.total ?? 0) || 0;
  const provincia = r?.provincia || r?.gerencia || "Provincia";
  const percentil = total > 0 ? Math.round((1 - posicion / total) * 100) : 0;
  const etiqueta = `${categoria} · ${provincia}`;
  const meta = r?.sub_bolsa
    ? `${subBolsaLegible(r.sub_bolsa)}${r.num_bolsa ? ` · nº bolsa ${r.num_bolsa}` : ""}`
    : null;

  return (
    <ResultadoShell
      style={{ marginBottom: 16 }}
      hero={
        <ResultadoHero
          sello={provincia}
          eyebrow={categoria}
          posicion={posicion}
          subtitulo={
            total > 0
              ? `de ${total.toLocaleString("es-ES")} en ${provincia} · por delante del ${percentil}%`
              : `Posición en ${provincia}`
          }
          meta={meta}
          compact
          decoracion={false}
        />
      }
      seguir={{
        ctaLabel: "Seguir esta provincia",
        etiquetaSeguimiento: etiqueta,
        avisoOficial: "Esto no sustituye la llamada oficial.",
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
      pie={
        <ResultadoPie
          onVerListado={onVerListado}
          verListadoLabel={`Ver listado de ${provincia}`}
        />
      }
    />
  );
}
