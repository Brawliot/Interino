/**
 * Tablas simplificadas SATSE/SESCAM 2025 (Atención Primaria / Especializada).
 * Fuente orientativa: resúmenes retributivos SATSE CLM julio 2025.
 * No incluye todos los complementos (turnicidad, productividad variable, etc.).
 */

export const ANIO_TABLAS = "2025";
export const AVISO_NOMINA =
  `Estimación orientativa con tablas salariales de ${ANIO_TABLAS} (SATSE CLM). Tu nómina real dependerá de tu situación fiscal, trienios, carrera profesional y complementos no modelados aquí.`;

export const CATEGORIAS_NOMINA = [
  { id: "enfermero-ap", label: "Enfermero/a · Atención Primaria", sueldoBase: 1152.97, destino: 569.13, especifico: 25.43, grupo: "A2" },
  { id: "enfermero-ae", label: "Enfermero/a · Atención Especializada (hosp.)", sueldoBase: 1152.97, destino: 569.13, especifico: 410.79, grupo: "A2" },
  { id: "fisio-ap", label: "Fisioterapeuta · AP", sueldoBase: 1152.97, destino: 569.13, especifico: 185.01, grupo: "A2" },
  { id: "fisio-ae", label: "Fisioterapeuta · AE", sueldoBase: 1152.97, destino: 569.13, especifico: 347.19, grupo: "A2" },
];

export const TIPOS_CONTRATO = [
  { id: "larga-tc", label: "Larga duración · Tiempo completo" },
  { id: "larga-tp", label: "Larga duración · Tiempo parcial (50%)" },
  { id: "corta-tc", label: "Corta duración · Tiempo completo" },
];

export const TRAMOS_IRPF = [
  { id: "bajo", label: "Primer empleo / tipo bajo (~12%)", tasa: 0.12 },
  { id: "medio", label: "Tipo medio (~18%)", tasa: 0.18 },
  { id: "alto", label: "Ya trabajo todo el año / tipo alto (~24%)", tasa: 0.24 },
];

const SS_TRABAJADOR = 0.0635;
const PAGAS = 14;

export function calcularNomina({ categoriaId, tipoContrato, tramoIrpf, trienios = 0 }) {
  const cat = CATEGORIAS_NOMINA.find((c) => c.id === categoriaId) || CATEGORIAS_NOMINA[0];
  const irpf = TRAMOS_IRPF.find((t) => t.id === tramoIrpf) || TRAMOS_IRPF[1];
  let factor = 1;
  if (tipoContrato === "larga-tp") factor = 0.5;
  if (tipoContrato === "corta-tc") factor = 1;

  const trienioImporte = 41.85 * Math.min(trienios, 30);
  const sueldoBase = cat.sueldoBase * factor;
  const destino = cat.destino * factor;
  const especifico = cat.especifico * factor;
  const trieniosEur = trienioImporte * factor;
  const brutoMensual = sueldoBase + destino + especifico + trieniosEur;
  const ss = brutoMensual * SS_TRABAJADOR;
  const irpfEur = brutoMensual * irpf.tasa;
  const netoMensual = brutoMensual - ss - irpfEur;

  return {
    sueldoBase,
    destino,
    especifico,
    trienios: trieniosEur,
    brutoMensual: Math.round(brutoMensual * 100) / 100,
    ss: Math.round(ss * 100) / 100,
    irpf: Math.round(irpfEur * 100) / 100,
    netoMensual: Math.round(netoMensual * 100) / 100,
    brutoAnual: Math.round(brutoMensual * PAGAS * 100) / 100,
    netoAnual: Math.round(netoMensual * PAGAS * 100) / 100,
    pagas: PAGAS,
  };
}
