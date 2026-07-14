#!/usr/bin/env python3
"""Genera informe markdown de cobertura y estado CLM."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from cobertura_clm import admin_sin_pdf, contar_listados_manifest, educacion_huecos


def _leer_json(path: Path) -> dict | list | None:
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def generar_informe() -> str:
    lineas = [
        f"# Informe CLM — {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
    ]

    man_s = _leer_json(ROOT / "data/public/manifest.json")
    man_e = _leer_json(ROOT / "data/educacion/manifest.json")
    man_b = _leer_json(ROOT / "data/educacion-bolsa/manifest.json")
    man_a = _leer_json(ROOT / "data/admin-clm/manifest.json")

    lineas.extend(
        [
            "## Frescura (manifests locales)",
            "",
            f"- Sanidad: {man_s.get('generado') if isinstance(man_s, dict) else '—'} "
            f"({contar_listados_manifest(man_s) if man_s else 0} listados)",
            f"- Educacion disponibles: {man_e.get('generado') if isinstance(man_e, dict) else '—'} "
            f"({contar_listados_manifest(man_e) if man_e else 0})",
            f"- Educacion bolsa: {man_b.get('generado') if isinstance(man_b, dict) else '—'} "
            f"({contar_listados_manifest(man_b) if man_b else 0})",
            f"- Admin: {man_a.get('generado') if isinstance(man_a, dict) else '—'} "
            f"({contar_listados_manifest(man_a) if man_a else 0})",
            "",
        ]
    )

    edu = educacion_huecos()
    lineas.extend(
        [
            "## Educacion",
            "",
            f"- Catalogo: **{edu['catalogo']}** especialidades",
            f"- Disponibles en disco: **{edu['disponibles']}** "
            f"(faltan {len(edu['faltantes_disponibles'])} vs catalogo)",
            f"- Bolsa en disco: **{edu['bolsa']}** "
            f"(faltan {len(edu['faltantes_bolsa'])} vs catalogo)",
            "",
        ]
    )
    if edu["faltantes_disponibles"]:
        lineas.append("### Sin PDF disponibles (muestra)")
        for x in edu["faltantes_disponibles"][:15]:
            lineas.append(f"- {x['cuerpo']}: {x['especialidad']}")
        if len(edu["faltantes_disponibles"]) > 15:
            lineas.append(f"- … y {len(edu['faltantes_disponibles']) - 15} mas")
        lineas.append("")

    vigia = _leer_json(ROOT / "data/_local/vigia_estado.json")
    cambios = _leer_json(ROOT / "data/_local/vigia_cambios.json")
    if vigia or cambios:
        lineas.extend(["## Vigia", ""])
        if isinstance(cambios, dict) and cambios.get("cambios"):
            lineas.append(f"- Ultimos cambios detectados: **{len(cambios['cambios'])}**")
            for c in cambios["cambios"][:10]:
                lineas.append(f"  - `{c}`")
        else:
            lineas.append("- Sin cambios pendientes en vigia_cambios.json")
        lineas.append("")

    sin_pdf = admin_sin_pdf()
    lineas.extend(["## Admin sin PDF portal", ""])
    if sin_pdf:
        for b in sin_pdf:
            lineas.append(f"- {b['categoria']} ({b['colectivo']})")
    else:
        lineas.append("- Ninguna marcada con sin_pdf_portal")
    lineas.append("")

    lineas.extend(
        [
            "## Facultativo sanidad",
            "",
            "- Portal Drupal: categorias cargadas por JS (Cajon B). "
            "Ver `scripts/probe_facultativo_clm.py`.",
            "",
            "## Acciones sugeridas",
            "",
            "1. `python scripts/auditar_paridad_clm.py` — paridad local/R2",
            "2. Subir manifest bolsa si R2 desactualizado: "
            "`python scripts/subir_sectores_r2.py --sectores educacion-bolsa --skip-existing`",
            "",
        ]
    )
    return "\n".join(lineas)


def main() -> int:
    p = argparse.ArgumentParser(description="Informe semanal CLM")
    p.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Ruta de salida (default: stdout)",
    )
    args = p.parse_args()
    texto = generar_informe()
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(texto, encoding="utf-8")
        print(f"Informe escrito en {args.output}")
    else:
        print(texto)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
