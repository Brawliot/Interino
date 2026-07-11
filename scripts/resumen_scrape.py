"""Resumen del estado del scrape por grupo (JSON locales en data/)."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scraper import DATA_DIR, slug_archivo

CATEGORIAS_JSON = os.path.join(DATA_DIR, "categorias_por_grupo.json")
GRUPOS = ("diplomado", "tecnico", "gestion", "licenciados")


def tamano_grupo(dir_grupo: str) -> tuple[int, int]:
    """Devuelve (num_json_listado, bytes_totales) sin contar *.busqueda.json."""
    if not os.path.isdir(dir_grupo):
        return 0, 0
    n = 0
    total = 0
    for nombre in os.listdir(dir_grupo):
        if not nombre.endswith(".json") or nombre.endswith(".busqueda.json"):
            continue
        path = os.path.join(dir_grupo, nombre)
        if os.path.isfile(path):
            n += 1
            total += os.path.getsize(path)
    return n, total


def fmt_mb(b: int) -> str:
    return f"{b / (1024 * 1024):.1f} MB"


def main():
    if not os.path.exists(CATEGORIAS_JSON):
        print(f"No existe {CATEGORIAS_JSON}")
        raise SystemExit(1)

    with open(CATEGORIAS_JSON, "r", encoding="utf-8") as f:
        inventario = json.load(f)

    total_ok = 0
    total_esperadas = 0
    total_bytes = 0

    print("=" * 60)
    print("RESUMEN SCRAPE — Interino")
    print("=" * 60)

    for grupo in GRUPOS:
        info = inventario.get(grupo, {})
        esperadas = info.get("categorias_pdf") or []
        dir_grupo = os.path.join(DATA_DIR, grupo)
        presentes = []
        faltan = []

        for cat in esperadas:
            slug = slug_archivo(cat) + ".json"
            path = os.path.join(dir_grupo, slug)
            if os.path.isfile(path):
                presentes.append(cat)
            else:
                faltan.append(cat)

        n_json, bytes_grupo = tamano_grupo(dir_grupo)
        total_ok += len(presentes)
        total_esperadas += len(esperadas)
        total_bytes += bytes_grupo

        print(f"\n## {grupo.upper()}")
        print(f"   Con JSON: {len(presentes)}/{len(esperadas)}")
        print(f"   Archivos en carpeta: {n_json} listados · {fmt_mb(bytes_grupo)}")
        if presentes:
            print("   OK:")
            for c in presentes:
                print(f"      · {c}")
        if faltan:
            print("   FALTAN:")
            for c in faltan:
                print(f"      · {c}")

    print("\n" + "=" * 60)
    print(f"GLOBAL: {total_ok}/{total_esperadas} categorías con JSON")
    print(f"Tamaño total listados (4 grupos): {fmt_mb(total_bytes)}")
    print("=" * 60)
    print("\nNota: *.busqueda.json no se cuentan aquí. Tras scrapear, ejecuta:")
    print("  python scripts/generar_indices_busqueda.py")
    print("Sube a R2: listados, indices, manifest.json y historico.json si cambió.")


if __name__ == "__main__":
    main()
