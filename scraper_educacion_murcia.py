#!/usr/bin/env python3
"""
Scraper de listas de interinos docentes — Educación Región de Murcia (CARM).

Fuente: carm.es — índices HTML + PDFs públicos (texto seleccionable).
MVP: Cuerpo de Maestros (Infantil/Primaria), listas definitivas por bloque.

Uso:
  python scraper_educacion_murcia.py --inventario
  python scraper_educacion_murcia.py --scrape
  python scraper_educacion_murcia.py --pdf ruta/al/archivo.pdf --bloque "BLOQUE II"
  python scraper_educacion_murcia.py --scrape --solo-bloque "BLOQUE I"

Si Radware Captcha bloquea la descarga:
  1) Abre el PDF en el navegador y guárdalo en data/_local/educacion_murcia_tmp/
  2) python scraper_educacion_murcia.py --pdf data/_local/educacion_murcia_tmp/xxx.pdf
"""
from __future__ import annotations

import argparse
import io
import json
import re
import time
import unicodedata
from html import unescape
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, unquote, urljoin, urlparse

import pdfplumber
import requests

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data" / "educacion-murcia"
CATEGORIAS_PATH = DATA_DIR / "categorias.json"
MANIFEST_PATH = DATA_DIR / "manifest.json"
LOCAL_TMP = ROOT / "data" / "_local" / "educacion_murcia_tmp"

BASE = "https://www.carm.es"
USER_AGENT = "Interino-App/1.0 (contacto: fedebotija@gmail.com)"
REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9",
    "Referer": "https://www.carm.es/",
}

# Semillas conocidas (curso 2025/2026 Maestros). El inventario las amplía.
SEED_INDEX = f"{BASE}/web/pagina?IDCONTENIDO=4088&IDTIPO=100"
SEED_CURSO_MAESTROS = f"{BASE}/web/pagina?IDCONTENIDO=74801&IDTIPO=100"
SEED_DEFINITIVO = f"{BASE}/web/pagina?IDCONTENIDO=74803&IDTIPO=100"
SEED_BLOQUES = {
    "BLOQUE I": f"{BASE}/web/pagina?IDCONTENIDO=74914&IDTIPO=100",
    "BLOQUE II": f"{BASE}/web/pagina?IDCONTENIDO=74915&IDTIPO=100",
}

RE_WS = re.compile(r"\s+")
RE_IDCONTENIDO = re.compile(r"IDCONTENIDO=(\d+)", re.I)
RE_HREF = re.compile(r'href="([^"]+)"', re.I)
RE_DNI = re.compile(r"\*{3}\d{4}\*{2}")
RE_PUNTOS = re.compile(r"(\d+[.,]\d{2,})")
# Formato real CARM Maestros:
# 24063160 ***6349** 14.3455 GARCIA MOÑINO, MARIA JESUS PRI EDUCACIÓN PRIMARIA
RE_FILA_CARM = re.compile(
    r"(?P<lista>\d{5,})\s+"
    r"(?P<dni>\*{3}\d{4}\*{2})\s+"
    r"(?P<puntos>\d+[.,]\d{2,})\s+"
    r"(?P<resto>.+?)"
    r"(?:\s+(?P<esp>[A-Z]{1,3}\d{0,2})\s+(?P<desc>[A-ZÁÉÍÓÚÑÜa-záéíóúñü0-9 /.:()+-]+))?$"
)
RE_ESP_SOLO = re.compile(
    r"^(?P<esp>[A-Z]{1,3}\d{0,2})\s+(?P<desc>.+)$"
)
RE_ESPECIALIDAD_HDR = re.compile(
    r"(?:Especialidad|ESPECIALIDAD)\s*[:=]?\s*(\d{2,3})\s*[-–]?\s*(.+)$",
    re.I,
)
RE_PRIORIDAD = re.compile(r"^Prioridad:\s*", re.I)
RE_CABECERA = re.compile(r"^N[ºo°]?\s*Lista\s+DNI", re.I)

SLEEP = 0.8
GERENCIA = "Region de Murcia"

