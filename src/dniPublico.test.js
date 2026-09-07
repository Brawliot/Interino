import { describe, expect, it } from "vitest";
import {
  consultaPublicaDesdeEntrada,
  dniParcialParaGuardar,
  pareceNifCompleto,
} from "./utils/dniPublico.js";

describe("dniPublico", () => {
  it("detecta NIF completo", () => {
    expect(pareceNifCompleto("12345678Z")).toBe(true);
    expect(pareceNifCompleto("****1234Z")).toBe(false);
    expect(pareceNifCompleto("GARCÍA")).toBe(false);
  });

  it("enmascara NIF completo a forma pública", () => {
    expect(consultaPublicaDesdeEntrada("12345678Z")).toBe("****5678Z");
    expect(dniParcialParaGuardar("12345678Z")).toBe("****5678Z");
  });

  it("deja parcial y apellidos", () => {
    expect(consultaPublicaDesdeEntrada("****9885V")).toBe("****9885V");
    expect(consultaPublicaDesdeEntrada("9885V")).toBe("9885V");
    expect(consultaPublicaDesdeEntrada("GARCÍA LÓPEZ")).toBe("GARCÍA LÓPEZ");
    expect(dniParcialParaGuardar("GARCÍA LÓPEZ")).toBe("");
  });
});
