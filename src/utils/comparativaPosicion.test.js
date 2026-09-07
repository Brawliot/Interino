import { describe, expect, it } from "vitest";
import { deltaPosicion, normalizarSerieEvolucion, textoDelta } from "./comparativaPosicion.js";

describe("comparativaPosicion", () => {
  it("delta: subir en ranking (número de puesto baja)", () => {
    expect(deltaPosicion(10, 7)).toBe(-3);
    expect(textoDelta(-3).tipo).toBe("subio");
  });

  it("delta: bajar o igual", () => {
    expect(deltaPosicion(5, 8)).toBe(3);
    expect(textoDelta(3).tipo).toBe("bajo");
    expect(deltaPosicion(4, 4)).toBe(0);
    expect(textoDelta(0).tipo).toBe("igual");
  });

  it("delta inválido", () => {
    expect(deltaPosicion(0, 5)).toBe(null);
    expect(textoDelta(null)).toBe(null);
  });

  it("normalizarSerieEvolucion ordena y deja actual al final", () => {
    const s = normalizarSerieEvolucion([
      { fecha: "actual", posicion: 5 },
      { fecha: "2026-09-01", posicion: 8 },
      { fecha: "2026-08-01", posicion: 0 },
      { fecha: "2026-07-01", posicion: 10 },
    ]);
    expect(s.map((p) => p.fecha)).toEqual(["2026-07-01", "2026-09-01", "actual"]);
  });
});
