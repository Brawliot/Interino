"""
Scraper de bolsas del Servicio Murciano de Salud (SMS).

Fuente: murciasalud.es — listados HTML paginados (100 filas/página).
Sin gerencias ni ámbitos: una categoría = un listado regional.

Uso:
  python scraper_murcia.py --inventario
  python scraper_murcia.py --categoria "Logopeda" --presupuesto 3600
  python scraper_murcia.py --todas --presupuesto 3600
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import unicodedata
from datetime import datetime
from html import unescape
from urllib.parse import urljoin

import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_URL = "https://www.murciasalud.es/bolsas.php"
IDSEC = 39
DATA_DIR = os.path.join("data", "murcia")
CATEGORIAS_PATH = os.path.join(DATA_DIR, "categorias.json")
MANIFEST_PATH = os.path.join(DATA_DIR, "manifest.json")

USER_AGENT = "Interino-App/1.0 (contacto: fedebotija@gmail.com)"
REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "es-ES,es;q=0.9",
    "Cache-Control": "no-cache",
}

GERENCIA_MURCIA = "Region de Murcia"
PER_PAGE = 100
SLEEP_ENTRE_PAGINAS = 1.0

AMP = r"(?:&amp;|&)"
BOLSA_LINK_RE = rf'mostrar_bolsa{AMP}id_bolsa=(\d+){AMP}idsec=39["\']>\s*([^<]+?)\s*</a>'

ROW_RE = re.compile(
    r"<tr>\s*"
    r'<td headers="ap">\s*(.*?)\s*</td>\s*'
    r'<td headers="nif">\s*(.*?)\s*</td>\s*'
    r'<td headers="or">.*?(\d+)\s*</td>\s*'
    r'<td headers="pt">.*?([\d.,]+)\s*</td>\s*'
    r'<td headers="discapacidad">(.*?)</td>',
    re.S | re.I,
)

PAGINATION_RE = re.compile(
    r"Resultados del\s*<strong>\s*(\d+)\s*</strong>\s*al\s*"
    r"<strong>(\d+)</strong>\s*de\s*<strong>(\d+)</strong>",
    re.I,
)


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def slug_archivo(nombre: str) -> str:
    s = unicodedata.normalize("NFD", nombre)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower().replace("/", "-")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def normalizar_nombre(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip().lower()


def limpiar_texto(html_fragment: str) -> str:
    t = re.sub(r"<[^>]+>", " ", html_fragment)
    t = unescape(t)
    return re.sub(r"\s+", " ", t).strip()


def parse_puntuacion(raw: str) -> float:
    raw = raw.strip().replace(".", "").replace(",", ".")
    return float(raw)


def es_captcha(html: str) -> bool:
    return "Radware Captcha" in html or "hcaptcha.com" in html


def fetch(session: requests.Session, url: str) -> str:
    r = session.get(url, headers=REQUEST_HEADERS, timeout=90)
    r.raise_for_status()
    if es_captcha(r.text):
        raise RuntimeError(
            f"MurciaSalud devolvió captcha/antibot. URL: {url}. "
            "Prueba desde otra red o más tarde."
        )
    r.encoding = r.apparent_encoding or "utf-8"
    return unescape(r.text)


def url_listado(id_listado: int, pagina: int = 1) -> str:
    return (
        f"{BASE_URL}?op=mostrar_listado&id_listado={id_listado}"
        f"&idsec={IDSEC}&ordenar_por=orden&orden=ASC&pagina={pagina}"
    )


def url_bolsa(id_bolsa: int) -> str:
    return f"{BASE_URL}?op=mostrar_bolsa&id_bolsa={id_bolsa}&idsec={IDSEC}"


def url_categorias() -> str:
    return f"{BASE_URL}?op=mostrar_categorias&idsec={IDSEC}"


def url_especialidades() -> str:
    return f"{BASE_URL}?op=mostrar_especialidades&id_opcion=2&id_tipo_bolsa=1&idsec={IDSEC}"


# ---------------------------------------------------------------------------
# Inventario
# ---------------------------------------------------------------------------

def parse_grupos_categorias(html: str) -> list[dict]:
    """Extrae entradas de la página de categorías (sin id_listado aún)."""
    entradas: list[dict] = []
    partes = re.split(r'<span class="grupo">', html)
    for parte in partes[1:]:
        m_grupo = re.match(r"([^<]+)</span>", parte)
        if not m_grupo:
            continue
        grupo = m_grupo.group(1).strip()
        subpartes = re.split(r'<span class="categoria">', parte)
        for sub in subpartes[1:]:
            m_sub = re.match(r"\s*([^<]+?)\s*</span>", sub)
            if not m_sub:
                continue
            subgrupo = m_sub.group(1).strip()
            grupo_label = f"{grupo} — {subgrupo}"

            if "mostrar_especialidades" in sub:
                entradas.append({
                    "grupo": grupo_label,
                    "subgrupo": subgrupo,
                    "categoria": None,
                    "id_bolsa": None,
                    "especialidades": True,
                })
                continue

            for m in re.finditer(BOLSA_LINK_RE, sub, re.I):
                entradas.append({
                    "grupo": grupo_label,
                    "subgrupo": subgrupo,
                    "categoria": re.sub(r"\s+", " ", m.group(2)).strip(),
                    "id_bolsa": int(m.group(1)),
                    "especialidades": False,
                })
    return entradas


def parse_especialidades(html: str, grupo_label: str) -> list[dict]:
    """FEA: cada especialidad es un id_bolsa distinto."""
    out = []
    for m in re.finditer(BOLSA_LINK_RE, html, re.I):
        out.append({
            "grupo": grupo_label,
            "subgrupo": "Facultativos Especialistas",
            "categoria": re.sub(r"\s+", " ", m.group(2)).strip(),
            "id_bolsa": int(m.group(1)),
            "especialidades": False,
        })
    return out


def id_listado_vigente(session: requests.Session, id_bolsa: int) -> int | None:
    """Primer id_listado de la página de bolsa = listado vigente más reciente."""
    html = fetch(session, url_bolsa(id_bolsa))
    ids = re.findall(rf"mostrar_listado{AMP}id_listado=(\d+)", html)
    if not ids:
        ids = re.findall(r"id_listado=(\d+)", html)
    return int(ids[0]) if ids else None


def construir_inventario(session: requests.Session) -> list[dict]:
    html = fetch(session, url_categorias())
    raw = parse_grupos_categorias(html)
    inventario: list[dict] = []

    for item in raw:
        if item.get("especialidades"):
            html_esp = fetch(session, url_especialidades())
            time.sleep(SLEEP_ENTRE_PAGINAS)
            especialidades = parse_especialidades(html_esp, item["grupo"])
            for esp in especialidades:
                id_l = id_listado_vigente(session, esp["id_bolsa"])
                time.sleep(SLEEP_ENTRE_PAGINAS)
                if id_l is None:
                    print(f"  [sin listado] {esp['categoria']} (bolsa {esp['id_bolsa']})")
                    continue
                inventario.append({
                    "grupo": esp["grupo"],
                    "categoria": esp["categoria"],
                    "id_listado": id_l,
                    "id_bolsa": esp["id_bolsa"],
                })
            continue

        id_l = id_listado_vigente(session, item["id_bolsa"])
        time.sleep(SLEEP_ENTRE_PAGINAS)
        if id_l is None:
            print(f"  [sin listado] {item['categoria']} (bolsa {item['id_bolsa']})")
            continue
        inventario.append({
            "grupo": item["grupo"],
            "categoria": item["categoria"],
            "id_listado": id_l,
            "id_bolsa": item["id_bolsa"],
        })

    return inventario


def guardar_inventario(inventario: list[dict]) -> str:
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CATEGORIAS_PATH, "w", encoding="utf-8") as f:
        json.dump(inventario, f, ensure_ascii=False, indent=2)
    print(f"Inventario guardado: {CATEGORIAS_PATH} ({len(inventario)} categorías)")
    return CATEGORIAS_PATH


def cargar_inventario() -> list[dict]:
    if not os.path.exists(CATEGORIAS_PATH):
        raise FileNotFoundError(
            f"No existe {CATEGORIAS_PATH}. Ejecuta: python scraper_murcia.py --inventario"
        )
    with open(CATEGORIAS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Scrape listado HTML
# ---------------------------------------------------------------------------

def parse_filas_pagina(html: str) -> list[dict]:
    filas = []
    for m in ROW_RE.finditer(html):
        nombre = limpiar_texto(m.group(1))
        dni = limpiar_texto(m.group(2))
        orden = int(m.group(3))
        puntos = parse_puntuacion(m.group(4))
        disc_raw = limpiar_texto(m.group(5)).upper()
        discapacidad = disc_raw == "S" or disc_raw.startswith("S ")

        if not nombre and dni:
            nombre = "SOLO OFICIO"
        if not nombre and not dni:
            continue

        filas.append({
            "orden": orden,
            "apellidos_nombre": nombre,
            "dni_parcial": dni,
            "comprobado_baremo": puntos,
            "grupo_preferente": discapacidad,
            "tipos_contrato": {},
            "discapacidad": discapacidad,
        })
    return filas


def total_y_paginas(html: str, filas_pagina: int) -> tuple[int, int]:
    m = PAGINATION_RE.search(html)
    if m:
        total = int(m.group(3))
        paginas = max(1, (total + PER_PAGE - 1) // PER_PAGE)
        return total, paginas
    if filas_pagina:
        return filas_pagina, 1
    return 0, 0


def scrape_listado(
    session: requests.Session,
    categoria: str,
    id_listado: int,
    presupuesto_seg: int,
) -> list[dict]:
    inicio = time.time()
    todas: list[dict] = []
    pagina = 1
    total_esperado = None
    total_paginas = None

    while True:
        if time.time() - inicio > presupuesto_seg:
            print(f"  Presupuesto agotado ({presupuesto_seg}s) en página {pagina}")
            break

        url = url_listado(id_listado, pagina)
        html = fetch(session, url)
        filas = parse_filas_pagina(html)

        if pagina == 1:
            total_esperado, total_paginas = total_y_paginas(html, len(filas))
            print(
                f"  {categoria}: página 1/{total_paginas} — "
                f"{len(filas)} filas (total estimado: {total_esperado})"
            )
        else:
            print(
                f"  {categoria}: página {pagina}/{total_paginas} — {len(filas)} personas"
            )

        if not filas:
            break

        cat_key = categoria.upper()
        for f in filas:
            f["categoria"] = cat_key
            f["gerencia"] = GERENCIA_MURCIA
            f["ambito"] = ""
        todas.extend(filas)

        if total_paginas and pagina >= total_paginas:
            break
        if len(filas) < PER_PAGE:
            break

        pagina += 1
        time.sleep(SLEEP_ENTRE_PAGINAS)

    print(f"  {categoria}: {len(todas)} personas total")
    return todas


def guardar_categoria_json(
    categoria: str,
    id_listado: int,
    grupo_label: str,
    filas: list[dict],
) -> str:
    os.makedirs(DATA_DIR, exist_ok=True)
    slug = slug_archivo(categoria)
    path = os.path.join(DATA_DIR, f"{slug}.json")
    listado = {
        "categoria": categoria.upper(),
        "gerencia": GERENCIA_MURCIA,
        "ambito": "",
        "filas": filas,
    }
    payload = {
        "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "grupo": "murcia",
        "grupo_label": grupo_label,
        "categoria": categoria,
        "region": "murcia",
        "id_listado": id_listado,
        "listados": [listado],
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    size_kb = os.path.getsize(path) / 1024
    print(f"  Guardado {path} ({len(filas)} personas, {size_kb:.1f} KB)")
    return path


def actualizar_manifest():
    archivos = []
    if not os.path.isdir(DATA_DIR):
        return
    for nombre in sorted(os.listdir(DATA_DIR)):
        if not nombre.endswith(".json"):
            continue
        if nombre in ("categorias.json", "manifest.json"):
            continue
        archivos.append(f"murcia/{nombre}")
    manifest = {
        "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "region": "murcia",
        "archivos": archivos,
    }
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"Manifest: {len(archivos)} archivos en {MANIFEST_PATH}")


def buscar_categoria(inventario: list[dict], nombre: str) -> dict | None:
    q = normalizar_nombre(nombre)
    for item in inventario:
        if normalizar_nombre(item["categoria"]) == q:
            return item
    # coincidencia parcial
    matches = [i for i in inventario if q in normalizar_nombre(i["categoria"])]
    if len(matches) == 1:
        return matches[0]
    return None


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser(description="Scraper bolsas SMS (Murcia)")
    p.add_argument("--inventario", action="store_true", help="Genera data/murcia/categorias.json")
    p.add_argument("--categoria", help='Nombre exacto o parcial, ej. "Logopeda"')
    p.add_argument("--todas", action="store_true", help="Scrapea todas las categorías del inventario")
    p.add_argument("--presupuesto", type=int, default=3600, help="Segundos máximos por categoría")
    return p.parse_args()


def main():
    args = parse_args()
    os.makedirs(DATA_DIR, exist_ok=True)
    session = requests.Session()

    if args.inventario:
        print("Construyendo inventario Murcia (puede tardar varios minutos)…")
        inv = construir_inventario(session)
        guardar_inventario(inv)
        actualizar_manifest()
        return

    if not args.categoria and not args.todas:
        print("Indica --inventario, --categoria o --todas")
        raise SystemExit(1)

    inventario = cargar_inventario()
    if args.todas:
        objetivos = inventario
    else:
        item = buscar_categoria(inventario, args.categoria)
        if not item:
            print(f"Categoría no encontrada: {args.categoria}")
            print("Ejecuta --inventario o revisa data/murcia/categorias.json")
            raise SystemExit(1)
        objetivos = [item]

    for item in objetivos:
        cat = item["categoria"]
        id_l = item["id_listado"]
        print(f"\n=== {cat} (id_listado={id_l}) ===")
        filas = scrape_listado(session, cat, id_l, args.presupuesto)
        if filas:
            guardar_categoria_json(cat, id_l, item.get("grupo", ""), filas)
        else:
            print(f"  Sin filas para {cat}")
        time.sleep(SLEEP_ENTRE_PAGINAS)

    actualizar_manifest()
    print("\nListo.")


if __name__ == "__main__":
    main()
