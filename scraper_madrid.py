#!/usr/bin/env python3
"""
Scraper de bolsas SERMAS (Comunidad de Madrid) — Anexo I por puntuación (PDF).

Fuente:
  Índice: https://www.comunidad.madrid/salud/bolsas-contratacion-temporal-servicio-madrileno-salud
  Listados: sede.comunidad.madrid/oferta-empleo/… → /medias/…puntuacion…/download

Uso:
  python scraper_madrid.py --inventario
  python scraper_madrid.py --categoria "Técnico Auxiliar de Farmacia"
  python scraper_madrid.py --pdf ruta.pdf --categoria "Técnico Auxiliar de Farmacia"
  python scraper_madrid.py --todas --presupuesto 7200
"""
from __future__ import annotations

import argparse
import io
import json
import re
import time
import unicodedata
from datetime import datetime
from html import unescape
from pathlib import Path
from urllib.parse import urljoin

import pdfplumber
import requests

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data" / "public" / "madrid"
CATEGORIAS_PATH = DATA_DIR / "categorias.json"
MANIFEST_PATH = DATA_DIR / "manifest.json"
LOCAL_TMP = ROOT / "data" / "_local" / "madrid_tmp"

INDEX_URL = (
    "https://www.comunidad.madrid/salud/"
    "bolsas-contratacion-temporal-servicio-madrileno-salud"
)
SEDE = "https://sede.comunidad.madrid"

USER_AGENT = "Interino-App/1.0 (contacto: fedebotija@gmail.com)"
REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9",
    "Referer": "https://www.comunidad.madrid/",
}

GERENCIA = "SERMAS Comunidad de Madrid"
SLEEP = 0.8

# Grupos del inventario UI (categorias_sanidad.json)
GRUPOS_POR_CATEGORIA = {
    "Farmacéutico de Atención Primaria": "a1",
    "Médico de Familia de Atención Primaria": "a1",
    "Médico de Urgencias SUMMA 112": "a1",
    "Pediatra de Atención Primaria": "a1",
    "Odontólogo de Atención Primaria": "a1",
    "Enfermero/a de Atención Primaria y Atención Hospitalaria": "a2",
    "Especialista en Enfermería de Salud Mental": "a2",
    "Especialista en Enfermería del Trabajo": "a2",
    "Especialista en Enfermería Familiar y Comunitaria": "a2",
    "Especialista en Enfermería Geriátrica": "a2",
    "Especialista en Enfermería Pediátrica": "a2",
    "Enfermero/a SUMMA 112": "a2",
    "Fisioterapeuta": "a2",
    "Logopeda": "a2",
    "Matrona": "a2",
    "Nutricionista": "a2",
    "Óptico-Optometrista": "a2",
    "Podólogo": "a2",
    "Técnico Prevención de Riesgos Laborales": "a2",
    "Terapeuta Ocupacional": "a2",
    "Trabajador/a Social": "a2",
    "Técnico Superior en Dietética y Nutrición": "c1",
    "Técnico Superior en Documentación Sanitaria": "c1",
    "Técnico Superior en Imagen para el Diagnóstico y Medicina Nuclear": "c1",
    "Técnico Superior de Anatomía Patológica": "c1",
    "Técnico Superior en Higiene Bucodental": "c1",
    "Técnico Superior en Laboratorio": "c1",
    "Técnico Superior de Radioterapia y Dosimetría": "c1",
    "Grupo Auxiliar de la Función Administrativa": "c2",
    "Técnico Auxiliar de Farmacia": "c2",
    "Técnico en Emergencias Sanitarias SUMMA 112": "c2",
    "Técnico Medio Sanitario en Cuidados Auxiliares de Enfermería": "c2",
    "Celador": "e",
}

RE_FILA = re.compile(
    r"^(?P<orden>\d+)\s+"
    r"(?P<dni>\*{2,}\d{4})\s+"
    r"(?P<nombre>.+?)\s+"
    r"(?P<centro>\d{3,5})\s+"
    r"(?P<disc>[NnSs])\s+"
    r"(?P<form>[\d.,]+)\s+"
    r"(?P<exp>[\d.,]+)\s+"
    r"(?P<opos>[\d.,]+)\s+"
    r"(?P<total>[\d.,]+)\s*$"
)