# Códigos Esp observados en PDFs Maestros Murcia (no confundir con fragmentos de nombre)
ESP_VALIDOS = {
    "AL": "Audicion y Lenguaje",
    "EF": "Educacion Fisica",
    "EI": "Educacion Infantil",
    "FA": "Lengua Extranjera: Aleman",
    "FF": "Lengua Extranjera: Frances",
    "FI": "Lengua Ext.: Ingles (Maestros Primaria)",
    "MU": "Musica",
    "PRI": "Educacion Primaria",
    "PT": "Pedagogia Terapeutica",
    "I31": "Educacion Infantil/Ingles",
    "I34": "Educacion Fisica/Ingles",
    "I35": "Musica/Ingles",
    "I38": "Educacion Primaria/Ingles",
}
ESP_ALT_RE = re.compile(
    r"\b(" + "|".join(sorted(ESP_VALIDOS.keys(), key=len, reverse=True)) + r")\b"
)


def norm(s: str) -> str:
    return RE_WS.sub(" ", (s or "").strip())


def quitar_acentos(texto: str) -> str:
    nfkd = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def slug_texto(texto: str) -> str:
    s = quitar_acentos(texto).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def parse_puntos_safe(raw: str) -> float:
    t = raw.strip().replace(" ", "")
    if "," in t and "." in t:
        # 1.234,56 → europeo
        t = t.replace(".", "").replace(",", ".")
    else:
        t = t.replace(",", ".")
    return float(t)


def es_captcha(html_or_bytes: bytes | str) -> bool:
    if isinstance(html_or_bytes, bytes):
        head = html_or_bytes[:800].decode("utf-8", errors="ignore").lower()
    else:
        head = html_or_bytes[:2000].lower()
    return "radware captcha" in head or "shieldsquare" in head or "perfdrive.com" in head


def session() -> requests.Session:
    s = requests.Session()
    s.headers.update(REQUEST_HEADERS)
    return s


def fetch_html(s: requests.Session, url: str) -> str:
    r = s.get(url, timeout=90)
    r.raise_for_status()
    if es_captcha(r.content):
        raise RuntimeError(
            f"CARM devolvió Radware Captcha en HTML. URL: {url}\n"
            "Prueba otra red / más tarde, o descarga los PDF a mano y usa --pdf."
        )
    r.encoding = r.apparent_encoding or "utf-8"
    return r.text


def fetch_pdf(s: requests.Session, url: str) -> bytes:
    r = s.get(url, timeout=180)
    r.raise_for_status()
    if es_captcha(r.content) or not r.content.startswith(b"%PDF"):
        raise RuntimeError(
            f"CARM no devolvió PDF (¿captcha?). URL: {url}\n"
            "Abre el enlace en el navegador, guarda el PDF en "
            f"{LOCAL_TMP}/ y ejecuta: python scraper_educacion_murcia.py --pdf <archivo>"
        )
    return r.content


def absolutizar(href: str) -> str:
    url = urljoin(BASE + "/", href.replace("&amp;", "&"))
    # CARM a veces enlaza /pagina?… (404); la ruta válida es /web/pagina?…
    url = url.replace("://www.carm.es/pagina?", "://www.carm.es/web/pagina?")
    url = url.replace("://www.carm.es/descarga?", "://www.carm.es/web/descarga?")
    return url


def enlaces_pagina(html: str) -> list[tuple[str, str]]:
    """Lista (texto_aprox, url) de la página."""
    out: list[tuple[str, str]] = []
    # Parejas simples: texto entre > y < tras href
    for m in re.finditer(
        r'href="([^"]+)"[^>]*>(.*?)</a>',
        html,
        re.I | re.S,
    ):
        href = absolutizar(m.group(1))
        txt = norm(unescape(re.sub(r"<[^>]+>", " ", m.group(2))))
        if not txt:
            continue
        out.append((txt, href))
    return out


def es_pdf_url(url: str) -> bool:
    u = url.lower()
    return "descarga" in u or u.endswith(".pdf") or "archivo=" in u


def prefiere_pdf_por_numero_lista(titulo: str) -> bool:
    t = quitar_acentos(unescape(titulo)).lower()
    if "alfabet" in t:
        return False
    if "excluid" in t or "no present" in t:
        return False
    return "numero de lista" in t or "nº de lista" in t or "n° de lista" in t or "nº lista" in t or "na lista" in t


def descubrir_pdfs_bloque(s: requests.Session, bloque: str, url_bloque: str) -> list[dict]:
    html = fetch_html(s, url_bloque)
    pdfs = []
    for txt, href in enlaces_pagina(html):
        if not es_pdf_url(href):
            continue
        if "interino" not in quitar_acentos(txt).lower() and "lista" not in quitar_acentos(txt).lower():
            # aún así aceptar descarga con ARCHIVO=lista
            if "lista" not in unquote(href).lower():
                continue
        mid = RE_IDCONTENIDO.search(href)
        pdfs.append({
            "titulo": txt,
            "url": href,
            "id_contenido": mid.group(1) if mid else None,
            "por_numero_lista": prefiere_pdf_por_numero_lista(txt),
            "bloque": bloque,
        })
    # Preferir orden por número de lista
    pdfs.sort(key=lambda p: (0 if p["por_numero_lista"] else 1, p["titulo"]))
    return pdfs


