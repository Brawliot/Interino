/** Constantes y helpers — Administración General CLM. */

export const ORGANISMO_ADMIN = "Administración General CLM";

export const PROVINCIAS_ADMIN = [
  "Albacete",
  "Ciudad Real",
  "Cuenca",
  "Guadalajara",
  "Toledo",
];

export const SUB_BOLSA_LABELS = {
  definitiva: "Bolsa definitiva",
  provisional: "Bolsa provisional",
  suspensos: "Bolsa de suspensos",
  extraordinaria: "Bolsa extraordinaria",
  general: "Listado general",
  sin_clasificar: "Listado",
};

export function subBolsaLegible(codigo) {
  if (!codigo) return "—";
  return SUB_BOLSA_LABELS[codigo] || codigo.replace(/_/g, " ");
}

export const COLECTIVOS_ADMIN = {
  funcionario: "Personal funcionario",
  laboral: "Personal laboral",
};
