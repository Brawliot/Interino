import { describe, expect, it } from "vitest";
import { claveSeguimiento, fusionarSeguimientos } from "./auth.js";

describe("fusionarSeguimientos", () => {
  it("une local y remoto por identidad", () => {
    const local = [
      {
        id: "a",
        ccaaId: "clm",
        sector: "sanidad",
        categoria: "Enfermero/a",
        gerencia: "Toledo",
        ambito: "",
        persona: { nombreCompleto: "Ana Pérez", dniParcial: "***1234*" },
        snapshot: { posicion: 10, puntos: 20, actualizadoEn: "2026-01-01T00:00:00.000Z" },
      },
    ];
    const remoto = [
      {
        id: "b",
        ccaaId: "clm",
        sector: "sanidad",
        categoria: "Enfermero/a",
        gerencia: "Toledo",
        ambito: "",
        persona: { nombreCompleto: "Ana Pérez", dniParcial: "***1234*" },
        snapshot: { posicion: 8, puntos: 21, actualizadoEn: "2026-02-01T00:00:00.000Z" },
      },
      {
        id: "c",
        ccaaId: "clm",
        sector: "sanidad",
        categoria: "TCAE",
        gerencia: "Albacete",
        ambito: "",
        persona: { nombreCompleto: "Luis Gómez", dniParcial: "***9999*" },
        snapshot: { posicion: 3, puntos: 15, actualizadoEn: "2026-01-15T00:00:00.000Z" },
      },
    ];
    const out = fusionarSeguimientos(local, remoto);
    expect(out).toHaveLength(2);
    const ana = out.find((s) => s.persona.nombreCompleto === "Ana Pérez");
    expect(ana.snapshot.posicion).toBe(8);
    expect(claveSeguimiento(local[0])).toBe(claveSeguimiento(remoto[0]));
  });
});