def slug_archivo(nombre: str) -> str:
    s = unicodedata.normalize("NFD", nombre)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower().replace("/", "-")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def normalizar(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip().lower()


def parse_puntos(raw: str) -> float:
    return float(raw.strip().replace(".", "").replace(",", "."))


def fetch_text(session: requests.Session, url: str) -> str:
    r = session.get(url, headers=REQUEST_HEADERS, timeout=90)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    return unescape(r.text)


def fetch_bytes(session: requests.Session, url: str) -> bytes:
    r = session.get(url, headers=REQUEST_HEADERS, timeout=180)
    r.raise_for_status()
    return r.content


def inventariar(session: requests.Session) -> list[dict]:
    html = fetch_text(session, INDEX_URL)
    blocks = re.split(r'<span class="accordion-title">', html)
    inventario: list[dict] = []
    for b in blocks[1:]:
        m = re.match(r"([^<]+)</span>", b)
        if not m:
            continue
        cat = unescape(re.sub(r"\s+", " ", m.group(1))).strip()
        cat = cat.replace("\u200b", "").strip()
        if not cat or cat.lower().startswith("grupo") or cat.startswith("¿"):
            continue
        # FAQ accordion titles
        if "?" in cat or cat.upper() == "RMER":
            continue
        chunk = b[:5000]
        url_listados = None
        for hm in re.finditer(
            r'href="(https://sede\.comunidad\.madrid/oferta-empleo/[^"]+)"[^>]*>([\s\S]*?)</a>',
            chunk,
        ):
            label = unescape(re.sub(r"<[^>]+>", " ", hm.group(2)))
            label = re.sub(r"\s+", " ", label).strip().lower()
            if "listado" in label:
                url_listados = hm.group(1)
                break
        if not url_listados:
            print(f"  [sin listados] {cat}")
            continue
        grupo = GRUPOS_POR_CATEGORIA.get(cat, "otros")
        inventario.append(
            {
                "grupo": grupo,
                "categoria": cat,
                "url_listados": url_listados,
            }
        )
    return inventario


def elegir_pdf_puntuacion(html_listados: str) -> tuple[str | None, str]:
    """Devuelve (url_absoluta, etiqueta). Prefiere definitiva sobre provisional."""
    candidatos: list[tuple[int, str, str]] = []
    for hm in re.finditer(
        r'href="(/medias/[^"]+)"[^>]*>([\s\S]*?)</a>',
        html_listados,
    ):
        href = hm.group(1)
        label = unescape(re.sub(r"<[^>]+>", " ", hm.group(2)))
        label = re.sub(r"\s+", " ", label).strip()
        low = (href + " " + label).lower()
        if "puntuacion" not in low and "puntuación" not in low:
            continue
        if "excluid" in low:
            continue
        score = 0
        if "definitiv" in low:
            score += 100
        if "provisional" in low or "prov" in low:
            score += 10
        if "anexo i" in low or "orden de puntu" in low:
            score += 5
        candidatos.append((score, href, label))
    if not candidatos:
        return None, ""
    candidatos.sort(key=lambda x: -x[0])
    _, href, label = candidatos[0]
    return urljoin(SEDE, href), label


def parse_pdf_puntuacion(contenido: bytes) -> list[dict]:
    filas: list[dict] = []
    with pdfplumber.open(io.BytesIO(contenido)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.splitlines():
                line = re.sub(r"\s+", " ", line).strip()
                m = RE_FILA.match(line)
                if not m:
                    continue
                nombre = m.group("nombre").strip()
                # Normalizar espacios raros en nombres
                nombre = re.sub(r"\s+,", ",", nombre)
                nombre = re.sub(r",\s*", ", ", nombre)
                filas.append(
                    {
                        "orden": int(m.group("orden")),
                        "apellidos_nombre": nombre,
                        "dni_parcial": m.group("dni"),
                        "comprobado_baremo": parse_puntos(m.group("total")),
                        "formacion": parse_puntos(m.group("form")),
                        "experiencia": parse_puntos(m.group("exp")),
                        "oposicion": parse_puntos(m.group("opos")),
                        "centro_grabacion": m.group("centro"),
                        "grupo_preferente": m.group("disc").upper() == "S",
                        "discapacidad": m.group("disc").upper() == "S",
                        "tipos_contrato": {},
                    }
                )
    # Deduplicar por orden+dni (cabeceras repetidas)
    seen = set()
    out = []
    for f in filas:
        key = (f["orden"], f["dni_parcial"])
        if key in seen:
            continue
        seen.add(key)
        out.append(f)
    out.sort(key=lambda x: x["orden"])
    return out


def guardar_categoria(
    categoria: str,
    grupo: str,
    filas: list[dict],
    meta: dict,
) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    slug = slug_archivo(categoria)
    path = DATA_DIR / f"{slug}.json"
    for f in filas:
        f["categoria"] = categoria.upper()
        f["gerencia"] = GERENCIA
        f["ambito"] = ""
    listado = {
        "categoria": categoria.upper(),
        "gerencia": GERENCIA,
        "ambito": "",
        "filas": filas,
    }
    payload = {
        "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "grupo": grupo,
        "grupo_label": grupo,
        "categoria": categoria,
        "region": "madrid",
        "fuente": "SERMAS bolsa unica — Anexo I puntuacion",
        **meta,
        "listados": [listado],
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  Guardado {path} ({len(filas)} personas, {path.stat().st_size / 1024:.1f} KB)")
    return path


def actualizar_manifest() -> None:
    archivos = []
    if DATA_DIR.is_dir():
        for p in sorted(DATA_DIR.glob("*.json")):
            if p.name in ("categorias.json", "categorias_sanidad.json", "manifest.json"):
                continue
            if p.name.endswith(".busqueda.json"):
                continue
            archivos.append(f"madrid/{p.name}")
    manifest = {
        "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "region": "madrid",
        "archivos": archivos,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Manifest: {len(archivos)} archivos en {MANIFEST_PATH}")


def cargar_inventario() -> list[dict]:
    if not CATEGORIAS_PATH.exists():
        raise FileNotFoundError(
            f"No existe {CATEGORIAS_PATH}. Ejecuta: python scraper_madrid.py --inventario"
        )
    return json.loads(CATEGORIAS_PATH.read_text(encoding="utf-8"))


def scrape_categoria(
    session: requests.Session,
    item: dict,
    pdf_local: Path | None = None,
) -> Path | None:
    cat = item["categoria"]
    grupo = item.get("grupo") or GRUPOS_POR_CATEGORIA.get(cat, "otros")
    meta: dict = {"url_listados": item.get("url_listados")}

    if pdf_local:
        contenido = pdf_local.read_bytes()
        meta["url_pdf"] = str(pdf_local)
        meta["origen"] = "pdf_local"
    else:
        url_listados = item.get("url_listados")
        if not url_listados:
            print(f"  Sin url_listados: {cat}")
            return None
        html = fetch_text(session, url_listados)
        time.sleep(SLEEP)
        url_pdf, label = elegir_pdf_puntuacion(html)
        if not url_pdf:
            print(f"  Sin PDF puntuación en {url_listados}")
            return None
        print(f"  PDF: {label}\n       {url_pdf}")
        contenido = fetch_bytes(session, url_pdf)
        meta["url_pdf"] = url_pdf
        meta["pdf_label"] = label
        meta["origen"] = "red"

    filas = parse_pdf_puntuacion(contenido)
    if not filas:
        print(f"  Parser 0 filas: {cat}")
        return None
    return guardar_categoria(cat, grupo, filas, meta)


def main() -> int:
    ap = argparse.ArgumentParser(description="Scraper SERMAS Madrid (PDF puntuación)")
    ap.add_argument("--inventario", action="store_true")
    ap.add_argument("--categoria", help="Nombre exacto de categoría del inventario")
    ap.add_argument("--todas", action="store_true")
    ap.add_argument("--pdf", type=Path, help="PDF local (salta descarga)")
    ap.add_argument("--presupuesto", type=int, default=7200, help="Segundos máx. --todas")
    args = ap.parse_args()

    session = requests.Session()

    if args.inventario:
        print(f"Índice: {INDEX_URL}")
        inv = inventariar(session)
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        CATEGORIAS_PATH.write_text(
            json.dumps(inv, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"Inventario: {CATEGORIAS_PATH} ({len(inv)} categorías)")
        return 0

    if args.pdf and args.categoria:
        item = {
            "categoria": args.categoria,
            "grupo": GRUPOS_POR_CATEGORIA.get(args.categoria, "otros"),
            "url_listados": None,
        }
        scrape_categoria(session, item, pdf_local=args.pdf)
        actualizar_manifest()
        return 0

    inv = cargar_inventario()

    if args.categoria:
        needle = normalizar(args.categoria)
        matches = [i for i in inv if normalizar(i["categoria"]) == needle]
        if not matches:
            # partial
            matches = [i for i in inv if needle in normalizar(i["categoria"])]
        if not matches:
            print(f"Categoría no encontrada: {args.categoria}")
            return 1
        scrape_categoria(session, matches[0], pdf_local=args.pdf)
        actualizar_manifest()
        return 0

    if args.todas:
        inicio = time.time()
        ok = 0
        for item in inv:
            if time.time() - inicio > args.presupuesto:
                print("Presupuesto agotado")
                break
            print(f"\n=== {item['categoria']} ===")
            try:
                if scrape_categoria(session, item):
                    ok += 1
            except Exception as e:
                print(f"  ERROR: {e}")
            time.sleep(SLEEP)
        actualizar_manifest()
        print(f"\nListo: {ok}/{len(inv)} categorías")
        return 0

    ap.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
