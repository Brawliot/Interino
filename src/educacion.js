/** Slug de carpeta por código de cuerpo (debe coincidir con scraper_educacion_clm.py). */
export const CUERPO_SLUG = {
  "0597": "maestros",
  "0590": "secundaria",
  "0591": "tecnicos-fp",
  "0592": "eoii",
  "0593": "catedraticos-musica",
  "0594": "profesores-musica",
  "0595": "artes-plasticas",
  "0596": "maestros-taller",
  "0598": "fp-singulares",
};

export const PROVINCIAS_CLM = [
  { codigo: "02", nombre: "Albacete", abrev: "AB" },
  { codigo: "13", nombre: "Ciudad Real", abrev: "CR" },
  { codigo: "16", nombre: "Cuenca", abrev: "CU" },
  { codigo: "19", nombre: "Guadalajara", abrev: "GU" },
  { codigo: "45", nombre: "Toledo", abrev: "TO" },
];

export const GERENCIA_EDUCACION = "Educación CLM";

export function tipoBolsaLegible(tipo) {
  if (tipo === "ordinaria") return "Bolsa ordinaria";
  if (tipo === "reserva") return "Bolsa de reserva";
  return tipo || "Bolsa";
}

export function esBolsaOrdinaria(tipoListado) {
  return tipoListado === "bolsa_ordinaria";
}

export function esModoAfin(modo) {
  return modo === "afin";
}

/** Bolsa ordinaria o modo afines (misma fuente educacion-bolsa/). */
export function usaDatosBolsaOrdinaria(tipoListado) {
  return tipoListado === "bolsa_ordinaria" || tipoListado === "afin";
}

export const MODOS_LISTADO_EDUCACION = {
  bolsa: {
    id: "bolsa",
    titulo: "Bolsa ordinaria",
    subtitulo: "Listado por puntuación (renovación anual)",
  },
  disponibles: {
    id: "disponibles",
    titulo: "Disponibles",
    subtitulo: "Quién acepta sustituciones esta semana",
  },
  afin: {
    id: "afin",
    titulo: "Bolsas afines",
    subtitulo: "Otras especialidades y plazas por titulación",
  },
};
