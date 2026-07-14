"""Scrapea cuerpos educación CLM con especialidades faltantes."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scraper_educacion_clm import slug_especialidad, CUERPO_SLUG, slug_texto

DATA = ROOT / "data"
CUERPOS_FALTANTES = sorted({"0592", "0593", "0594", "0595", "0596"})


def faltantes_actuales() -> list[dict]:
    cat = json.loads((DATA / "educacion/categorias.json").read_text(encoding="utf-8"))
    m1 = set(json.loads((DATA / "educacion/manifest.json").read_text(encoding="utf-8"))["archivos"])
    m2 = set(json.loads((DATA / "educacion-bolsa/manifest.json").read_text(encoding="utf-8"))["archivos"])
    union = m1 | m2
    out = []
    for cuerpo in cat["cuerpos"]:
        cs = CUERPO_SLUG.get(cuerpo["codigo"], slug_texto(cuerpo["nombre"]))
        for esp in cuerpo["especialidades"]:
            code, _, name = esp.partition(" ")
            rel = f"{cs}/{slug_especialidad(code, name)}.json"
            if rel not in union:
                out.append({"cuerpo": cuerpo["codigo"], "especialidad": esp, "rel": rel})
    return out


def main():
    print("=== Antes ===")
    antes = faltantes_actuales()
    print(f"Faltantes: {len(antes)}")
    for f in antes:
        print(f"  {f['cuerpo']} {f['especialidad']}")

    for codigo in CUERPOS_FALTANTES:
        print(f"\n>>> Disponibles — cuerpo {codigo}")
        subprocess.run(
            [sys.executable, str(ROOT / "scraper_educacion_clm.py"), "--cuerpo", codigo, "--presupuesto", "900"],
            cwd=ROOT,
            check=False,
        )
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

    print("\n=== Después ===")
    despues = faltantes_actuales()
    print(f"Faltantes: {len(despues)}")
    for f in despues:
        print(f"  {f['cuerpo']} {f['especialidad']} -> {f['rel']}")


if __name__ == "__main__":
    main()
