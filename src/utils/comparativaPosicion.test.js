import { describe, expect, it } from "vitest";
import { deltaPosicion, textoDelta } from "./comparativaPosicion.js";

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
});
