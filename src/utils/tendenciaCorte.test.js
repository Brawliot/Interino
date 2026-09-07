import { describe, expect, it } from "vitest";
import { MIN_HISTORICO_TENDENCIA, zonaRiesgo } from "./tendenciaCorte.js";

describe("zonaRiesgo", () => {
  it("marca llamado si puntos superan el corte", () => {
    const historial = [{ puntos: 40 }, { puntos: 38 }, { puntos: 36 }];
    expect(zonaRiesgo(36, historial)).toEqual({ nivel: "llamado", convocatorias: 0, velocidad: null });
    expect(zonaRiesgo(40, historial).nivel).toBe("llamado");
  });

  it("sin_historico si hay menos publicaciones que el mínimo", () => {
    expect(MIN_HISTORICO_TENDENCIA).toBe(3);
    const historial = [{ puntos: 40 }, { puntos: 38 }];
    expect(zonaRiesgo(30, historial)).toEqual({
      nivel: "sin_historico",
      convocatorias: null,
      velocidad: null,
    });
  });

  it("estima alto/medio/bajo según ritmo de bajada", () => {
    // Baja 2 pts por convocatoria: distancia 3 → 2 convocatorias → alto
    const alto = [{ puntos: 46 }, { puntos: 44 }, { puntos: 42 }];
    expect(zonaRiesgo(39, alto)).toMatchObject({ nivel: "alto", convocatorias: 2 });

    // Distancia 8 / 2 = 4 → medio
    expect(zonaRiesgo(34, alto)).toMatchObject({ nivel: "medio", convocatorias: 4 });

    // Distancia 20 / 2 = 10 → bajo
    expect(zonaRiesgo(22, alto)).toMatchObject({ nivel: "bajo", convocatorias: 10 });
  });

  it("bajo si el corte no baja (velocidad ≤ 0)", () => {
    const plano = [{ puntos: 40 }, { puntos: 40 }, { puntos: 40 }];
    expect(zonaRiesgo(30, plano)).toMatchObject({ nivel: "bajo", convocatorias: null });
  });
});
