/** Configuración de comunidades y sectores visibles en la app. */

export const CCAA_LIST = [
  { id: "gal", nombre: "Galicia", activo: false },
  { id: "ast", nombre: "Asturias", activo: false },
  { id: "cant", nombre: "Cantabria", activo: false },
  { id: "pv", nombre: "País Vasco", activo: false },
  { id: "nav", nombre: "Navarra", activo: false },
  { id: "rioja", nombre: "La Rioja", activo: false },
  { id: "ar", nombre: "Aragón", activo: false },
  { id: "cat", nombre: "Cataluña", activo: false },
  { id: "val", nombre: "Comunitat Valenciana", activo: false },
  { id: "bal", nombre: "Illes Balears", activo: false },
  { id: "mad", nombre: "Comunidad de Madrid", activo: true },
  { id: "cyl", nombre: "Castilla y León", activo: false },
  { id: "clm", nombre: "Castilla-La Mancha", activo: true },
  { id: "ext", nombre: "Extremadura", activo: false },
  { id: "mur", nombre: "Región de Murcia", activo: true },
  { id: "and", nombre: "Andalucía", activo: false },
  { id: "can", nombre: "Canarias", activo: false },
];

const FUENTE_SANIDAD = {
  clm: "SESCAM · Bolsa única SELECTA",
  mur: "SMS · Bolsa murciasalud.es",
  mad: "SERMAS · Bolsa Comunidad de Madrid",
};

const ORGANISMO = {
  clm: "SESCAM",
  mur: "SMS",
  mad: "SERMAS",
};

const TITULO_BOLSA = {
  clm: "Sanidad · Bolsa SESCAM",
  mur: "Sanidad · Bolsa SMS",
  mad: "Sanidad · Bolsa SERMAS",
};

/** Solo sanidad activa en CLM, Murcia y Madrid. Educación CLM si hay manifest scrapeado. */
export function sectoresDeCcaa(ccaaId, opciones = {}) {
  const { educacionActiva = false } = opciones;
  const fuente = FUENTE_SANIDAD[ccaaId] || "Próximamente";
  const sanidad = {
    id: "sanidad",
    nombre: "Sanidad",
    activo: ccaaId === "clm" || ccaaId === "mur" || ccaaId === "mad",
    fuente,
  };
  if (ccaaId === "clm") {
    return [
      sanidad,
      {
        id: "educacion",
        nombre: "Educación",
        activo: educacionActiva,
        fuente: educacionActiva
          ? "Educación CLM · Bolsas de sustitución"
          : "Próximamente",
      },
      { id: "administracion", nombre: "Administración General", activo: false, fuente: "Próximamente" },
    ];
  }
  return [sanidad];
}

export function tituloBolsa(ccaaId) {
  return TITULO_BOLSA[ccaaId] || "Sanidad";
}

/** Título de búsqueda cuando el usuario eligió varias CCAA. */
export function tituloBolsaMulti(ccaaIds) {
  const ids = [...new Set(ccaaIds)].filter(Boolean);
  if (ids.length <= 1) return tituloBolsa(ids[0] || "clm");
  const partes = ids.map((id) => (TITULO_BOLSA[id] || "Sanidad").replace(/^Sanidad · /, ""));
  return `Sanidad · ${partes.join(" + ")}`;
}

/** Nombres legibles de varias CCAA (p. ej. barra de sector). */
export function nombresCcaas(ccaaIds) {
  const porId = Object.fromEntries(CCAA_LIST.map((c) => [c.id, c.nombre]));
  return [...new Set(ccaaIds)]
    .filter(Boolean)
    .map((id) => porId[id] || id);
}

/** Sectores visibles al combinar varias comunidades. */
export function sectoresParaCcaas(ccaaIds, opciones = {}) {
  const ids = [...new Set(ccaaIds)].filter(Boolean);
  if (ids.length <= 1) return sectoresDeCcaa(ids[0] || "clm", opciones);
  const fuentes = ids
    .map((id) => sectoresDeCcaa(id, opciones).find((s) => s.id === "sanidad")?.fuente)
    .filter(Boolean);
  const sanidadActiva = ids.every((id) => id === "clm" || id === "mur" || id === "mad");
  return [
    {
      id: "sanidad",
      nombre: "Sanidad",
      activo: sanidadActiva,
      fuente: fuentes.join(" · "),
    },
  ];
}

export function organismoCcaa(ccaaId) {
  return ORGANISMO[ccaaId] || "administración";
}

export function esGrupoSanitarioMurcia(grupoLabel) {
  const g = grupoLabel.toLowerCase();
  return g.includes("sanitari") && !g.includes("no sanitari");
}
