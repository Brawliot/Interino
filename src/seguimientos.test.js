import { describe, expect, it } from "vitest";
import { crearSeguimiento, normalizarSeguimiento } from "./seguimientos.js";

describe("normalizarSeguimiento", () => {
  it("devuelve null sin identidad", () => {
    expect(normalizarSeguimiento(null)).toBeNull();
    expect(normalizarSeguimiento({})).toBeNull();
    expect(normalizarSeguimiento({ candidato: { nombreCompleto: "" } })).toBeNull();
  });

  it("normaliza legado con candidato anidado", () => {
    const s = normalizarSeguimiento({
      id: "seg-1",
      categoria: "Enfermero/a",
      gerencia: "Albacete",
      ambito: "Atencion Primaria",
      ccaaId: "clm",
      candidato: {
        nombreCompleto: "Ana Pérez",
        dniParcial: "***1234",
        posicion: 12,
        puntos: 45.5,
        total: 200,
      },
    });
    expect(s).toMatchObject({
      id: "seg-1",
      categoria: "Enfermero/a",
      gerencia: "Albacete",
      ambito: "Atencion Primaria",
      ccaaId: "clm",
      sector: "sanidad",
      persona: { nombreCompleto: "Ana Pérez", dniParcial: "***1234" },
      snapshot: { posicion: 12, puntos: 45.5, total: 200 },
    });
    expect(s.candidato.nombreCompleto).toBe("Ana Pérez");
    expect(s.candidato.posicion).toBe(12);
  });

  it("infiere sector educación por categoría", () => {
    const s = normalizarSeguimiento({
      categoria: "Maestro/a Educación Infantil",
      gerencia: "Educación CLM",
      candidato: { nombreCompleto: "Luis Gómez" },
    });
    expect(s.sector).toBe("educacion");
  });
});

describe("crearSeguimiento", () => {
  it("crea seguimiento desde resultado", () => {
    const s = crearSeguimiento({
      categoria: "Enfermero/a",
      gerencia: "Toledo",
      ambito: "Atencion Especializada",
      grupoId: "diplomado",
      ccaaId: "clm",
      sector: "sanidad",
      resultado: {
        nombreCompleto: "María López",
        dniParcial: "***9876",
        posicion: 3,
        puntos: 52.1,
        total: 180,
      },
    });
    expect(s.persona.nombreCompleto).toBe("María López");
    expect(s.snapshot.posicion).toBe(3);
    expect(s.snapshot.puntos).toBe(52.1);
    expect(s.gerencia).toBe("Toledo");
    expect(s.grupoId).toBe("diplomado");
    expect(s.id).toBeTruthy();
  });
});
