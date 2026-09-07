import { C, FONT_BODY } from "../theme.js";

export default function CargandoHerramienta() {
  return (
    <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, padding: 24, textAlign: "center" }}>
      Cargando…
    </p>
  );
}
