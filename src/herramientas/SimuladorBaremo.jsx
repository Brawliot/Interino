import { useState, useMemo } from "react";
import { calcularBaremo, AVISO_BAREMO } from "./baremoReglas.js";
import { AvisoEstimacion, SeccionColapsable, CampoNumero, ResultadoCaja, BotonSecundario, FONT_BODY, FONT_MONO, FONT_DISPLAY } from "./shared.jsx";

export default function SimuladorBaremo({ C, Barra, onIrGerencia, atras }) {
  const [form, setForm] = useState({
    mesesAp: "",
    mesesAe: "",
    mesesOtrasCcaa: "",
    horasFormacion: "",
    doctorado: false,
    master: false,
    dea: false,
    especialistaUni: false,
    expertoUni: false,
    otrosMeritos: "",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const resultado = useMemo(() => calcularBaremo(form), [form]);

  return (
    <div>
      <Barra titulo="Simulador de baremo" atras={atras} />
      <AvisoEstimacion C={C}>{AVISO_BAREMO}</AvisoEstimacion>
      <div className="px-5 pb-4">
        <SeccionColapsable titulo="Experiencia profesional" C={C}>
          <CampoNumero label="Meses en Atención Primaria (SNS, misma categoría)" ayuda="0,1 pt/día trabajado (≈ 3 pt/mes con 30 días)." value={form.mesesAp} onChange={(v) => set("mesesAp", v)} C={C} />
          <CampoNumero label="Meses en Atención Especializada (SNS, misma categoría)" ayuda="0,1 pt/día trabajado en la categoría solicitada." value={form.mesesAe} onChange={(v) => set("mesesAe", v)} C={C} />
          <CampoNumero label="Meses en otras CCAA (misma categoría, SNS)" ayuda="0,1 pt/día en instituciones públicas del SNS/UE." value={form.mesesOtrasCcaa} onChange={(v) => set("mesesOtrasCcaa", v)} C={C} />
        </SeccionColapsable>

        <SeccionColapsable titulo="Formación académica" C={C} defaultOpen={false}>
          {[
            ["doctorado", "Grado de doctor (75 pt)"],
            ["master", "Máster universitario (25 pt)"],
            ["dea", "DEA / suficiencia investigadora (25 pt)"],
            ["especialistaUni", "Especialista universitario (15 pt)"],
            ["expertoUni", "Experto universitario (10 pt)"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 mt-2" style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.ink }}>
              <input type="checkbox" checked={form[key]} onChange={(e) => set(key, e.target.checked)} />
              {label}
            </label>
          ))}
        </SeccionColapsable>

        <SeccionColapsable titulo="Cursos y formación continuada" C={C} defaultOpen={false}>
          <CampoNumero label="Horas acreditadas" ayuda="0,1 pt/hora. Bloque inicial hasta 100 pt (1000 h). Máx. formación continuada: 200–300 pt según grupo." value={form.horasFormacion} onChange={(v) => set("horasFormacion", v)} C={C} />
        </SeccionColapsable>

        <SeccionColapsable titulo="Otros méritos" C={C} defaultOpen={false}>
          <CampoNumero label="Puntos adicionales (manual)" ayuda="Para méritos no modelados aquí. Consulta el apartado 11 del Pacto." value={form.otrosMeritos} onChange={(v) => set("otrosMeritos", v)} C={C} step={0.01} />
        </SeccionColapsable>

        <ResultadoCaja titulo="Puntuación estimada" C={C}>
          {resultado.secciones.filter((s) => s.puntos > 0).map((s) => (
            <p key={s.id} style={{ fontFamily: FONT_BODY, fontSize: 12.5, margin: "4px 0", color: "#E8E2D2" }}>
              {s.label}: <strong style={{ fontFamily: FONT_MONO }}>{s.puntos.toFixed(2)}</strong>
            </p>
          ))}
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 700, color: C.goldSoft, margin: "12px 0 0" }}>
            {resultado.total.toFixed(2)} <span style={{ fontSize: 14, fontWeight: 400 }}>puntos</span>
          </p>
        </ResultadoCaja>

        <BotonSecundario C={C} onClick={() => onIrGerencia(resultado.total)}>
          ¿Dónde quedarías con estos puntos?
        </BotonSecundario>
      </div>
    </div>
  );
}
