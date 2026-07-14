import { useState } from "react";
import LogoInterino from "./LogoInterino.jsx";

const PASOS = [
  {
    titulo: "Tu posicion en la bolsa",
    cuerpo:
      "Consulta listados publicos de interinos en Castilla-La Mancha: sanidad (SESCAM), educacion y administracion general. Busca por apellidos o DNI parcial, como en el portal oficial.",
  },
  {
    titulo: "Educacion: tres modos",
    cuerpo:
      "Disponibles (sustituciones semanales), bolsa ordinaria (puntuacion anual) y bolsas afines (titulaciones relacionadas, Orden 32/2018). Elige el tipo de listado antes de buscar.",
  },
  {
    titulo: "Sobre el punto de corte",
    cuerpo:
      "En sanidad mostramos la puntuacion minima admitida actual, no quien fue la ultima persona llamada (dato que el SESCAM no publica). App no oficial: verifica siempre en los portales oficiales.",
  },
];

/** Overlay de bienvenida / onboarding — primera visita (v2). */
export default function OverlayBienvenida({ C, GRAIN, FONT_BODY, onEmpezar }) {
  const [paso, setPaso] = useState(0);
  const ultimo = paso >= PASOS.length - 1;
  const actual = PASOS[paso];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bienvenida-titulo"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
        background: `${C.paper}ee`,
        backgroundImage: `url("${GRAIN}")`,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: C.card,
          border: `1.5px solid ${C.line}`,
          borderRadius: "20px 8px 20px 8px",
          padding: "28px 24px 24px",
          boxShadow: `0 12px 40px ${C.navy}18, 0 2px 8px rgba(0,0,0,0.06)`,
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <LogoInterino height={40} C={C} />
        </div>

        <div className="flex justify-center gap-1.5 mb-4">
          {PASOS.map((_, i) => (
            <span
              key={i}
              aria-hidden
              style={{
                width: i === paso ? 20 : 6,
                height: 6,
                borderRadius: 999,
                background: i === paso ? C.navy : C.line,
                transition: "width 0.2s",
              }}
            />
          ))}
        </div>

        <p
          id="bienvenida-titulo"
          style={{
            fontFamily: FONT_BODY,
            fontSize: 17,
            fontWeight: 600,
            color: C.ink,
            margin: "0 0 10px",
            lineHeight: 1.35,
          }}
        >
          {actual.titulo}
        </p>

        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 14,
            color: C.inkSoft,
            margin: "0 0 24px",
            lineHeight: 1.55,
            textAlign: "left",
          }}
        >
          {actual.cuerpo}
        </p>

        <button
          type="button"
          onClick={() => (ultimo ? onEmpezar() : setPaso((p) => p + 1))}
          className="w-full font-bold focus:outline-none"
          style={{
            background: C.navy,
            color: "#fff",
            padding: "15px",
            fontFamily: FONT_BODY,
            fontSize: 15,
            borderRadius: "16px 5px 16px 5px",
            border: `2px solid ${C.gold}`,
            boxShadow: `0 4px 14px ${C.navy}33`,
          }}
        >
          {ultimo ? "Empezar" : "Siguiente"}
        </button>

        {!ultimo && (
          <button
            type="button"
            onClick={onEmpezar}
            className="w-full focus:outline-none mt-3"
            style={{
              background: "transparent",
              color: C.inkSoft,
              padding: "8px",
              fontFamily: FONT_BODY,
              fontSize: 13,
            }}
          >
            Saltar
          </button>
        )}
      </div>
    </div>
  );
}
