import { ambitoLegible } from "../datos.jsx";

export function ambitoCorto(ambito) {
  if (!ambito) return "";
  if (ambito === "Atencion Primaria" || ambito.includes("Primaria")) return "AP";
  if (ambito === "Atencion Especializada" || ambito.includes("Especializada")) return "AE";
  return ambito;
}

export function etiquetaGerenciaCorta(categoria, gerencia, ambito) {
  const ab = ambitoCorto(ambito);
  return ab ? `${gerencia} · ${ab}` : gerencia;
}

export function etiquetaLista(categoria, gerencia, ambito, aparicion) {
  const region = aparicion?.ccaaNombre ? `${aparicion.ccaaNombre} · ` : "";
  const base = `${region}${categoria} · ${gerencia}`;
  const ab = aparicion?.ambitosMerged || (ambito ? ambitoLegible(ambito) : "");
  return ab ? `${base} · ${ab}` : base;
}
