import { describe, expect, it } from "vitest";
import {
  puntosEnPosicion,
  puntosParaPosicion,
  umbralesIntercambio,
  rankingAnonimo,
  percentilesPuntos,
  posicionEnFilas,
} from "./posicionLista.js";

const filas = [
  { pos: 1, puntos: 120 },
  { pos: 2, puntos: 100 },
  { pos: 3, puntos: 90 },
  { pos: 4, puntos: 80 },
  { pos: 5, puntos: 70 },
];

describe("posicionLista", () => {
  it("posicionEnFilas inserta por baremo", () => {
    expect(posicionEnFilas(filas, 95).posicion).toBe(3);
    expect(posicionEnFilas(filas, 120).posicion).toBe(1);
  });

  it("puntosEnPosicion y inversa", () => {
    expect(puntosEnPosicion(filas, 2).puntos).toBe(100);
    expect(puntosParaPosicion(filas, 100).ok).toBe(false);
    expect(puntosParaPosicion(filas, 3).puntosMinimos).toBe(90);
  });

  it("umbralesIntercambio #100/#500/#1000", () => {
    const u = umbralesIntercambio(filas);
    expect(u).toHaveLength(3);
    expect(u[0].ok).toBe(false);
    expect(u[0].motivo).toBe("fuera_rango");
  });

  it("ranking anónimo y percentiles", () => {
    const r = rankingAnonimo(filas, 95);
    expect(r.posicion).toBe(3);
    expect(r.delante).toBe(2);
    const p = percentilesPuntos(filas, [0.5]);
    expect(p[0].puntos).toBe(90);
  });
});
