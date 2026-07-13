import LogoInterino from "./LogoInterino.jsx";

/** Overlay de bienvenida — solo primera visita. */
export default function OverlayBienvenida({ C, GRAIN, FONT_BODY, onEmpezar }) {
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
          maxWidth: 340,
          background: C.card,
          border: `1.5px solid ${C.line}`,
          borderRadius: "20px 8px 20px 8px",
          padding: "32px 28px 28px",
          boxShadow: `0 12px 40px ${C.navy}18, 0 2px 8px rgba(0,0,0,0.06)`,
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <LogoInterino height={44} C={C} />
        </div>

        <p
          id="bienvenida-titulo"
          style={{
            fontFamily: FONT_BODY,
            fontSize: 18,
            fontWeight: 500,
            color: C.ink,
            margin: "0 0 10px",
            lineHeight: 1.35,
            letterSpacing: "-0.01em",
          }}
        >
          Tu posición en la bolsa
        </p>

        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 14,
            color: C.inkSoft,
            margin: "0 0 28px",
            lineHeight: 1.5,
          }}
        >
          Consulta dónde estás en las listas de interinos de sanidad. Toca tu comunidad en el mapa o usa{" "}
          <span style={{ fontWeight: 600, color: C.navy }}>Buscar</span> si ya sabes dónde mirar.
        </p>

        <button
          type="button"
          onClick={onEmpezar}
          className="w-full font-bold focus:outline-none"
          style={{
            background: C.navy,
            color: "#fff",
            padding: "16px",
            fontFamily: FONT_BODY,
            fontSize: 15,
            borderRadius: "16px 5px 16px 5px",
            border: `2px solid ${C.gold}`,
            boxShadow: `0 4px 14px ${C.navy}33`,
          }}
        >
          Empezar
        </button>
      </div>
    </div>
  );
}
