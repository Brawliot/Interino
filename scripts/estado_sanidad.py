#!/usr/bin/env python3
"""
Estado de completitud de datos scrapeados — Sanidad CLM (SESCAM).

Compara JSON en data/public/{grupo}/ contra categorías del inventario y
pares gerencia+ámbito esperados según GERENCIAS del scraper (sin consultar portal).

Uso: python scripts/estado_sanidad.py
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scraper import (  # noqa: E402
    AMBITOS,
    GERENCIAS,
    _normalizar_clave,
    cargar_categorias_desde_inventario,
    claves_listados,
    path_categoria_json,
)

GRUPOS = (
    ("diplomado", "DIPLOMADO"),
    ("tecnico", "TÉCNICO"),
    ("gestion", "GESTIÓN"),
    ("licenciados", "LICENCIADOS"),
)


def pares_esperados_referencia() -> set[tuple[str, str]]:
    """Pares gerencia+ámbito esperables según la lista fija GERENCIAS del scraper."""
    pares: set[tuple[str, str]] = set()
    for gerencia in GERENCIAS:
        clave = _normalizar_clave(gerencia)
        if "Integrada" in gerencia:
            for ambito in AMBITOS:
                pares.add((clave, ambito))
        elif "Primaria de Toledo" in gerencia:
            pares.add((clave, "Atencion Primaria"))
        elif "Especializada de Toledo" in gerencia:
            pares.add((clave, "Atencion Especializada"))
        elif "Paraplejicos" in gerencia:
            pares.add((clave, "Atencion Especializada"))
        else:
            for ambito in AMBITOS:
                pares.add((clave, ambito))
    return pares


def cargar_listados(path: str) -> list[dict]:
    import json

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        return data.get("listados") or []
    return []


@dataclass
class ResumenGrupo:
    grupo: str
    etiqueta: str
    categorias_esperadas: int
    categorias_con_json: int
    categorias_completas: int
    categorias_incompletas: int
    pares_faltantes: int


def auditar_grupo(grupo: str, etiqueta: str, categorias: list[str], esperados: set[tuple[str, str]]) -> ResumenGrupo:
    con_json = 0
    completas = 0
    incompletas = 0
    pares_faltantes = 0

    for categoria in categorias:
        path = path_categoria_json(grupo, categoria)
        if not os.path.isfile(path):
            continue
        con_json += 1
        claves = claves_listados(cargar_listados(path))
        faltan = esperados - claves
        if faltan:
            incompletas += 1
            pares_faltantes += len(faltan)
        else:
            completas += 1

    return ResumenGrupo(
        grupo=grupo,
        etiqueta=etiqueta,
        categorias_esperadas=len(categorias),
        categorias_con_json=con_json,
        categorias_completas=completas,
        categorias_incompletas=incompletas,
        pares_faltantes=pares_faltantes,
    )


def pct(num: int, den: int) -> int:
    if den <= 0:
        return 0
    return round(num * 100 / den)


def icono_categorias(con: int, total: int) -> str:
    return "✅" if total > 0 and con == total else ""


def sugerir_completar(resumenes: list[ResumenGrupo]) -> str:
    candidatos = [r for r in resumenes if r.categorias_incompletas > 0]
    if not candidatos:
        return "python scraper.py --completar-gerencias"
    peor = max(candidatos, key=lambda r: (r.pares_faltantes, r.categorias_incompletas))
    return f"python scraper.py --grupo {peor.grupo} --completar-gerencias"


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    inventario = cargar_categorias_desde_inventario()
    esperados = pares_esperados_referencia()
    resumenes: list[ResumenGrupo] = []

    print("=== SANIDAD CLM — ESTADO DE COMPLETITUD ===\n")

    for grupo, etiqueta in GRUPOS:
        categorias = inventario.get(grupo, [])
        res = auditar_grupo(grupo, etiqueta, categorias, esperados)
        resumenes.append(res)

        pct_cat = pct(res.categorias_con_json, res.categorias_esperadas)
        marca = icono_categorias(res.categorias_con_json, res.categorias_esperadas)
        marca_txt = f"  {marca} {pct_cat}%" if marca else f"  {pct_cat}%"

        print(f"{etiqueta + ':':<13}{res.categorias_con_json}/{res.categorias_esperadas} categorías con JSON{marca_txt}")
        print(
            f"  Gerencias por categoría: {res.categorias_completas}/{res.categorias_con_json} completas "
            f"({res.categorias_incompletas} con pares faltantes)\n"
        )

    total_esperadas = sum(r.categorias_esperadas for r in resumenes)
    total_json = sum(r.categorias_con_json for r in resumenes)
    total_completas = sum(r.categorias_completas for r in resumenes)
    total_incompletas = sum(r.categorias_incompletas for r in resumenes)
    total_pares_faltantes = sum(r.pares_faltantes for r in resumenes)

    print(f"TOTAL CATEGORÍAS: {total_json}/{total_esperadas} ({pct(total_json, total_esperadas)}%)")
    print(
        f"TOTAL GERENCIAS COMPLETAS: {total_completas}/{total_json} "
        f"({pct(total_completas, total_json)}%)  ← esto es lo que falta\n"
    )
    print(f"Pares gerencia+ámbito faltantes: {total_pares_faltantes}")
    print(f"Para completar: {sugerir_completar(resumenes)}")


if __name__ == "__main__":
    main()
