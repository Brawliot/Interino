import { UserCheck } from "lucide-react";
import Barra from "../components/Barra.jsx";
import { C, FONT_BODY, FONT_MONO } from "../theme.js";

export default function PantallaConfirmar({ categoria, candidatos, atras, onElegir, global, modoAdministracion }) {
  return (
    <div>
      <Barra titulo="¿Cuál eres tú?" atras={atras} />
      <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: C.inkSoft, padding: "0 20px 4px" }}>
        {global
          ? `Encontramos ${candidatos.length} personas que coinciden con tu búsqueda en tus comunidades seleccionadas. Toca tu nombre${modoAdministracion ? "." : " — si dudas, el listado también muestra los últimos dígitos del DNI para confirmar."}`
          : `Encontramos ${candidatos.length} personas que coinciden con tu búsqueda en las listas de ${categoria}. Toca tu nombre${modoAdministracion ? "." : " — si dudas, el listado también muestra los últimos dígitos del DNI para confirmar."}`}
      </p>

      <div className="px-5 mt-4 flex flex-col gap-3">
        {candidatos.map((c, i) => (
          <button
            key={c.dniParcial || `${c.nombreCompleto}-${i}`}
            onClick={() => onElegir(c)}
            className="text-left flex items-center gap-3 focus:outline-none focus:ring-2"
            style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: i % 2 === 0 ? "16px 6px 16px 6px" : "6px 16px 6px 16px", padding: "14px 16px" }}
          >
            <UserCheck size={18} color={C.navy} />
            <div>
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy }}>{c.nombreCompleto}</p>
              <p style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.inkSoft }}>
                En {(c.apariciones || []).length} provincia{(c.apariciones || []).length !== 1 ? "s" : ""} · mejor posición #{(c.apariciones || []).length ? Math.min(...c.apariciones.map((a) => a.posicion)) : "—"}
                {!modoAdministracion && c.dniParcial ? ` · DNI ${c.dniParcial}` : ""}
              </p>
            </div>
          </button>
        ))}
      </div>

      <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, padding: "16px 20px 0" }}>
        {modoAdministracion
          ? "Si no te encuentras, vuelve atrás y prueba con más apellidos."
          : "Si no te encuentras, vuelve atrás y prueba con más apellidos, con los dígitos del DNI o con una combinación de ambos."}
      </p>
    </div>
  );
}
