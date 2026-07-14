#!/usr/bin/env python3
"""Estado local Murcia / Madrid para fase expansion."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MURCIA_DIR = ROOT / "data" / "public" / "murcia"
MURCIA_CAT = MURCIA_DIR / "categorias.json"
MADRID_CAT = ROOT / "data" / "public" / "madrid" / "categorias_sanidad.json"


def _listados_murcia() -> list[Path]:
    if not MURCIA_DIR.is_dir():
        return []
    return [p for p in MURCIA_DIR.glob("*.json") if p.name not in ("categorias.json", "manifest.json")]


def main() -> int:
    print("=== Region Murcia (SMS) ===")
    if MURCIA_CAT.is_file():
        cats = json.loads(MURCIA_CAT.read_text(encoding="utf-8"))
        sanidad = [c for c in cats if "sanitari" in (c.get("grupo") or "").lower()]
        print(f"  Categorias inventario: {len(cats)} (sanidad ~{len(sanidad)})")
    else:
        print("  Sin categorias.json — ejecuta: python scraper_murcia.py --inventario")
    listados = _listados_murcia()
    print(f"  Listados JSON locales: {len(listados)}")
    if listados:
        print(f"  Ejemplo: {listados[0].name}")
    print("  Subir a R2: python scripts/subir_sectores_r2.py --sectores murcia --skip-existing")

    print("\n=== Region Madrid (SERMAS) ===")
    if MADRID_CAT.is_file():
        inv = json.loads(MADRID_CAT.read_text(encoding="utf-8"))
        n = sum(len(g.get("categorias") or []) for g in inv.get("grupos") or [])
        print(f"  Inventario categorias: {n} (sin scraper aun)")
    else:
        print("  Sin inventario")
    print("  Subir metadatos: python scripts/subir_sectores_r2.py --sectores madrid --skip-existing")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
