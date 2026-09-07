import { describe, expect, it } from "vitest";
import {
  filtrarFilasListado,
  posicionEnSubconjunto,
  filtrosDeModo,
} from "./utils/filtrosListado.js";
import { clasificarDelanteCurso } from "./utils/delanteCurso.js";

describe("filtrosListado", () => {
  const filas = [
    { pos: 1, nombreCompleto: "A", dniParcial: "****1111A", puntos: 100, grupoPreferente: true, tiposContrato: { "Larga TC.": true } },
    { pos: 2, nombreCompleto: "B", dniParcial: "****2222B", puntos: 90, grupoPreferente: false, tiposContrato: { "Larga TC.": true } },
    { pos: 3, nombreCompleto: "C", dniParcial: "****3333C", puntos: 80, grupoPreferente: false, tiposContrato: { "Larga TC.": false, "Corta TC.": false } },
    { pos: 4, nombreCompleto: "YO", dniParcial: "****9999Z", puntos: 70, grupoPreferente: false, tiposContrato: { "Larga TC.": true } },
  ];

  it("excluye preferentes", () => {
    const f = filtrarFilasListado(filas, filtrosDeModo("sin_preferentes"));
    expect(f).toHaveLength(3);
    expect(f.every((x) => !x.grupoPreferente)).toBe(true);
  });

  it("solo disponibles por contrato", () => {
    const f = filtrarFilasListado(filas, filtrosDeModo("solo_disponibles"));
    expect(f.map((x) => x.dniParcial)).not.toContain("****3333C");
    expect(f).toHaveLength(3);
  });

  it("recalcula posición sin preferentes", () => {
    const r = posicionEnSubconjunto(filas, { dniParcial: "****9999Z", nombreCompleto: "YO" }, {
      excluirPreferentes: true,
    });
    // Sin A (GP): B, C, YO → YO es 3º
    expect(r.posicion).toBe(3);
    expect(r.total).toBe(3);
  });
});

describe("delanteCurso", () => {
  it("clasifica ausentes y siguen delante", () => {
    const antes = [
      { pos: 1, nombreCompleto: "UNO", dniParcial: "****0001A", puntos: 99 },
      { pos: 2, nombreCompleto: "DOS", dniParcial: "****0002B", puntos: 88 },
      { pos: 3, nombreCompleto: "YO", dniParcial: "****9999Z", puntos: 50 },
    ];
    const ahora = [
      { pos: 1, nombreCompleto: "DOS", dniParcial: "****0002B", puntos: 88 },
      { pos: 2, nombreCompleto: "YO", dniParcial: "****9999Z", puntos: 50 },
    ];
    const r = clasificarDelanteCurso(antes, ahora, { posicion: 3, dniParcial: "****9999Z" });
    expect(r.ausentes).toHaveLength(1);
    expect(r.ausentes[0].dniParcial).toBe("****0001A");
    expect(r.siguen).toHaveLength(1);
    expect(r.siguen[0].dniParcial).toBe("****0002B");
  });
});
