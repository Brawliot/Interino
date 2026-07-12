"""Regenera *.busqueda.json desde los JSON de categoría ya scrapeados."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scraper import DATA_DIR, actualizar_manifest, guardar_indice_busqueda, path_categoria_json, slug_archivo

import json


def main():
    n = 0
    for grupo in sorted(os.listdir(DATA_DIR)):
        dir_grupo = os.path.join(DATA_DIR, grupo)
        if not os.path.isdir(dir_grupo):
            continue
        for nombre in sorted(os.listdir(dir_grupo)):
            if not nombre.endswith(".json") or nombre.endswith(".busqueda.json"):
                continue
            path = os.path.join(dir_grupo, nombre)
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                continue
            listados = data.get("listados") or []
            categoria = data.get("categoria") or nombre.replace(".json", "")
            if not listados:
                continue
            guardar_indice_busqueda(grupo, categoria, listados)
            n += 1
    actualizar_manifest()
    print(f"Indices generados: {n}")


if __name__ == "__main__":
    main()
