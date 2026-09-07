import { describe, expect, it } from "vitest";
import {
  cursoDeFecha,
  opcionesDesdeIndex,
  resumirPorCurso,
  sectoresArchivePara,
  urlBaseArchive,
} from "./cursosHistoricos.js";

describe("cursosHistoricos", () => {
  it("cursoDeFecha usa julio como frontera", () => {
    expect(cursoDeFecha("2025-09-01")).toBe("2025/26");
    expect(cursoDeFecha("2026-06-30")).toBe("2025/26");
    expect(cursoDeFecha("2026-07-01")).toBe("2026/27");
  });

  it("opcionesDesdeIndex filtra por sector", () => {
    const index = {
      fechas: {
        "2026-09-07": { sectores: ["sanidad", "educacion-bolsa"], archivos: 2 },
        "2026-03-01": { sectores: ["murcia"], archivos: 1 },
      },
    };
    const clm = opcionesDesdeIndex(index, { sectorApp: "sanidad", ccaaId: "clm" });
    expect(clm).toHaveLength(1);
    expect(clm[0].fecha).toBe("2026-09-07");
    expect(clm[0].curso).toBe("2026/27");
  });

  it("resumirPorCurso deja la fecha más reciente", () => {
    const ops = [
      { fecha: "2025-09-01", curso: "2025/26", label: "a" },
      { fecha: "2026-01-10", curso: "2025/26", label: "b" },
      { fecha: "2026-09-01", curso: "2026/27", label: "c" },
    ];
    const r = resumirPorCurso(ops);
    expect(r).toHaveLength(2);
    expect(r.find((x) => x.curso === "2025/26").fecha).toBe("2026-01-10");
  });

  it("urlBaseArchive", () => {
    expect(urlBaseArchive("https://x.r2.dev/", "2026-09-07", "sanidad")).toBe(
      "https://x.r2.dev/archive/2026-09-07/",
    );
    expect(urlBaseArchive("https://x.r2.dev/", "2026-09-07", "murcia")).toBe(
      "https://x.r2.dev/archive/2026-09-07/murcia/",
    );
  });

  it("sectoresArchivePara", () => {
    expect(sectoresArchivePara("sanidad", "clm")).toEqual(["sanidad"]);
    expect(sectoresArchivePara("educacion", "clm")).toContain("educacion-bolsa");
  });
});
