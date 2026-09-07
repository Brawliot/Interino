import { useMemo, useState, useEffect } from "react";
import { UserPlus, Search, Loader2 } from "lucide-react";
import { useCapaDatos } from "../datos.jsx";
import { consultaPublicaDesdeEntrada, dniParcialParaGuardar, pareceNifCompleto } from "../utils/dniPublico.js";
import { C, FONT_BODY, FONT_MONO } from "../theme.js";

/**
 * Añadir favorito/aspirante concreto por DNI público o apellidos + categoría.
 */
export default function FormularioAnadirAspirante({
  gruposSanidad = [],
  onAnadir,
  disabled,
}) {
  const capa = useCapaDatos();
  const gruposActivos = useMemo(
    () => (gruposSanidad || []).filter((g) => g.activo !== false && (g.categorias || []).length),
    [gruposSanidad],
  );

  const [abierto, setAbierto] = useState(false);
  const [grupoId, setGrupoId] = useState("");
  const grupo = gruposActivos.find((g) => g.id === grupoId) || gruposActivos[0];
  const categorias = grupo?.categorias || [];
  const [categoria, setCategoria] = useState("");
  const [consulta, setConsulta] = useState("");
  const [alias, setAlias] = useState("");
  const [avisos, setAvisos] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [avisadoNif, setAvisadoNif] = useState(false);
  const [resultados, setResultados] = useState([]);

  useEffect(() => {
    if (!grupoId && gruposActivos[0]?.id) {
      setGrupoId(gruposActivos[0].id);
      setCategoria(gruposActivos[0].categorias?.[0] || "");
    }
  }, [gruposActivos, grupoId]);
  function syncGrupo(id) {
    setGrupoId(id);
    const g = gruposActivos.find((x) => x.id === id);
    setCategoria(g?.categorias?.[0] || "");
    setResultados([]);
  }

  async function buscar() {
    setError("");
    setResultados([]);
    const q = consultaPublicaDesdeEntrada(consulta);
    if (!q || q.length < 2) {
      setError("Escribe apellidos o DNI parcial (como en el listado público).");
      return;
    }
    if (!categoria || !grupo?.id) {
      setError("Elige grupo y categoría.");
      return;
    }
    if (!capa?.buscarPersonas) {
      setError("Datos aún no listos. Espera un momento.");
      return;
    }
    setAvisadoNif(pareceNifCompleto(consulta));
    setBuscando(true);
    try {
      const res = await capa.buscarPersonas(grupo.id, categoria, q);
      const personas = res?.personas || [];
      if (!personas.length) {
        setError("Sin coincidencias en esta categoría. Prueba otro DNI parcial o apellidos.");
      }
      setResultados(personas);
    } catch {
      setError("No se pudo consultar el listado. Inténtalo de nuevo.");
    } finally {
      setBuscando(false);
    }
  }

  function elegirAparicion(persona, aparicion) {
    const dni = dniParcialParaGuardar(persona.dniParcial || consulta);
    onAnadir?.({
      categoria,
      grupoId: grupo.id,
      gerencia: aparicion.gerencia || "",
      ambito: aparicion.ambito || "",
      ccaaId: aparicion.ccaaId || capa.ccaaId || "clm",
      sector: aparicion.sector || capa.sector || "sanidad",
      alias: alias.trim(),
      avisos,
      origen: "manual",
      resultado: {
        nombreCompleto: persona.nombreCompleto,
        dniParcial: dni || persona.dniParcial || "",
        posicion: aparicion.posicion ?? aparicion.pos,
        puntos: aparicion.puntos,
        total: aparicion.total,
        gerencia: aparicion.gerencia,
        ambito: aparicion.ambito,
        sector: aparicion.sector || capa.sector,
        ccaaId: aparicion.ccaaId || capa.ccaaId,
        grupoId: grupo.id,
        categoria,
      },
    });
    setConsulta("");
    setAlias("");
    setResultados([]);
    setAbierto(false);
    setError("");
  }

  if (!abierto) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAbierto(true)}
        className="w-full font-bold focus:outline-none flex items-center justify-center gap-2"
        style={{
          background: C.navy,
          color: "#fff",
          padding: "12px 14px",
          fontFamily: FONT_BODY,
          fontSize: 13.5,
          borderRadius: "12px 4px 12px 4px",
          marginBottom: 14,
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <UserPlus size={16} /> Añadir aspirante (DNI o apellidos)
      </button>
    );
  }

  return (
    <div
      style={{
        background: C.card,
        border: `1.5px solid ${C.navy}`,
        borderRadius: "12px 4px 12px 4px",
        padding: 14,
        marginBottom: 14,
      }}
    >
      <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy, margin: "0 0 6px" }}>
        Seguir a un aspirante concreto
      </p>
      <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.45, margin: "0 0 12px" }}>
        Usa el DNI parcial del listado público (p. ej. ****9885V) o apellidos. Si pegas un NIF completo, solo guardamos la forma pública enmascarada.
      </p>

      {gruposActivos.length > 0 && (
        <>
          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft }}>Grupo</span>
            <select
              value={grupo?.id || ""}
              onChange={(e) => syncGrupo(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                fontFamily: FONT_BODY,
                fontSize: 13,
                padding: "9px 12px",
                border: `1px solid ${C.line}`,
                background: C.paper,
                color: C.ink,
              }}
            >
              {gruposActivos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre || g.id}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft }}>Categoría</span>
            <select
              value={categoria}
              onChange={(e) => {
                setCategoria(e.target.value);
                setResultados([]);
              }}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                fontFamily: FONT_BODY,
                fontSize: 13,
                padding: "9px 12px",
                border: `1px solid ${C.line}`,
                background: C.paper,
                color: C.ink,
              }}
            >
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      <label style={{ display: "block", marginBottom: 8 }}>
        <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft }}>
          DNI parcial o apellidos
        </span>
        <input
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="****1234A o GARCÍA LÓPEZ"
          className="w-full focus:outline-none"
          style={{
            marginTop: 4,
            fontFamily: FONT_BODY,
            fontSize: 13.5,
            padding: "10px 12px",
            border: `1px solid ${C.line}`,
            background: C.paper,
            color: C.ink,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              buscar();
            }
          }}
        />
      </label>

      <label style={{ display: "block", marginBottom: 8 }}>
        <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft }}>
          Alias (opcional)
        </span>
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value.slice(0, 40))}
          placeholder="Yo, Compañera Ana…"
          className="w-full focus:outline-none"
          style={{
            marginTop: 4,
            fontFamily: FONT_BODY,
            fontSize: 13.5,
            padding: "10px 12px",
            border: `1px solid ${C.line}`,
            background: C.paper,
            color: C.ink,
          }}
        />
      </label>

      <label className="flex items-start gap-2" style={{ marginBottom: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={avisos} onChange={(e) => setAvisos(e.target.checked)} style={{ marginTop: 3 }} />
        <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.ink, lineHeight: 1.4 }}>
          Avisarme si cambia su posición o deja de aparecer en el listado
        </span>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setResultados([]);
            setError("");
          }}
          className="flex-1 font-bold focus:outline-none"
          style={{
            fontFamily: FONT_BODY,
            fontSize: 13,
            padding: "10px",
            border: `1px solid ${C.line}`,
            background: "transparent",
            color: C.inkSoft,
            borderRadius: 10,
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={buscar}
          disabled={buscando}
          className="flex-1 font-bold focus:outline-none flex items-center justify-center gap-2"
          style={{
            fontFamily: FONT_BODY,
            fontSize: 13,
            padding: "10px",
            background: C.gold,
            color: "#fff",
            borderRadius: 10,
            border: "none",
          }}
        >
          {buscando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          Buscar
        </button>
      </div>

      {avisadoNif && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.clay, marginTop: 10, lineHeight: 1.4 }}>
          Detectamos un NIF completo: en la búsqueda y al guardar usamos solo la forma pública enmascarada.
        </p>
      )}
      {error && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.clay, marginTop: 10, lineHeight: 1.4 }}>{error}</p>
      )}

      {resultados.length > 0 && (
        <div className="flex flex-col gap-2 mt-3">
          {resultados.slice(0, 12).map((p) => {
            const apariciones = p.apariciones?.length
              ? p.apariciones
              : [{ gerencia: "", ambito: "", posicion: p.posicion, puntos: p.puntos, total: p.total }];
            return apariciones.slice(0, 6).map((a, i) => (
              <button
                key={`${p.dniParcial || p.nombreCompleto}-${a.gerencia}-${a.ambito}-${i}`}
                type="button"
                onClick={() => elegirAparicion(p, a)}
                className="text-left focus:outline-none"
                style={{
                  background: C.paperDeep,
                  border: `1px solid ${C.line}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.navy, margin: 0 }}>
                  {p.nombreCompleto}
                </p>
                <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, margin: "4px 0 0" }}>
                  {[p.dniParcial, a.gerencia, a.ambito, a.posicion ? `#${a.posicion}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </button>
            ));
          })}
        </div>
      )}
    </div>
  );
}
