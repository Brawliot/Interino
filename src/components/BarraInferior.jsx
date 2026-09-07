import { Search, Pin, Settings } from "lucide-react";
import { C, FONT_BODY } from "../theme.js";

export function tabBarraInferior(paso) {
  if (paso === "seguimientos") return "seguimientos";
  if (
    paso === "mas" ||
    paso === "cuenta" ||
    paso === "privacidad" ||
    paso === "simulador-baremo" ||
    paso === "simulador-gerencia" ||
    paso === "mapa-oportunidades" ||
    paso === "analisis-puntos" ||
    paso === "plan-accion" ||
    paso === "informe-pdf" ||
    paso === "recomendador-especialidades" ||
    paso === "calculadora-nomina" ||
    paso === "guia-llamamiento" ||
    paso === "calculadora-meritos"
  ) {
    return "mas";
  }
  if (paso === "inicio") return null;
  return "buscar";
}

function BarraInferior({ activo, onBuscar, onSeguimientos, onMas, numSeguimientos }) {
  const items = [
    { id: "buscar", label: "Buscar", icon: Search, onClick: onBuscar },
    { id: "seguimientos", label: "Favoritos", icon: Pin, onClick: onSeguimientos, badge: numSeguimientos },
    { id: "mas", label: "Más", icon: Settings, onClick: onMas },
  ];

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        background: C.card,
        borderTop: `1px solid ${C.line}`,
        zIndex: 50,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="max-w-md mx-auto h-full flex items-stretch">
        {items.map((item) => {
          const Icono = item.icon;
          const sel = activo === item.id;
          const color = sel ? C.navy : C.inkSoft;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              aria-current={sel ? "page" : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 focus:outline-none relative"
              style={{ background: "transparent", border: "none", padding: "6px 0" }}
            >
              <div className="relative">
                <Icono size={16} color={color} strokeWidth={sel ? 2.5 : 2.2} />
                {item.badge > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -5,
                      right: -8,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 999,
                      background: C.navy,
                      color: "#fff",
                      fontFamily: FONT_BODY,
                      fontSize: 9,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 4px",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span style={{ fontFamily: FONT_BODY, fontSize: 10, fontWeight: sel ? 700 : 600, color }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export { BarraInferior };
export default BarraInferior;
