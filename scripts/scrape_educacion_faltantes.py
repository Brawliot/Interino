"""Scrapea especialidades educación CLM faltantes (disponibles y/o bolsa ordinaria)."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scraper_educacion_clm import slug_especialidad, CUERPO_SLUG, slug_texto

DATA = ROOT / "data"


def _manifest(path: Path) -> set[str]:
    if not path.is_file():
        return set()
    return set(json.loads(path.read_text(encoding="utf-8")).get("archivos") or [])


def _rel(cuerpo_codigo: str, esp: str) -> str:
    code, _, name = esp.partition(" ")
    cs = CUERPO_SLUG.get(cuerpo_codigo, slug_texto(name))
    return f"{cs}/{slug_especialidad(code, name)}.json"


def faltantes() -> tuple[list[dict], list[dict]]:
    cat = json.loads((DATA / "educacion/categorias.json").read_text(encoding="utf-8"))
    man_d = _manifest(DATA / "educacion/manifest.json")
    man_b = _manifest(DATA / "educacion-bolsa/manifest.json")
    sin_d, sin_b = [], []
    for cuerpo in cat.get("cuerpos", []):
        cod = cuerpo["codigo"]
        for esp in cuerpo.get("especialidades", []):
            rel = _rel(cod, esp)
            item = {"cuerpo": cod, "especialidad": esp, "rel": rel}
            if rel not in man_d:
                sin_d.append(item)
            if rel not in man_b:
                sin_b.append(item)
    return sin_d, sin_b


def cuerpos_de(items: list[dict]) -> list[str]:
    return sorted({x["cuerpo"] for x in items})


def main() -> int:
    sin_d, sin_b = faltantes()
    print("=== Faltantes disponibles:", len(sin_d))
    for x in sin_d:
        print(f"  {x['cuerpo']} {x['especialidad']}")
    print("=== Faltantes bolsa ordinaria:", len(sin_b))
    for x in sin_b:
        print(f"  {x['cuerpo']} {x['especialidad']}")

    cuerpos_d = cuerpos_de(sin_d)
    cuerpos_b = cuerpos_de(sin_b)
    if not cuerpos_d and not cuerpos_b:
        print("\nNada que scrapear.")
        return 0

    for codigo in cuerpos_d:
        print(f"\n>>> Disponibles — cuerpo {codigo}")
        subprocess.run(
            [sys.executable, str(ROOT / "scraper_educacion_clm.py"), "--cuerpo", codigo, "--presupuesto", "900"],
            cwd=ROOT,
            check=False,
        )

    for codigo in cuerpos_b:
        print(f"\n>>> Bolsa ordinaria — cuerpo {codigo}")
        subprocess.run(
            [
                sys.executable,
                str(ROOT / "scraper_bolsa_ordinaria_educacion_clm.py"),
                "--bolsa-ordinaria",
                "--cuerpo",
                codigo,
            ],
            cwd=ROOT,
            check=False,
        )

    sin_d2, sin_b2 = faltantes()
    print("\n=== Tras scrape ===")
    print("Disponibles faltantes:", len(sin_d2))
    for x in sin_d2:
        print(f"  {x['cuerpo']} {x['especialidad']}")
    print("Bolsa faltantes:", len(sin_b2))
    for x in sin_b2:
        print(f"  {x['cuerpo']} {x['especialidad']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
