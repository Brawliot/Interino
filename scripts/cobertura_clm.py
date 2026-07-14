"""Calculo de cobertura CLM (educacion, admin) — compartido por informe y tests."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CUERPO_SLUG = {
    "0597": "maestros",
    "0590": "secundaria",
    "0591": "tecnicos-fp",
    "0592": "eoii",
    "0593": "catedraticos-musica",
    "0594": "profesores-musica",
    "0595": "artes-plasticas",
    "0596": "maestros-taller",
    "0598": "fp-singulares",
}

METADATA = frozenset({"manifest.json", "categorias.json", "afinidad.json"})


def slug_archivo(texto: str) -> str:
    import unicodedata

    s = unicodedata.normalize("NFD", texto)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower().replace("/", "-")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def contar_listados_manifest(manifest: dict | None) -> int:
    archivos = (manifest or {}).get("archivos") or []
    return sum(
        1
        for a in archivos
        if a.endswith(".json")
        and not a.endswith(".busqueda.json")
        and a.split("/")[-1] not in METADATA
    )


def _rel(cuerpo_codigo: str, esp: str) -> str | None:
    g = CUERPO_SLUG.get(cuerpo_codigo)
    if not g:
        return None
    m = re.match(r"^(\d{3})\s+(.+)$", esp)
    if not m:
        return None
    return f"{g}/{slug_archivo(f'{m.group(1)}-{m.group(2)}')}.json"


def educacion_huecos(
    categorias_path: Path | None = None,
    man_d_path: Path | None = None,
    man_b_path: Path | None = None,
) -> dict:
    categorias_path = categorias_path or ROOT / "data/educacion/categorias.json"
    man_d_path = man_d_path or ROOT / "data/educacion/manifest.json"
    man_b_path = man_b_path or ROOT / "data/educacion-bolsa/manifest.json"

    cat = json.loads(categorias_path.read_text(encoding="utf-8"))
    man_d = set()
    man_b = set()
    if man_d_path.is_file():
        man_d = set(json.loads(man_d_path.read_text(encoding="utf-8")).get("archivos") or [])
    if man_b_path.is_file():
        man_b = set(json.loads(man_b_path.read_text(encoding="utf-8")).get("archivos") or [])

    sin_d, sin_b = [], []
    catalogo = 0
    for cuerpo in cat.get("cuerpos", []):
        cod = cuerpo["codigo"]
        for esp in cuerpo.get("especialidades", []):
            catalogo += 1
            rel = _rel(cod, esp)
            if not rel:
                continue
            item = {"cuerpo": cuerpo["nombre"], "especialidad": esp, "rel": rel}
            if rel not in man_d:
                sin_d.append(item)
            if rel not in man_b:
                sin_b.append(item)

    return {
        "catalogo": catalogo,
        "disponibles": contar_listados_manifest({"archivos": list(man_d)}),
        "bolsa": contar_listados_manifest({"archivos": list(man_b)}),
        "faltantes_disponibles": sin_d,
        "faltantes_bolsa": sin_b,
    }


def admin_sin_pdf(categorias_path: Path | None = None) -> list[dict]:
    categorias_path = categorias_path or ROOT / "data/admin-clm/categorias.json"
    if not categorias_path.is_file():
        return []
    data = json.loads(categorias_path.read_text(encoding="utf-8"))
    return [
        {
            "categoria": e.get("categoria"),
            "colectivo": e.get("colectivo"),
            "nota": e.get("nota_portal"),
            "url": e.get("url_pagina"),
        }
        for e in data
        if e.get("sin_pdf_portal")
    ]
