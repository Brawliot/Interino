"""
Vigía ligero del portal de baremos SESCAM y bolsas de Administración CLM.

Sanidad: comprueba convocatoria vigente o catálogo por grupo activo.
Admin CLM: compara fecha_modificacion de cada bolsa con categorias.json.
No descarga ni parsea PDFs.

Salida:
  - exit 0: sin cambios
  - exit 1: al menos un grupo/bolsa cambió (ver data/_local/vigia_cambios.json)
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

ADMIN_CATEGORIAS_PATH = os.path.join("data", "admin-clm", "categorias.json")
ADMIN_BASE = "https://empleopublico.castillalamancha.es"
ADMIN_FECHA_MOD_RE = re.compile(
    r"Fecha de [UÚ]ltima Modificaci[oó]n:?\s*(\d{1,2}/\d{1,2}/\d{4})",
    re.I,
)

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


def _fecha_admin_iso(fecha_dmY: str) -> str | None:
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", fecha_dmY.strip())
    if not m:
        return None
    d, mo, y = m.groups()
    return f"{y}-{int(mo):02d}-{int(d):02d}"


def _fecha_modificacion_admin(html: str) -> str | None:
    plain = re.sub(r"<[^>]+>", " ", html)
    m = ADMIN_FECHA_MOD_RE.search(plain)
    if not m:
        return None
    return _fecha_admin_iso(m.group(1))


def _cargar_catalogo_admin() -> list[dict]:
    if not os.path.exists(ADMIN_CATEGORIAS_PATH):
        return []
    with open(ADMIN_CATEGORIAS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else []


def _estado_admin_clm() -> dict:
    """GET a cada página de bolsa; solo lee fecha_modificacion."""
    catalogo = _cargar_catalogo_admin()
    if not catalogo:
        raise ValueError(f"Sin inventario admin en {ADMIN_CATEGORIAS_PATH}")

    bolsas: dict[str, dict] = {}
    errores: list[str] = []

    for entry in catalogo:
        if entry.get("error"):
            continue
        slug = entry.get("slug_pagina")
        colectivo = entry.get("colectivo")
        if not slug or not colectivo:
            continue
        clave = f"{colectivo}/{slug}"
        url = entry.get("url_pagina") or f"{ADMIN_BASE}/bolsas/personal-{colectivo}/{slug}"
        try:
            r = requests.get(url, headers=REQUEST_HEADERS, timeout=HTTP_TIMEOUT)
            r.raise_for_status()
            r.encoding = r.apparent_encoding or "utf-8"
            fecha = _fecha_modificacion_admin(r.text)
            bolsas[clave] = {
                "categoria": entry.get("categoria"),
                "fecha_modificacion": fecha,
                "url_pagina": url,
                "consultado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            }
        except requests.RequestException as exc:
            errores.append(f"{clave}: {exc}")
        time.sleep(1.0)

    if errores and not bolsas:
        raise ValueError("; ".join(errores[:3]))

    return {
        "num_bolsas": len(bolsas),
        "bolsas": bolsas,
        "errores": errores,
        "consultado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
    }


def _comparar_admin(anterior: dict | None, actual: dict, catalogo: list[dict]) -> list[str]:
    """Lista de bolsas con fecha_modificacion distinta a categorias.json."""
    if not anterior:
        return []

    cambios: list[str] = []
    fechas_guardadas = {
        f"{e.get('colectivo')}/{e.get('slug_pagina')}": e.get("fecha_modificacion")
        for e in catalogo
        if e.get("slug_pagina") and not e.get("error")
    }

    for clave, info in actual.get("bolsas", {}).items():
        prev_fecha = (anterior.get("bolsas") or {}).get(clave, {}).get("fecha_modificacion")
        nueva = info.get("fecha_modificacion")
        guardada = fechas_guardadas.get(clave)

        if nueva and guardada and nueva != guardada:
            cambios.append(clave)
            continue
        if prev_fecha and nueva and nueva != prev_fecha:
            if clave not in cambios:
                cambios.append(clave)

    return cambios


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
            cambios.append(f"sanidad:{grupo}")
            print(f"CAMBIO DETECTADO en sanidad/{grupo}")
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
                f"sanidad/{grupo}: {actual['convocatoria']} "
                f"({actual['num_categorias']} categorías, {etiqueta})"
            )

    # --- Administración CLM ---
    cambios_admin: list[str] = []
    catalogo_admin = _cargar_catalogo_admin()
    if catalogo_admin:
        try:
            actual_admin = _estado_admin_clm()
            prev_admin = anterior.get("admin_clm")
            cambios_admin = _comparar_admin(prev_admin, actual_admin, catalogo_admin)
            n = actual_admin.get("num_bolsas", 0)
            if cambios_admin:
                for clave in cambios_admin:
                    info = actual_admin["bolsas"].get(clave, {})
                    prev_info = (prev_admin or {}).get("bolsas", {}).get(clave, {})
                    print(f"CAMBIO DETECTADO en admin/{clave}")
                    print(
                        f"  fecha: {prev_info.get('fecha_modificacion')} -> "
                        f"{info.get('fecha_modificacion')} ({info.get('categoria')})"
                    )
                    cambios.append(f"admin:{clave}")
            else:
                etiqueta = "inicializado" if not prev_admin else "sin cambio"
                print(f"admin-clm: {n} bolsas consultadas ({etiqueta})")
            if actual_admin.get("errores"):
                print(f"  avisos admin: {len(actual_admin['errores'])} páginas con error")
            actual_por_grupo["admin_clm"] = actual_admin
        except Exception as exc:
            print(f"ERROR vigía admin-clm: {exc}", file=sys.stderr)
    else:
        print("admin-clm: sin categorias.json — omitido")

    # Fusionar estado: conservar grupos previos no consultados + nuevos
    estado_nuevo = {**anterior, **actual_por_grupo}
    if not anterior or cambios:
        _guardar_estado(estado_nuevo)
    if cambios:
        _guardar_cambios(cambios)

    elapsed = time.time() - inicio
    print(f"Vigía completado en {elapsed:.1f}s — estado en {ESTADO_PATH}")

    if cambios:
        print(f"Cambios detectados: {', '.join(cambios)}")
        return 1

    print("Sin cambios")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
