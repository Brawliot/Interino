"""Refresca inventario y scrapea las 4 bolsas admin que faltaban."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scraper_admin_clm import (
    CATEGORIAS_PATH,
    ClienteAdminCLM,
    actualizar_manifest,
    parsear_pagina_bolsa,
    scrapear_categoria,
    inventario_a_dict,
)

FALTANTES = [
    "Recursos Fitogenéticos",
    "Ingeniería de Minas",
    "Escala Sociosanitaria. Enfermería",
    "Escala Sociosanitaria. Fisioterapia",
]


def main():
    inventario = json.loads(CATEGORIAS_PATH.read_text(encoding="utf-8"))
    cliente = ClienteAdminCLM()
    por_nombre = {c["categoria"]: c for c in inventario if c.get("categoria")}

    for nombre in FALTANTES:
        entry = por_nombre.get(nombre)
        if not entry:
            print(f"NO EN INVENTARIO: {nombre}")
            continue
        print(f"Refrescando inventario: {nombre}")
        html = cliente.get(entry["url_pagina"]).text
        parsed = parsear_pagina_bolsa(html, entry["colectivo"], entry["slug_pagina"])
        nuevo = inventario_a_dict(parsed)
        # conservar slug/url originales por si cambian
        nuevo["slug_pagina"] = entry["slug_pagina"]
        nuevo["url_pagina"] = entry["url_pagina"]
        idx = next(i for i, c in enumerate(inventario) if c.get("categoria") == nombre)
        inventario[idx] = nuevo
        print(f"  PDFs encontrados: {len(nuevo.get('pdfs') or [])}")

    CATEGORIAS_PATH.write_text(json.dumps(inventario, ensure_ascii=False, indent=2), encoding="utf-8")

    archivos_nuevos: list[str] = []
    for nombre in FALTANTES:
        entry = next(c for c in inventario if c.get("categoria") == nombre)
        res = scrapear_categoria(cliente, entry, presupuesto=900)
        archivos_nuevos.extend(res.get("archivos") or [])
        print(f"  Scrape {nombre}: {res.get('total_personas', 0)} pers., archivos={len(res.get('archivos') or [])}, error={res.get('error')}")

    actualizar_manifest(archivos_nuevos)
    print("\nHecho. Revisa data/admin-clm/manifest.json")


if __name__ == "__main__":
    main()
