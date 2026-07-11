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

/** Solo sanidad activa en CLM, Murcia y Madrid. */
export function sectoresDeCcaa(ccaaId) {
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
      { id: "educacion", nombre: "Educación", activo: false, fuente: "Próximamente" },
      { id: "administracion", nombre: "Administración General", activo: false, fuente: "Próximamente" },
    ];
  }
  return [sanidad];
}

export function tituloBolsa(ccaaId) {
  return TITULO_BOLSA[ccaaId] || "Sanidad";
}

export function organismoCcaa(ccaaId) {
  return ORGANISMO[ccaaId] || "administración";
}

export function esGrupoSanitarioMurcia(grupoLabel) {
  const g = grupoLabel.toLowerCase();
  return g.includes("sanitari") && !g.includes("no sanitari");
}
