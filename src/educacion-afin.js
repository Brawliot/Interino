/** Helpers para bolsas afines (Orden 32/2018 art. 9-10, Anexo II). */

function tituloUi(nombreScraper) {
  if (!nombreScraper) return nombreScraper;
  return nombreScraper
    .toLowerCase()
    .split(" ")
    .map((palabra) => {
      if (palabra.includes(":")) {
        const [a, b] = palabra.split(":");
        return `${a.charAt(0).toUpperCase()}${a.slice(1)}: ${b.trim().charAt(0).toUpperCase()}${b.trim().slice(1)}`;
      }
      return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    })
    .join(" ");
}

/** Clave interna de especialidad: "001 FILOSOFIA". */
export function claveEspecialidad(codigo, nombre) {
  const c = String(codigo || "").padStart(3, "0");
  return `${c} ${String(nombre || "").trim().toUpperCase()}`;
}

/** Código de cuerpo desde grupoId (slug carpeta). */
export function codigoCuerpoDesdeGrupo(grupoId, slugMap) {
  for (const [codigo, slug] of Object.entries(slugMap || {})) {
    if (slug === grupoId) return codigo;
  }
  return null;
}

/** Especialidades de plaza donde podrías optar estando en esta bolsa (Anexo II). */
export function plazasAfinDesdeBolsa(afinidadDoc, cuerpoCodigo, claveEsp) {
  const lista = afinidadDoc?.desde_bolsa?.[cuerpoCodigo]?.[claveEsp];
  return Array.isArray(lista) ? lista : [];
}

export function nombreUiDesdeClave(clave) {
  const m = String(clave || "").match(/^\d{3}\s+(.+)$/);
  return m ? tituloUi(m[1]) : clave;
}

export function plazasAfinUi(afinidadDoc, cuerpoCodigo, meta) {
  if (!meta || !afinidadDoc) return [];
  const clave = claveEspecialidad(meta.codigo, meta.nombre);
  return plazasAfinDesdeBolsa(afinidadDoc, cuerpoCodigo, clave).map(nombreUiDesdeClave);
}

export function viaBolsaLegible(via) {
  if (via === "propia") return "Propia bolsa";
  if (via === "inscrita") return "También inscrito/a";
  if (via === "afin") return "Bolsa afín (titulación)";
  return "";
}

export const TEXTO_AFIN_NORMATIVA =
  "En adjudicaciones «a la carta», tras agotar la propia bolsa pueden llamarse aspirantes de bolsas afines si la titulación lo permite (Orden 32/2018, Anexo II). Tu posición en la bolsa de origen cuenta para el desempate entre afines.";
