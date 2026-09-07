import { describe, expect, it } from "vitest";
import {
  BETA_GRATIS,
  PLAN,
  limiteSeguimientos,
  puedeAnadirSeguimiento,
} from "./plan.js";

describe("plan (BETA_GRATIS)", () => {
  it("expone límite beta de seguimientos", () => {
    expect(BETA_GRATIS).toBe(true);
    expect(limiteSeguimientos()).toBe(PLAN.maxSeguimientos);
    expect(limiteSeguimientos()).toBe(50);
  });

  it("puedeAnadirSeguimiento respeta el tope", () => {
    expect(puedeAnadirSeguimiento(0)).toBe(true);
    expect(puedeAnadirSeguimiento(49)).toBe(true);
    expect(puedeAnadirSeguimiento(50)).toBe(false);
    expect(puedeAnadirSeguimiento(51)).toBe(false);
  });
});
