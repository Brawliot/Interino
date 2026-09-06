import { useCallback, useEffect, useRef, useState } from "react";
import ListasApp from "../listas-app.jsx";
import {
  AsegurarPacksProvider,
  cargarDatosIniciales,
  crearDatosPendientes,
  DatosProvider,
  descubrirDisponibilidad,
  fusionarPacks,
} from "./datos.jsx";

const FONT_BODY = "'Inter', system-ui, sans-serif";
const LS_LAST_CCAA = "interino_last_ccaa_v1";

function leerUltimaCcaaId() {
  try {
    const raw = localStorage.getItem(LS_LAST_CCAA);
    if (raw === "mur" || raw === "mad" || raw === "clm") return raw;
  } catch {
    /* modo privado */
  }
  return "clm";
}

export default function App() {
  const [datos, setDatos] = useState(() => crearDatosPendientes());
  const [error, setError] = useState(null);
  const datosRef = useRef(datos);
  datosRef.current = datos;

  const asegurarPacks = useCallback(async (packIds) => {
    const next = await fusionarPacks(datosRef.current, packIds);
    datosRef.current = next;
    setDatos(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const ccaaId = leerUltimaCcaaId();
        const inicial = await cargarDatosIniciales({ ccaaId });
        if (cancelado) return;
        datosRef.current = inicial;
        setDatos(inicial);
        setError(null);

        // Prefetch flags + JSON del resto sin bloquear la primera búsqueda.
        const descubierto = await descubrirDisponibilidad(inicial);
        if (cancelado) return;
        datosRef.current = descubierto;
        setDatos(descubierto);
      } catch (e) {
        if (cancelado) return;
        setError(e.message || "No se pudieron cargar los listados");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <DatosProvider datos={datos}>
      <AsegurarPacksProvider value={asegurarPacks}>
        {error && !datos.listo && (
          <div
            role="alert"
            style={{
              position: "sticky",
              top: 0,
              zIndex: 50,
              padding: "10px 16px",
              background: "#F3E6D8",
              color: "#3D3429",
              fontFamily: FONT_BODY,
              fontSize: 13,
              textAlign: "center",
              borderBottom: "1px solid #E0D2C2",
            }}
          >
            Error al cargar listados: {error}. Puedes ver seguimientos guardados; la búsqueda
            necesita red.
          </div>
        )}
        <ListasApp />
      </AsegurarPacksProvider>
    </DatosProvider>
  );
}
