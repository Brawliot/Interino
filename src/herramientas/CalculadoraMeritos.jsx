import { useState, useMemo } from "react";
import { puntosMeritoIncremental, AVISO_BAREMO } from "./baremoReglas.js";
import { AvisoEstimacion, CampoNumero, SelectCampo, ResultadoCaja, BotonSecundario, FONT_BODY, FONT_MONO, FONT_DISPLAY } from "./shared.jsx";

const TIPOS_MERITO = [
  { value: "curso", label: "Curso acreditado (horas)" },
  { value: "experiencia", label: "Experiencia profesional (meses SNS)" },
  { value: "master", label: "Máster universitario (+25 pt)" },
  { value: "doctorado", label: "Doctorado (+75 pt)" },
  { value: "especialista", label: "Especialista universitario (+15 pt)" },
  { value: "experto", label: "Experto universitario (+10 pt)" },
];

export default function CalculadoraMeritos({ C, Barra, puntosIniciales, onIrGerencia, atras }) {
  const [actual, setActual] = useState(puntosIniciales != null ? String(puntosIniciales) : "");
  const [tipo, setTipo] = useState("curso");
  const [detalle, setDetalle] = useState("");

  const actualNum = Number(actual) || 0;
  const incremento = useMemo(() => puntosMeritoIncremental(tipo, detalle), [tipo, detalle]);
  const nuevo = Math.round((actualNum + incremento) * 100) / 100;

  const necesitaDetalle = tipo === "curso" || tipo === "experiencia";

  return (
    <div>
      <Barra titulo="Calculadora de méritos" atras={atras} />
      <AvisoEstimacion C={C}>{AVISO_BAREMO}</AvisoEstimacion>
      <div className="px-5 pb-4">
        <CampoNumero label="Tu puntuación actual en la bolsa" value={actual} onChange={setActual} C={C} step={0.01} />

        <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.inkSoft, marginTop: 20, marginBottom: 4 }}>Añadir mérito</p>
        <SelectCampo label="Tipo de mérito" value={tipo} onChange={setTipo} C={C} opciones={TIPOS_MERITO} />
        {necesitaDetalle && (
          <CampoNumero
            label={tipo === "curso" ? "Horas del curso acreditado" : "Meses de experiencia (SNS, misma categoría)"}
            ayuda={tipo === "curso" ? "0,1 pt por hora acreditada." : "0,1 pt/día (≈ 3 pt/mes)."}
            value={detalle}
            onChange={setDetalle}
            C={C}
            step={tipo === "curso" ? 1 : 0.5}
          />
        )}

        <ResultadoCaja titulo="Impacto en tu baremo" C={C}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: "#E8E2D2", margin: 0 }}>
            <strong style={{ fontFamily: FONT_MONO, color: C.goldSoft }}>+{incremento.toFixed(2)}</strong> puntos por este mérito.
          </p>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: C.goldSoft, marginTop: 10 }}>
            {actualNum.toFixed(2)} → {nuevo.toFixed(2)} puntos
          </p>
        </ResultadoCaja>

        <BotonSecundario C={C} onClick={() => onIrGerencia(nuevo)} disabled={nuevo <= 0}>
          ¿Dónde quedarías?
        </BotonSecundario>
      </div>
    </div>
  );
}
