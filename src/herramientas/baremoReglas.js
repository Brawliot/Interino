/**
 * Reglas simplificadas del baremo del Pacto de Selección de Personal Temporal SESCAM.
 * Fuente: pacto consolidado nov. 2025 (apartados 11.A experiencia, 11.B formación).
 * NO cubre todos los supuestos (residencias, duplicidad marzo-julio, etc.).
 */

const DIAS_POR_MES = 30;

export const AVISO_BAREMO =
  "Cálculo orientativo según apartados 11.A y 11.B del Pacto SESCAM (versión consolidada 2025). No sustituye la baremación oficial de Selecta. Supuestos especiales no incluidos.";

export function calcularBaremo(input) {
  const expAp = (Number(input.mesesAp) || 0) * DIAS_POR_MES * 0.1;
  const expAe = (Number(input.mesesAe) || 0) * DIAS_POR_MES * 0.1;
  const expOtras = (Number(input.mesesOtrasCcaa) || 0) * DIAS_POR_MES * 0.1;

  const horasFc = Math.min(Number(input.horasFormacion) || 0, 1000);
  const formacionContinua = Math.min(horasFc * 0.1, 100);
  const horasExtra = Math.max(0, (Number(input.horasFormacion) || 0) - 1000);
  const formacionAnualExtra = Math.min(horasExtra * 0.1, 200);

  let titulos = 0;
  if (input.doctorado) titulos += 75;
  if (input.master) titulos += 25;
  if (input.dea) titulos += 25;
  if (input.especialistaUni) titulos += 15;
  if (input.expertoUni) titulos += 10;

  const otros = Number(input.otrosMeritos) || 0;

  const secciones = [
    { id: "expAp", label: "Experiencia AP (misma categoría, SNS)", puntos: expAp },
    { id: "expAe", label: "Experiencia AE (misma categoría, SNS)", puntos: expAe },
    { id: "expOtras", label: "Experiencia otras CCAA (misma categoría)", puntos: expOtras },
    { id: "fc", label: "Formación continuada (0,1 pt/h)", puntos: formacionContinua + formacionAnualExtra },
    { id: "titulos", label: "Títulos académicos", puntos: titulos },
    { id: "otros", label: "Otros méritos (manual)", puntos: otros },
  ];

  const total = secciones.reduce((s, x) => s + x.puntos, 0);
  return { secciones, total: Math.round(total * 100) / 100 };
}

/** Puntos de un mérito incremental (calculadora de méritos). */
export function puntosMeritoIncremental(tipo, detalle) {
  const n = Number(detalle) || 0;
  switch (tipo) {
    case "curso":
      return Math.round(n * 0.1 * 100) / 100;
    case "experiencia":
      return Math.round(n * DIAS_POR_MES * 0.1 * 100) / 100;
    case "master":
      return 25;
    case "doctorado":
      return 75;
    case "especialista":
      return 15;
    case "experto":
      return 10;
    default:
      return 0;
  }
}