def construir_inventario(s: requests.Session) -> dict:
    print("Explorando índices CARM (Maestros)…")
    time.sleep(SLEEP)
    fetch_html(s, SEED_INDEX)  # cookie/warmup
    time.sleep(SLEEP)

    curso_html = fetch_html(s, SEED_CURSO_MAESTROS)
    definitivo_url = SEED_DEFINITIVO
    for txt, href in enlaces_pagina(curso_html):
        if norm(txt).lower() == "definitivo" and "IDCONTENIDO=" in href:
            definitivo_url = href
            break

    time.sleep(SLEEP)
    def_html = fetch_html(s, definitivo_url)
    bloques: dict[str, str] = dict(SEED_BLOQUES)
    for txt, href in enlaces_pagina(def_html):
        m = re.match(r"BLOQUE\s+(I{1,3}|IV|V|\d+)", txt.strip(), re.I)
        if m:
            nombre = f"BLOQUE {m.group(1).upper()}"
            bloques[nombre] = href

    fuentes = []
    for nombre, url_b in sorted(bloques.items()):
        print(f"  {nombre}: {url_b}")
        time.sleep(SLEEP)
        try:
            pdfs = descubrir_pdfs_bloque(s, nombre, url_b)
        except RuntimeError as e:
            print(f"  ! {e}")
            pdfs = []
        elegido = next((p for p in pdfs if p["por_numero_lista"]), pdfs[0] if pdfs else None)
        fuentes.append({
            "bloque": nombre,
            "url_bloque": url_b,
            "pdfs": pdfs,
            "pdf_preferido": elegido,
        })
        if elegido:
            print(f"    PDF: {elegido['titulo'][:80]}")
        else:
            print("    (sin PDF detectado)")

    inv = {
        "ccaaId": "mur",
        "sector": "educacion",
        "cuerpo": "maestros",
        "cuerpo_nombre": "Cuerpo de Maestros (Infantil y Primaria)",
        "curso": "2025/2026",
        "fuente": {
            "portal": "CARM — Listas de Interinos",
            "indice": SEED_INDEX,
            "curso_url": SEED_CURSO_MAESTROS,
            "definitivo_url": definitivo_url,
        },
        "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "bloques": fuentes,
    }
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CATEGORIAS_PATH.write_text(json.dumps(inv, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Inventario guardado: {CATEGORIAS_PATH}")
    return inv


def parsear_pdf(contenido: bytes, bloque: str) -> dict[str, list[dict]]:
    """Agrupa por código Esp (PRI, EI, AL, …)."""
    por_esp: dict[str, list[dict]] = {}
    re_inicio = re.compile(
        r"(?P<lista>\d{5,})\s+(?P<dni>\*{3}\d{4}\*{2})\s+(?P<puntos>\d+[.,]\d{2,})\s+"
    )

    with pdfplumber.open(io.BytesIO(contenido)) as pdf:
        textos = []
        for page in pdf.pages:
            textos.append(page.extract_text() or "")
    texto = "\n".join(textos)
    # Una sola línea por registro cuando el PDF parte el nombre
    texto = re.sub(r"\n(?!\d{5,}\s)", " ", texto)
    texto = RE_WS.sub(" ", texto)

    matches = list(re_inicio.finditer(texto))
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(texto)
        cola = norm(texto[start:end])
        # Quitar restos de cabecera intercalados
        cola = re.sub(r"RELACI[ÓO]N DEFINITIVA.*?2026", " ", cola, flags=re.I)
        cola = re.sub(r"BLOQUE\s+I{1,3}", " ", cola, flags=re.I)
        cola = re.sub(r"Prioridad:.*?(?=[A-ZÁÉÍÓÚ])", " ", cola, flags=re.I)
        cola = re.sub(r"N[ºo°]?\s*Lista\s+DNI\s+Puntos.*?Descripci[óo]n", " ", cola, flags=re.I)
        cola = re.sub(r"P[áa]gina\s+\d+", " ", cola, flags=re.I)
        cola = norm(cola)

        # Buscar el código Esp válido más a la derecha (evita "ANA", "DEL", …)
        hits = list(ESP_ALT_RE.finditer(cola))
        if not hits:
            continue
        hit = hits[-1]
        esp = hit.group(1).upper()
        nombre = norm(cola[: hit.start()])
        desc = norm(cola[hit.end():]) or ESP_VALIDOS.get(esp, esp)
        if len(nombre) < 3:
            continue
        try:
            puntos = parse_puntos_safe(m.group("puntos"))
        except ValueError:
            continue
        fila = {
            "orden": int(m.group("lista")),
            "num_lista": int(m.group("lista")),
            "apellidos_nombre": nombre,
            "dni_parcial": m.group("dni"),
            "comprobado_baremo": puntos,
            "grupo_preferente": False,
            "tipos_contrato": {},
            "discapacidad": False,
            "categoria": ESP_VALIDOS.get(esp, desc).upper(),
            "gerencia": GERENCIA,
            "ambito": bloque,
            "especialidad_codigo": esp,
            "bloque": bloque,
        }
        por_esp.setdefault(esp, []).append(fila)

    for cod, filas in por_esp.items():
        vistos = set()
        unicas = []
        for f in filas:
            key = (f["num_lista"], f["dni_parcial"])
            if key in vistos:
                continue
            vistos.add(key)
            unicas.append(f)
        unicas.sort(key=lambda f: (-f["comprobado_baremo"], f["num_lista"]))
        for i, f in enumerate(unicas, start=1):
            f["orden"] = i
        por_esp[cod] = unicas
    return por_esp


def guardar_especialidades_fusionadas(
    por_esp_bloques: dict[str, dict[str, list[dict]]],
    pdf_urls: dict[str, str | None],
    cuerpo_slug: str = "maestros",
) -> list[str]:
    """
    por_esp_bloques: { esp_code: { "BLOQUE I": [filas], "BLOQUE II": [filas] } }
    Un JSON por especialidad con un listado por bloque (no se pisan).
    """
    out_dir = DATA_DIR / cuerpo_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    guardados = []

    for cod in sorted(por_esp_bloques.keys()):
        por_bloque = por_esp_bloques[cod]
        nombre = ESP_VALIDOS.get(cod, cod).title()
        listados = []
        total = 0
        bloques_label = []
        for bloque in sorted(por_bloque.keys()):
            filas = por_bloque[bloque]
            if not filas:
                continue
            filas = sorted(filas, key=lambda f: (-f["comprobado_baremo"], f["num_lista"]))
            for i, f in enumerate(filas, start=1):
                f["orden"] = i
            listados.append({
                "categoria": nombre.upper(),
                "gerencia": GERENCIA,
                "ambito": bloque,
                "filas": filas,
            })
            total += len(filas)
            bloques_label.append(bloque)

        if not listados:
            continue

        slug = slug_texto(f"{cod}-{nombre}")
        path = out_dir / f"{slug}.json"
        payload = {
            "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            "region": "murcia",
            "sector": "educacion",
            "cuerpo": cuerpo_slug,
            "grupo": "murcia-educacion",
            "grupo_label": f"Maestros · {' + '.join(bloques_label)}",
            "categoria": nombre,
            "especialidad_codigo": cod,
            "bloques": bloques_label,
            "pdf_urls": {b: pdf_urls.get(b) for b in bloques_label},
            "listados": listados,
        }
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  Guardado {path.relative_to(ROOT)} ({total} personas en {len(listados)} bloque(s))")
        guardados.append(str(path.relative_to(DATA_DIR)).replace("\\", "/"))
    return guardados


def actualizar_manifest() -> None:
    archivos = []
    if DATA_DIR.exists():
        for p in sorted(DATA_DIR.rglob("*.json")):
            if p.name in ("categorias.json", "manifest.json"):
                continue
            if p.name.endswith(".busqueda.json"):
                continue
            rel = p.relative_to(DATA_DIR).as_posix()
            archivos.append(f"educacion-murcia/{rel}")
    MANIFEST_PATH.write_text(
        json.dumps({
            "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            "region": "murcia",
            "sector": "educacion",
            "archivos": archivos,
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Manifest: {len(archivos)} archivos en {MANIFEST_PATH}")


def cargar_inventario() -> dict:
    if not CATEGORIAS_PATH.exists():
        raise SystemExit("No hay categorias.json. Ejecuta --inventario primero.")
    return json.loads(CATEGORIAS_PATH.read_text(encoding="utf-8"))


def scrape_desde_inventario(s: requests.Session, solo_bloque: str | None) -> None:
    inv = cargar_inventario()
    LOCAL_TMP.mkdir(parents=True, exist_ok=True)
    acumulado: dict[str, dict[str, list[dict]]] = {}
    pdf_urls: dict[str, str | None] = {}

    for bloque_info in inv.get("bloques", []):
        bloque = bloque_info["bloque"]
        if solo_bloque and solo_bloque.upper() not in bloque.upper():
            continue
        pref = bloque_info.get("pdf_preferido")
        if not pref:
            print(f"=== {bloque}: sin PDF en inventario, skip ===")
            continue
        url = pref["url"]
        print(f"\n=== {bloque} ===\n  {pref['titulo'][:100]}\n  {url}")
        time.sleep(SLEEP)
        contenido = fetch_pdf(s, url)
        slug = slug_texto(bloque)
        local_pdf = LOCAL_TMP / f"{slug}-lista.pdf"
        local_pdf.write_bytes(contenido)
        print(f"  PDF local: {local_pdf} ({len(contenido)//1024} KB)")
        por_esp = parsear_pdf(contenido, bloque)
        print(f"  Especialidades: {len(por_esp)}")
        pdf_urls[bloque] = url
        for cod, filas in por_esp.items():
            acumulado.setdefault(cod, {})[bloque] = filas
            print(f"    {cod}: {len(filas)} personas")

    print("\nFusionando bloques y guardando…")
    guardar_especialidades_fusionadas(acumulado, pdf_urls)
    actualizar_manifest()


def scrape_pdfs_locales(bloque_paths: list[tuple[str, Path]]) -> None:
    """Reparsea PDFs ya descargados sin tocar la red."""
    acumulado: dict[str, dict[str, list[dict]]] = {}
    pdf_urls: dict[str, str | None] = {}
    for bloque, path in bloque_paths:
        contenido = path.read_bytes()
        if not contenido.startswith(b"%PDF"):
            raise SystemExit(f"No es un PDF: {path}")
        print(f"Parseando {path} ({len(contenido)//1024} KB) como {bloque}…")
        por_esp = parsear_pdf(contenido, bloque)
        print(f"  Especialidades: {len(por_esp)}")
        pdf_urls[bloque] = None
        for cod, filas in por_esp.items():
            acumulado.setdefault(cod, {})[bloque] = filas
            print(f"    {cod}: {len(filas)} personas")
    print("\nFusionando bloques y guardando…")
    guardar_especialidades_fusionadas(acumulado, pdf_urls)
    actualizar_manifest()


def scrape_pdf_local(path: Path, bloque: str) -> None:
    scrape_pdfs_locales([(bloque, path)])


def main() -> None:
    p = argparse.ArgumentParser(description="Scraper educación Murcia (CARM)")
    p.add_argument("--inventario", action="store_true", help="Explora índices y guarda categorias.json")
    p.add_argument("--scrape", action="store_true", help="Descarga PDFs del inventario y genera JSON")
    p.add_argument("--solo-bloque", help='Filtra bloque, ej. "BLOQUE II"')
    p.add_argument("--pdf", type=Path, help="Parsea un PDF local (bypass captcha)")
    p.add_argument("--bloque", default="BLOQUE II", help="Etiqueta de bloque para --pdf")
    p.add_argument(
        "--desde-tmp",
        action="store_true",
        help="Reparsea data/_local/educacion_murcia_tmp/bloque-*-lista.pdf (I+II fusionados)",
    )
    args = p.parse_args()

    if args.desde_tmp:
        paths = []
        for bloque, nombre in (("BLOQUE I", "bloque-i-lista.pdf"), ("BLOQUE II", "bloque-ii-lista.pdf")):
            path = LOCAL_TMP / nombre
            if path.exists():
                paths.append((bloque, path))
            else:
                print(f"Aviso: no está {path}")
        if not paths:
            raise SystemExit(f"No hay PDFs en {LOCAL_TMP}")
        scrape_pdfs_locales(paths)
        print("\nListo.")
        return

    if args.pdf:
        scrape_pdf_local(args.pdf, args.bloque)
        print("\nListo.")
        return

    if not args.inventario and not args.scrape:
        p.print_help()
        raise SystemExit(1)

    s = session()
    if args.inventario:
        construir_inventario(s)
    if args.scrape:
        if not CATEGORIAS_PATH.exists():
            construir_inventario(s)
        scrape_desde_inventario(s, args.solo_bloque)
    print("\nListo.")


if __name__ == "__main__":
    main()
