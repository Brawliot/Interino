import { useEffect, useState } from "react";
import { useDatos } from "../../datos.jsx";
import { analizarDelanteCursoAnterior } from "../../utils/delanteCurso.js";
import { ResultadoColapsable } from "./ResultadoShell.jsx";
import { C, FONT_BODY, FONT_MONO } from "../../theme.js";

/**
 * Personas que estaban por delante al inicio de curso y ya no figuran (o bajaron detrás).
 */
export default function QuienPorDelanteCurso({
  categoria,
  grupoId,
  gerencia,
  ambito,
  ccaaId,
  candidato,
  posicionActual,
}) {
  const datos = useDatos();
  const [estado, setEstado] = useState({ loading: true });

  useEffect(() => {
    let cancel = false;
    setEstado({ loading: true });
    (async () => {
      const r = await analizarDelanteCursoAnterior({
        datos,
        archiveIndex: datos.archiveIndex,
        ctx: {
          grupoId,
          categoria,
          gerencia,
          ambito: ambito || "",
          ccaaId: ccaaId || "clm",
          candidato,
        },
        posicionActual,
      });
      if (!cancel) setEstado({ loading: false, ...r });
    })();
    return () => {
      cancel = true;
    };
  }, [datos, categoria, grupoId, gerencia, ambito, ccaaId, candidato, posicionActual]);

  if (estado.loading) {
    return (
      <ResultadoColapsable label="Quién iba por delante (inicio de curso)">
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, margin: 0 }}>Comparando con el archivo histórico…</p>
      </ResultadoColapsable>
    );
  }

  if (!estado.ok) {
    const msgs = {
      sin_archive: "Aún no hay snapshots de inicio de curso en el archivo histórico.",
      sin_listado_inicio: "No hay listado archivado para esta gerencia al inicio de curso.",
      sin_listado_actual: "No se pudo cargar el listado actual.",
      no_estabas: "No figurabas en esta gerencia al inicio del curso (o el matching falló).",
    };
    return (
      <ResultadoColapsable label="Quién iba por delante (inicio de curso)">
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, margin: 0, lineHeight: 1.45 }}>
          {msgs[estado.motivo] || "No hay datos suficientes para esta comparación."}
        </p>
      </ResultadoColapsable>
    );
  }

  const { ausentes, detrasAhora, siguen, delanteAntes, curso, fechaInicio, posicionInicio } = estado;

  return (
    <ResultadoColapsable label={`Quién iba por delante (curso ${curso})`}>
      <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.45, margin: "0 0 10px" }}>
        Al inicio de curso ({fechaInicio}) estabas en #{posicionInicio}. Había {delanteAntes.length} persona
        {delanteAntes.length === 1 ? "" : "s"} por delante. Que alguien <strong>ya no aparezca</strong> puede ser
        adjudicación, desactivación, cambio de gerencia u otro motivo: no es un registro oficial de llamamientos.
      </p>

      <div className="flex flex-wrap gap-2" style={{ marginBottom: 12 }}>
        <Pill label="Ya no aparecen" n={ausentes.length} highlight />
        <Pill label="Siguen delante" n={siguen.length} />
        <Pill label="Ahora detrás de ti" n={detrasAhora.length} />
      </div>

      {ausentes.length > 0 && (
        <ListaPersonas
          titulo="Ya no están en el listado"
          items={ausentes.slice(0, 40)}
          extra={(p) => `iba #${p.posicion}`}
        />
      )}
      {detrasAhora.length > 0 && (
        <ListaPersonas
          titulo="Bajaron detrás de tu puesto actual"
          items={detrasAhora.slice(0, 20)}
          extra={(p) => `#${p.posicion} → #${p.posicionActual}`}
        />
      )}
    </ResultadoColapsable>
  );
}

function Pill({ label, n, highlight }) {
  return (
    <span
      style={{
        fontFamily: FONT_BODY,
        fontSize: 11,
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 999,
        background: highlight ? `${C.clay}18` : C.paperDeep,
        color: highlight ? C.clay : C.inkSoft,
      }}
    >
      {label}: {n}
    </span>
  );
}

function ListaPersonas({ titulo, items, extra }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12, color: C.navy, margin: "0 0 6px" }}>
        {titulo}
      </p>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
        {items.map((p) => (
          <li
            key={`${p.dniParcial}-${p.nombreCompleto}-${p.posicion}`}
            style={{
              fontFamily: FONT_BODY,
              fontSize: 12,
              color: C.ink,
              padding: "6px 0",
              borderTop: `1px solid ${C.line}`,
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span>
              {p.nombreCompleto}
              {p.dniParcial ? (
                <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.inkSoft }}> · {p.dniParcial}</span>
              ) : null}
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, flexShrink: 0 }}>
              {extra?.(p)}
            </span>
          </li>
        ))}
      </ul>
      {items.length >= 40 && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, margin: "6px 0 0" }}>
          Mostrando las primeras 40.
        </p>
      )}
    </div>
  );
}
