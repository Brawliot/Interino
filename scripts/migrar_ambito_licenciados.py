#!/usr/bin/env python3
"""
Migra listados de licenciados mal etiquetados como Atencion Primaria → Atencion Especializada.

Solo afecta categorías que deben ser AE (FEA, inspectores, urgencias hospitalarias, etc.).
No re-descarga PDFs; renombra ambito en bloques y filas.

Uso: python scripts/migrar_ambito_licenciados.py [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scraper import (  # noqa: E402
    AE,
    AP,
    DATA_DIR,
    categoria_debe_ser_ambito_especializada,
    clave_listado,
    guardar_indice_busqueda,
    path_categoria_json,
)

_JSON_INVENTARIO = frozenset({"categorias.json", "categorias_sanidad.json", "manifest.json"})


def migrar_archivo(path: Path, dry_run: bool) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    categoria = data.get("categoria") or path.stem
    if not categoria_debe_ser_ambito_especializada(categoria):
        return {"archivo": str(path), "categoria": categoria, "pares_migrados": 0, "omitido": "no_ae"}

    listados = data.get("listados") or []
    pares_migrados = 0
    filas_migradas = 0
    por_clave: dict[tuple[str, str], dict] = {}

    for bloque in listados:
        g = bloque.get("gerencia", "")
        a = bloque.get("ambito", "")
        if a == AP:
            nueva_clave = clave_listado(g, AE)
            bloque_nuevo = {
                **bloque,
                "ambito": AE,
                "filas": [],
            }
            for fila in bloque.get("filas") or []:
                fila_m = {**fila, "ambito": AE}
                bloque_nuevo["filas"].append(fila_m)
                filas_migradas += 1
            if nueva_clave in por_clave:
                por_clave[nueva_clave]["filas"].extend(bloque_nuevo["filas"])
            else:
                por_clave[nueva_clave] = bloque_nuevo
            pares_migrados += 1
        else:
            clave = clave_listado(g, a)
            if clave in por_clave:
                por_clave[clave]["filas"].extend(bloque.get("filas") or [])
            else:
                por_clave[clave] = bloque

    if pares_migrados == 0:
        return {"archivo": str(path), "categoria": categoria, "pares_migrados": 0}

    data["listados"] = list(por_clave.values())
    data["generado"] = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

    if not dry_run:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        guardar_indice_busqueda("licenciados", categoria, data["listados"])

    return {
        "archivo": str(path),
        "categoria": categoria,
        "pares_migrados": pares_migrados,
        "filas_migradas": filas_migradas,
        "listados_finales": len(data["listados"]),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrar ámbito AP→AE en licenciados")
    parser.add_argument("--dry-run", action="store_true", help="Solo informe, sin escribir")
    args = parser.parse_args()

    dir_lic = Path(DATA_DIR) / "licenciados"
    if not dir_lic.is_dir():
        print(f"No existe {dir_lic}")
        sys.exit(1)

    total_pares = 0
    total_filas = 0
    archivos_tocados = 0
    detalle = []

    for nombre in sorted(dir_lic.iterdir()):
        if nombre.suffix != ".json" or nombre.name.endswith(".busqueda.json"):
            continue
        if nombre.name in _JSON_INVENTARIO:
            continue
        res = migrar_archivo(nombre, args.dry_run)
        if res.get("pares_migrados"):
            archivos_tocados += 1
            total_pares += res["pares_migrados"]
            total_filas += res.get("filas_migradas", 0)
            detalle.append(res)

    modo = "DRY-RUN" if args.dry_run else "APLICADO"
    print(f"=== MIGRACIÓN ÁMBITO LICENCIADOS ({modo}) ===")
    print(f"Archivos tocados: {archivos_tocados}")
    print(f"Pares gerencia+ambito migrados (AP->AE): {total_pares}")
    print(f"Filas actualizadas: {total_filas}")
    for d in detalle:
        print(f"  {d['pares_migrados']:3} pares | {d['categoria']}")


if __name__ == "__main__":
    main()
