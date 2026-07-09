"""Inventario de categorías reales desde páginas de baremos SESCAM."""
import json
import re
from html import unescape
from pathlib import Path

import requests

GRUPOS_PORTAL = {
    "diplomado": "personal-sanitario-diplomado",
    "facultativo": "personal-facultativo",
    "licenciados": "personal-sanitario-licenciados",
    "tecnico": "personal-sanitario-tecnico",
    "gestion": "personal-de-gestion-y-servicios",
}

BASE = (
    "https://sanidad.castillalamancha.es/profesionales/atencion-al-profesional/"
    "bolsas-constituidas/baremos/"
)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; ListasApp/0.1)"}
OUT = Path("data/categorias_por_grupo.json")


def extraer_opciones(html: str) -> list[str]:
    cats = []
    for m in re.finditer(r"<option[^>]*>(.*?)</option>", html, re.I | re.S):
        texto = re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", "", m.group(1)))).strip()
        if texto and "Seleccione" not in texto:
            cats.append(texto)
    seen = set()
    out = []
    for c in cats:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out


def normalizar_pdf(nombre: str) -> str:
    import unicodedata

    nfkd = unicodedata.normalize("NFKD", nombre)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).upper()


def main():
    resultado = {}
    for grupo, slug in GRUPOS_PORTAL.items():
        url = BASE + slug
        r = requests.get(url, headers=HEADERS, timeout=45)
        r.raise_for_status()
        cats = extraer_opciones(r.text)
        resultado[grupo] = {
            "slug_portal": slug,
            "url": url,
            "categorias_portal": cats,
            "categorias_pdf": [normalizar_pdf(c) for c in cats],
            "total": len(cats),
            "nota": None,
        }
        if len(cats) == 0:
            resultado[grupo]["nota"] = (
                "Dropdown vacío en HTML estático; categorías no disponibles sin JS/AJAX."
            )
        print(f"{grupo}: {len(cats)} categorías")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Guardado {OUT}")


if __name__ == "__main__":
    main()
