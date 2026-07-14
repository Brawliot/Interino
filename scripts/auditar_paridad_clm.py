#!/usr/bin/env python3
"""Audita huecos locales CLM y paridad básica con R2 público."""
from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
R2 = "https://pub-1d2aaf9854a14a9b98dac42c39874392.r2.dev"


def head_ok(url: str) -> bool:
    req = urllib.request.Request(url, method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status == 200
    except urllib.error.HTTPError as e:
        return e.code == 200
    except OSError:
        return False


def slug(n: str) -> str:
    s = n.lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def main() -> int:
    print("=== Educación local ===")
    sin_d, sin_b = [], []
    CUERPO = {
        "0597": "maestros", "0590": "secundaria", "0591": "tecnicos-fp", "0592": "eoii",
        "0593": "catedraticos-musica", "0594": "profesores-musica", "0595": "artes-plasticas",
        "0596": "maestros-taller", "0598": "fp-singulares",
    }
    edu = json.loads((ROOT / "data/educacion/categorias.json").read_text(encoding="utf-8"))
    man_d = set(json.loads((ROOT / "data/educacion/manifest.json").read_text())["archivos"])
    man_b = set(json.loads((ROOT / "data/educacion-bolsa/manifest.json").read_text())["archivos"])
    for c in edu["cuerpos"]:
        g = CUERPO.get(c["codigo"])
        if not g:
            continue
        for esp in c["especialidades"]:
            m = re.match(r"^(\d{3})\s+(.+)$", esp)
            if not m:
                continue
            rel = f"{g}/{m.group(1)}-{slug(m.group(2))}.json"
            if rel not in man_d:
                sin_d.append(rel)
            if rel not in man_b:
                sin_b.append(rel)
    print(f"Disponibles faltantes: {len(sin_d)}")
    print(f"Bolsa faltantes: {len(sin_b)}")
    print(f"afinidad.json local: {(ROOT / 'data/educacion/afinidad.json').is_file()}")

    print("\n=== R2 producción (HEAD) ===")
    claves = [
        "educacion/manifest.json",
        "educacion/afinidad.json",
        "educacion-bolsa/manifest.json",
        "admin-clm/manifest.json",
        "manifest.json",
    ]
    for k in claves:
        ok = head_ok(f"{R2}/{k}")
        print(f"  {'OK' if ok else 'FALTA'} {k}")

    if sin_d[:3]:
        for rel in sin_d[:3]:
            ok = head_ok(f"{R2}/educacion/{rel}")
            print(f"  muestra disponibles {rel}: {'OK' if ok else 'FALTA'}")

    print("\n=== Admin sin PDF en catálogo ===")
    admin = json.loads((ROOT / "data/admin-clm/categorias.json").read_text(encoding="utf-8"))
    for e in admin:
        if not e.get("pdfs"):
            print(f"  {e.get('categoria')} ({e.get('colectivo')})")

    print("\n=== Facultativo sanidad ===")
    cats = json.loads((ROOT / "data/public/categorias_por_grupo.json").read_text(encoding="utf-8"))
    fac = cats.get("facultativo", {})
    print(f"  categorias_pdf: {len(fac.get('categorias_pdf') or [])}")
    print(f"  nota: {fac.get('nota')}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
