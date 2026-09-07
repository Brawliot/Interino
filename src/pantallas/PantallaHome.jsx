import { useState } from "react";
import { CCAA_LIST } from "../regiones.js";
import MapaEspanaCCAA from "../MapaEspanaCCAA.jsx";
import LogoInterino from "../components/LogoInterino.jsx";
import OverlayBienvenida from "../components/OverlayBienvenida.jsx";
import { C, GRAIN, FONT_BODY } from "../theme.js";

const LS_BIENVENIDA = "interino_bienvenida_v2";

function bienvenidaVista() {
  try {
    return localStorage.getItem(LS_BIENVENIDA) === "1";
  } catch {
    return false;
  }
}

function marcarBienvenidaVista() {
  try {
    localStorage.setItem(LS_BIENVENIDA, "1");
    localStorage.setItem("interino_bienvenida_v1", "1");
  } catch { /* quota / modo privado */ }
}

export default function PantallaHome({ onConfirmCcaas, onSeguimientos, numSeguimientos }) {
  const [mostrarBienvenida, setMostrarBienvenida] = useState(() => !bienvenidaVista());

  const cerrarBienvenida = () => {
    marcarBienvenidaVista();
    setMostrarBienvenida(false);
  };

  return (
    <>
      {mostrarBienvenida && (
        <OverlayBienvenida
          C={C}
          GRAIN={GRAIN}
          FONT_BODY={FONT_BODY}
          onEmpezar={cerrarBienvenida}
        />
      )}
      <div
        style={{
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          paddingBottom: 56,
        }}
      >
        <header style={{ flex: "0 0 auto", padding: "14px 20px 4px", position: "relative" }}>
          <LogoInterino height={34} C={C} />
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 16,
              fontWeight: 500,
              color: C.ink,
              margin: "8px 0 0",
              lineHeight: 1.35,
              letterSpacing: "-0.01em",
            }}
          >
            Tu posición en la bolsa
          </p>
          {numSeguimientos > 0 && (
            <button
              type="button"
              onClick={onSeguimientos}
              aria-label={`${numSeguimientos} favoritos`}
              className="focus:outline-none"
              style={{
                position: "absolute",
                top: 16,
                right: 20,
                width: 28,
                height: 28,
                borderRadius: 999,
                background: C.navy,
                color: "#fff",
                fontFamily: FONT_BODY,
                fontSize: 12,
                fontWeight: 700,
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {numSeguimientos}
            </button>
          )}
        </header>

        <div style={{ flex: 1, minHeight: 0, padding: "0 12px 4px", display: "flex", flexDirection: "column" }}>
          <MapaEspanaCCAA modo="hero" onConfirm={onConfirmCcaas} ccaaList={CCAA_LIST} colors={C} />
        </div>
      </div>
    </>
  );
}
