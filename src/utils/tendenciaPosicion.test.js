import { describe, expect, it } from "vitest";
import {
  MIN_PUNTOS_PREDICCION,
  analizarTendenciaPosicion,
  regresionLineal,
  textoDireccion,
  diasHastaPosicionObjetivo,
  situacionVsCorte,
} from "./tendenciaPosicion.js";

describe("tendenciaPosicion", () => {
  it("regresionLineal perfecta", () => {
    const { a, b, r2 } = regresionLineal([0, 1, 2], [10, 8, 6]);
    expect(b).toBeCloseTo(-2, 5);
    expect(a).toBeCloseTo(10, 5);
    expect(r2).toBeCloseTo(1, 5);
  });

  it("pocos datos", () => {
    const r = analizarTendenciaPosicion([
      { fecha: "2026-01-01", posicion: 10 },
      { fecha: "2026-02-01", posicion: 9 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.min).toBe(MIN_PUNTOS_PREDICCION);
  });

  it("detecta mejora y proyecta", () => {
    const r = analizarTendenciaPosicion([
      { fecha: "2026-01-01", posicion: 100 },
      { fecha: "2026-02-01", posicion: 90 },
      { fecha: "2026-03-01", posicion: 80 },
      { fecha: "actual", posicion: 70 },
    ]);
    expect(r.ok).toBe(true);
    expect(r.direccion).toBe("mejorando");
    expect(r.proyecciones[0].posicion).toBeLessThan(r.posicionActual);
    expect(textoDireccion(r).tipo).toBe("mejorando");
  });

  it("diasHastaPosicionObjetivo y situacionVsCorte", () => {
    const r = analizarTendenciaPosicion([
      { fecha: "2026-01-01", posicion: 100 },
      { fecha: "2026-02-01", posicion: 90 },
      { fecha: "2026-03-01", posicion: 80 },
      { fecha: "actual", posicion: 70 },
    ]);
    const h = diasHastaPosicionObjetivo(r, 50);
    expect(h.ok).toBe(true);
    expect(h.dias).toBeGreaterThan(0);
    expect(situacionVsCorte(80, 75).porEncima).toBe(true);
    expect(situacionVsCorte(70, 75).gap).toBe(-5);
  });
});
