"""
Vigía ligero del portal de baremos SESCAM.

Comprueba si la convocatoria vigente o el catálogo de categorías ha cambiado
en cada grupo activo. No descarga ni parsea PDFs.

Salida:
  - exit 0: sin cambios
  - exit 1: al menos un grupo cambió (ver data/_local/vigia_cambios.json)
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from html import unescape
from urllib.parse import unquote

import requests

from scraper import LOCAL_DATA_DIR, local_path

# ---------------------------------------------------------------
# Configuración (alineada con scraper.py)
# ---------------------------------------------------------------

BASE_BAREMOS = (
    "https://sanidad.castillalamancha.es/profesionales/atencion-al-profesional/"
    "bolsas-constituidas/baremos/"
)

GRUPOS_ACTIVOS = ("diplomado", "tecnico", "gestion", "licenciados")

GRUPOS_PORTAL_SLUG = {
    "diplomado": "personal-sanitario-diplomado",
    "tecnico": "personal-sanitario-tecnico",
    "gestion": "personal-de-gestion-y-servicios",
    "licenciados": "personal-sanitario-licenciados",
}

USER_AGENT = "Mozilla/5.0 (compatible; ListasApp/0.2; +fedebotija@gmail.com)"
REQUEST_HEADERS = {"User-Agent": USER_AGENT, "Cache-Control": "no-cache"}
HTTP_TIMEOUT = 12
MAX_WORKERS = 4

ESTADO_PATH = local_path("vigia_estado.json")
CAMBIOS_PATH = local_path("vigia_cambios.json")

CONVOCATORIA_RE = re.compile(
    r"(Vig[eé]sima\s+Convocatoria\s+\d{4})",
    re.IGNORECASE,
)


def _chunk_baremo(html: str) -> str:
    idx = html.find("sescam-baremo-bolsa-form")
    return html[idx : idx + 16000] if idx >= 0 else html[:16000]


def _tokens(html: str) -> tuple[str, str]:
    chunk = _chunk_baremo(html)
    fb = re.search(r'name="form_build_id"[^>]*value="([^"]+)"', chunk)
    fid = re.search(r'name="form_id"[^>]*value="([^"]+)"', chunk)
    if not fb or not fid:
        raise ValueError("Tokens del formulario baremo no encontrados")
    return fb.group(1), fid.group(1)


def _opciones_select(html: str, nombre: str) -> list[tuple[str, str]]:
    chunk = _chunk_baremo(html)
    m = re.search(rf'name="{nombre}"[^>]*>(.*?)</select>', chunk, re.I | re.S)
    if not m:
        return []
    out: list[tuple[str, str]] = []
    for valor, texto in re.findall(
        r'<option[^>]*value="([^"]*)"[^>]*>(.*?)</option>', m.group(1), re.I | re.S
    ):
        etiqueta = unescape(re.sub(r"<[^>]+>", "", texto)).strip()
        if valor and valor != "0":
            out.append((valor, etiqueta))
    return out


def _urls_pdf(html: str) -> list[str]:
    urls = []
    for href in re.findall(r'href="([^"]*selecta-pdfs[^"]+\.pdf)"', html, re.I):
        urls.append(unescape(href))
    return list(dict.fromkeys(urls))


def _extraer_convocatoria(url: str) -> str | None:
    texto = unquote(url)
    m = CONVOCATORIA_RE.search(texto)
    if not m:
        return None
    return re.sub(r"\s+", " ", m.group(1))


def _estado_grupo(grupo: str) -> dict:
    """GET + 2 POST mínimos para leer convocatoria vigente sin descargar PDFs."""
    slug = GRUPOS_PORTAL_SLUG[grupo]
    url = BASE_BAREMOS + slug
    session = requests.Session()

    html = session.get(url, headers=REQUEST_HEADERS, timeout=HTTP_TIMEOUT).text
    categorias_op = _opciones_select(html, "categoria")
    categorias = [etiqueta for _, etiqueta in categorias_op]
    if not categorias:
        raise ValueError(f"Sin categorías en baremos/{slug}")

    cat_id = categorias_op[0][0]
    fb, fid = _tokens(html)
    html = session.post(
        url,
        data={"categoria": cat_id, "form_build_id": fb, "form_id": fid},
        headers={**REQUEST_HEADERS, "Referer": url},
        timeout=HTTP_TIMEOUT,
    ).text

    gerencias = _opciones_select(html, "gerencia")
    if not gerencias:
        raise ValueError(f"Sin gerencias tras elegir categoría en {grupo}")

    ger_id = gerencias[0][0]
    fb, fid = _tokens(html)
    html = session.post(
        url,
        data={
            "categoria": cat_id,
            "gerencia": ger_id,
            "form_build_id": fb,
            "form_id": fid,
        },
        headers={**REQUEST_HEADERS, "Referer": url},
        timeout=HTTP_TIMEOUT,
    ).text

    pdfs = _urls_pdf(html)
    if not pdfs:
        raise ValueError(f"Sin enlaces PDF de muestra en {grupo}")

    convocatoria = _extraer_convocatoria(pdfs[0])
    if not convocatoria:
        raise ValueError(f"No se pudo leer convocatoria en PDF de muestra ({grupo})")

    return {
        "convocatoria": convocatoria,
        "num_categorias": len(categorias),
        "categorias": categorias,
        "categoria_muestra": categorias[0],
        "gerencia_muestra": gerencias[0][1],
        "pdf_muestra": pdfs[0],
        "consultado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
    }


def _cargar_estado() -> dict:
    if not os.path.exists(ESTADO_PATH):
        return {}
    with open(ESTADO_PATH, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            return {}
    return data.get("grupos", {})


def _guardar_estado(grupos: dict) -> None:
    os.makedirs(LOCAL_DATA_DIR, exist_ok=True)
    payload = {
        "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "grupos": grupos,
    }
    with open(ESTADO_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def _guardar_cambios(cambios: list[str]) -> None:
    os.makedirs(LOCAL_DATA_DIR, exist_ok=True)
    with open(CAMBIOS_PATH, "w", encoding="utf-8") as f:
        json.dump(
            {
                "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
                "cambios": cambios,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )


def _comparar_grupo(anterior: dict | None, actual: dict) -> bool:
    """True si hay cambio respecto al estado anterior."""
    if not anterior:
        return False  # bootstrap: primera vez no dispara scrape
    claves = ("convocatoria", "num_categorias", "categorias")
    return any(anterior.get(k) != actual.get(k) for k in claves)


def main() -> int:
    inicio = time.time()
    anterior = _cargar_estado()
    actual_por_grupo: dict[str, dict] = {}
    errores: dict[str, str] = {}

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futuros = {pool.submit(_estado_grupo, g): g for g in GRUPOS_ACTIVOS}
        for futuro in as_completed(futuros):
            grupo = futuros[futuro]
            try:
                actual_por_grupo[grupo] = futuro.result()
            except Exception as exc:
                errores[grupo] = str(exc)

    if errores:
        for grupo, msg in errores.items():
            print(f"ERROR vigía {grupo}: {msg}", file=sys.stderr)
        return 2

    cambios: list[str] = []
    for grupo in GRUPOS_ACTIVOS:
        actual = actual_por_grupo[grupo]
        prev = anterior.get(grupo)
        if _comparar_grupo(prev, actual):
            cambios.append(grupo)
            print(f"CAMBIO DETECTADO en {grupo}")
            print(
                f"  convocatoria: {prev.get('convocatoria')} -> {actual['convocatoria']}"
                if prev
                else f"  convocatoria: {actual['convocatoria']}"
            )
            if prev and prev.get("num_categorias") != actual["num_categorias"]:
                print(
                    f"  categorías: {prev.get('num_categorias')} -> {actual['num_categorias']}"
                )
        else:
            etiqueta = "inicializado" if not prev else "sin cambio"
            print(
                f"{grupo}: {actual['convocatoria']} "
                f"({actual['num_categorias']} categorías, {etiqueta})"
            )

    # Fusionar estado: conservar grupos previos no consultados + nuevos
    estado_nuevo = {**anterior, **actual_por_grupo}
    if not anterior or cambios:
        _guardar_estado(estado_nuevo)
    if cambios:
        _guardar_cambios(cambios)

    elapsed = time.time() - inicio
    print(f"Vigía completado en {elapsed:.1f}s — estado en {ESTADO_PATH}")

    if cambios:
        print(f"Grupos afectados: {', '.join(cambios)}")
        return 1

    print("Sin cambios")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
