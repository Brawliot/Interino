import { useEffect, useState } from "react";
import ListasApp from "../listas-app.jsx";
import { cargarDatos, DatosProvider } from "./datos.jsx";

const FONT_BODY = "'Inter', system-ui, sans-serif";

export default function App() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos().then(setDatos).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONT_BODY }}>
        <p>Error al cargar datos: {error}</p>
      </div>
    );
  }

  if (!datos) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_BODY, color: "#5B6355" }}>
        Cargando listados…
      </div>
    );
  }

  return (
    <DatosProvider datos={datos}>
      <ListasApp />
    </DatosProvider>
  );
}
