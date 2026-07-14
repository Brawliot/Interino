#!/usr/bin/env python3
"""
Ejecuta scrapers según data/_local/vigia_cambios.json (generado por vigia.py).

Formato de cambios:
  sanidad:{grupo}
  admin:{colectivo}/{slug_pagina}
  educacion:disponibles:{codigo_cuerpo}
  educacion:bolsa:{codigo_cuerpo}
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAMBIOS_PATH = ROOT / "data" / "_local" / "vigia_cambios.json"
ADMIN_CATEGORIAS = ROOT / "data" / "admin-clm" / "categorias.json"
VIGIA_ESTADO = ROOT / "data" / "_local" / "vigia_estado.json"


def _cargar_cambios() -> list[str]:
    if not CAMBIOS_PATH.exists():
        raise SystemExit(f"No existe {CAMBIOS_PATH} — ejecuta vigia.py antes")
    data = json.loads(CAMBIOS_PATH.read_text(encoding="utf-8"))
    cambios = data.get("cambios") or []
    if not cambios:
        raise SystemExit("vigia_cambios.json vacío")
    return cambios


def _run(cmd: list[str], presupuesto: int | None = None) -> None:
    if presupuesto:
        cmd = [*cmd, "--presupuesto", str(presupuesto)]
    print(f"\n>>> {' '.join(cmd)}")
    subprocess.run(cmd, cwd=ROOT, check=True)


def _catalogo_admin_por_clave() -> dict[str, dict]:
    if not ADMIN_CATEGORIAS.exists():
        return {}
    data = json.loads(ADMIN_CATEGORIAS.read_text(encoding="utf-8"))
    out = {}
    for entry in data:
        if entry.get("error"):
            continue
        slug = entry.get("slug_pagina")
        colectivo = entry.get("colectivo")
        if slug and colectivo:
            out[f"{colectivo}/{slug}"] = entry
    return out


def _actualizar_fechas_admin(claves: list[str]) -> None:
    """Sincroniza fecha_modificacion en categorias.json tras scrape admin."""
    if not ADMIN_CATEGORIAS.exists() or not VIGIA_ESTADO.exists():
        return
    try:
        estado = json.loads(VIGIA_ESTADO.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return
    admin = estado.get("admin_clm", {}).get("bolsas") or {}
    if not admin:
        return

    catalogo = json.loads(ADMIN_CATEGORIAS.read_text(encoding="utf-8"))
    claves_set = set(claves)
    actualizado = False
    for entry in catalogo:
        slug = entry.get("slug_pagina")
        colectivo = entry.get("colectivo")
        if not slug or not colectivo:
            continue
        clave = f"{colectivo}/{slug}"
        if clave not in claves_set:
            continue
        nueva = (admin.get(clave) or {}).get("fecha_modificacion")
        if nueva and entry.get("fecha_modificacion") != nueva:
            entry["fecha_modificacion"] = nueva
            actualizado = True

    if actualizado:
        ADMIN_CATEGORIAS.write_text(
            json.dumps(catalogo, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"Actualizado {ADMIN_CATEGORIAS} (fechas admin)")


def main() -> int:
    cambios = _cargar_cambios()
    admin_catalogo = _catalogo_admin_por_clave()
    admin_claves: list[str] = []
    sectores_r2: set[str] = set()

    for raw in cambios:
        if raw.startswith("sanidad:"):
            grupo = raw.split(":", 1)[1]
            _run([sys.executable, "scraper.py", "--grupo", grupo], presupuesto=7200)
            sectores_r2.add("sanidad")
            continue

        if raw.startswith("admin:"):
            clave = raw.split(":", 1)[1]
            entry = admin_catalogo.get(clave)
            if not entry:
                print(f"AVISO admin sin catálogo: {clave}")
                continue
            nombre = entry.get("categoria")
            if not nombre:
                continue
            admin_claves.append(clave)
            _run(
                [sys.executable, "scraper_admin_clm.py", "--categoria", nombre],
                presupuesto=3600,
            )
            sectores_r2.add("admin-clm")
            continue

        m = re.match(r"^educacion:(disponibles|bolsa):(\d{4})$", raw)
        if m:
            modo, codigo = m.group(1), m.group(2)
            if modo == "disponibles":
                _run(
                    [sys.executable, "scraper_educacion_clm.py", "--cuerpo", codigo],
                    presupuesto=3600,
                )
                sectores_r2.add("educacion")
            else:
                _run(
                    [
                        sys.executable,
                        "scraper_bolsa_ordinaria_educacion_clm.py",
                        "--bolsa-ordinaria",
                        "--cuerpo",
                        codigo,
                    ]
                )
                sectores_r2.add("educacion-bolsa")
            continue

        # Compatibilidad: grupo sanidad sin prefijo
        if raw in ("diplomado", "tecnico", "gestion", "licenciados"):
            _run([sys.executable, "scraper.py", "--grupo", raw], presupuesto=7200)
            sectores_r2.add("sanidad")
            continue

        print(f"AVISO cambio no reconocido: {raw}")

    if admin_claves:
        _actualizar_fechas_admin(admin_claves)

    if sectores_r2:
        out = ROOT / "data" / "_local" / "vigia_sectores_r2.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(
            json.dumps(
                {
                    "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
                    "sectores": sorted(sectores_r2),
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        print(f"Sectores para R2: {', '.join(sorted(sectores_r2))}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
