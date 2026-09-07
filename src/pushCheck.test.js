import { describe, expect, it } from "vitest";
import {
  prefsNormalizadas,
  slugArchivo,
  textoAviso,
  tocaComprobar,
  urlsBusqueda,
} from "../functions/shared/pushCheck.js";

describe("pushCheck", () => {
  it("slugArchivo normaliza categoría", () => {
    expect(slugArchivo("ENFERMERO/A ESPECIALISTA EN SALUD MENTAL")).toBe(
      "enfermero-a-especialista-en-salud-mental",
    );
  });

  it("urlsBusqueda prioriza índice .busqueda", () => {
    const urls = urlsBusqueda("https://example.r2.dev/", {
      sector: "sanidad",
      grupoId: "diplomado",
      categoria: "ENFERMERO/A ESPECIALISTA EN SALUD MENTAL",
    });
    expect(urls[0]).toContain("diplomado/enfermero-a-especialista-en-salud-mental.busqueda.json");
  });

  it("textoAviso resume un cambio de posición", () => {
    const msg = textoAviso([
      {
        cambio: "bajo",
        anterior: { posicion: 10 },
        actual: { posicion: 12 },
        seguimiento: {
          categoria: "Enfermería",
          persona: { nombreCompleto: "PEREZ, ANA" },
        },
      },
    ]);
    expect(msg.title).toMatch(/seguimiento/i);
    expect(msg.body).toContain("#10");
    expect(msg.body).toContain("#12");
  });

  it("textoAviso avisa adjudicación", () => {
    const msg = textoAviso(
      [
        {
          cambio: "adjudicado",
          anterior: { posicion: 5 },
          actual: null,
          seguimiento: {
            categoria: "Enfermería",
            persona: { nombreCompleto: "LOPEZ, MARIA" },
          },
        },
      ],
      { avisosAdjudicacion: true, avisosPosicion: true },
    );
    expect(msg.tag).toMatch(/adjudicad/);
    expect(msg.body).toMatch(/LOPEZ/);
  });

  it("textoAviso respeta prefs (sin adjudicación)", () => {
    const msg = textoAviso(
      [{ cambio: "adjudicado", anterior: { posicion: 1 }, actual: null, seguimiento: {} }],
      { avisosAdjudicacion: false, avisosPosicion: true },
    );
    expect(msg).toBeNull();
  });

  it("tocaComprobar respeta frecuencia", () => {
    const ahora = Date.parse("2026-09-07T12:00:00Z");
    expect(tocaComprobar({ frecuencia: "diaria" }, null, ahora)).toBe(true);
    expect(tocaComprobar({ frecuencia: "diaria" }, "2026-09-07T08:00:00Z", ahora)).toBe(false);
    expect(tocaComprobar({ frecuencia: "diaria" }, "2026-09-06T10:00:00Z", ahora)).toBe(true);
    expect(tocaComprobar({ frecuencia: "semanal" }, "2026-09-05T12:00:00Z", ahora)).toBe(false);
    expect(tocaComprobar({ frecuencia: "semanal" }, "2026-08-30T12:00:00Z", ahora)).toBe(true);
    expect(prefsNormalizadas({ frecuencia: "rara" }).frecuencia).toBe("diaria");
  });
});
