import { useState, useMemo } from "react";
import { CATEGORIAS_NOMINA, TIPOS_CONTRATO, TRAMOS_IRPF, calcularNomina, AVISO_NOMINA, ANIO_TABLAS } from "./nominaTablas.js";
import { AvisoEstimacion, SelectCampo, CampoNumero, ResultadoCaja, FONT_BODY, FONT_MONO } from "./shared.jsx";

export default function CalculadoraNomina({ C, Barra, atras }) {
  const [categoriaId, setCategoriaId] = useState(CATEGORIAS_NOMINA[0].id);
  const [tipoContrato, setTipoContrato] = useState("larga-tc");
  const [tramoIrpf, setTramoIrpf] = useState("medio");
  const [trienios, setTrienios] = useState("0");

  const resultado = useMemo(
    () => calcularNomina({ categoriaId, tipoContrato, tramoIrpf, trienios: Number(trienios) || 0 }),
    [categoriaId, tipoContrato, tramoIrpf, trienios]
  );

  const fila = (label, valor) => (
    <div className="flex justify-between" style={{ marginTop: 6 }}>
      <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: "#E8E2D2" }}>{label}</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.goldSoft }}>{valor.toFixed(2)} €</span>
    </div>
  );

  return (
    <div>
      <Barra titulo="Calculadora de nómina" atras={atras} />
      <AvisoEstimacion C={C}>{AVISO_NOMINA}</AvisoEstimacion>
      <div className="px-5 pb-4">
        <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, marginBottom: 4 }}>
          Tablas salariales de {ANIO_TABLAS} · {resultado.pagas} pagas al año
        </p>

        <SelectCampo label="Categoría profesional" value={categoriaId} onChange={setCategoriaId} C={C}
          opciones={CATEGORIAS_NOMINA.map((c) => ({ value: c.id, label: c.label }))} />
        <SelectCampo label="Tipo de contrato" value={tipoContrato} onChange={setTipoContrato} C={C}
          opciones={TIPOS_CONTRATO.map((t) => ({ value: t.id, label: t.label }))} />
        <SelectCampo label="Situación fiscal (IRPF estimado)" value={tramoIrpf} onChange={setTramoIrpf} C={C}
          opciones={TRAMOS_IRPF.map((t) => ({ value: t.id, label: t.label }))} />
        <CampoNumero label="Trienios" ayuda="Complemento de antigüedad (~41,85 €/trienio en tablas 2025)." value={trienios} onChange={setTrienios} C={C} min={0} />

        <ResultadoCaja titulo="Desglose mensual" C={C}>
          {fila("Sueldo base", resultado.sueldoBase)}
          {fila("Complemento de destino", resultado.destino)}
          {fila("Complemento específico", resultado.especifico)}
          {resultado.trienios > 0 && fila("Trienios", resultado.trienios)}
          <div style={{ borderTop: `1px solid ${C.gold}44`, marginTop: 10, paddingTop: 8 }}>
            {fila("Bruto mensual", resultado.brutoMensual)}
            {fila("Seg. Social (6,35%)", -resultado.ss)}
            {fila("IRPF estimado", -resultado.irpf)}
            <div className="flex justify-between" style={{ marginTop: 10 }}>
              <span style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 700, color: "#fff" }}>Neto mensual estimado</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 16, fontWeight: 700, color: C.goldSoft }}>{resultado.netoMensual.toFixed(2)} €</span>
            </div>
          </div>
        </ResultadoCaja>

        <div style={{ marginTop: 12, padding: 14, background: C.card, border: `1px solid ${C.line}`, borderRadius: "10px 20px 10px 20px" }}>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.ink, margin: 0 }}>
            Anual ({resultado.pagas} pagas): <strong>{resultado.brutoAnual.toFixed(2)} €</strong> bruto ·{" "}
            <strong>{resultado.netoAnual.toFixed(2)} €</strong> neto estimado
          </p>
        </div>
      </div>
    </div>
  );
}
