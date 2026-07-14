#!/usr/bin/env python3
"""
Scraper de bolsas de Administración General — Castilla-La Mancha.

Portal: empleopublico.castillalamancha.es/bolsas
Listados en PDF por categoría y provincia (sin DNI ni puntuación).

Uso:
  python scraper_admin_clm.py --inventario
  python scraper_admin_clm.py --categoria "Administrativos" --presupuesto 3600
  python scraper_admin_clm.py --todos --presupuesto 14400
  python scraper_admin_clm.py --probar-parser
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from html import unescape
from pathlib import Path
from urllib.parse import urljoin, unquote

import pdfplumber
import requests

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data" / "admin-clm"
CATEGORIAS_PATH = DATA_DIR / "categorias.json"
MANIFEST_PATH = DATA_DIR / "manifest.json"
LOCAL_TMP = ROOT / "data" / "_local" / "admin_clm_tmp"

BASE = "https://empleopublico.castillalamancha.es"
INDEX_FUNCIONARIO = f"{BASE}/bolsas/personal-funcionario"
INDEX_LABORAL = f"{BASE}/bolsas/personal-laboral"

USER_AGENT = "Interino-App/1.0 (contacto: fedebotija@gmail.com)"
SLEEP_PAGINA = 1.0

PROVINCIAS_NOMBRE = {
    "albacete": "Albacete",
    "ciudad real": "Ciudad Real",
    "cuenca": "Cuenca",
    "guadalajara": "Guadalajara",
    "toledo": "Toledo",
}

RE_LINK_BOLSA = re.compile(
    r'href="(/bolsas/personal-(?:funcionario|laboral)/[^"#?]+)"',
    re.I,
)
RE_LINK_PDF = re.compile(
    r'<a[^>]+href="([^"]+\.pdf)"[^>]*>(.*?)</a>',
    re.I | re.S,
)
RE_FECHA_MOD = re.compile(
    r"Fecha de [UÚ]ltima Modificaci[oó]n:?\s*(\d{1,2}/\d{1,2}/\d{4})",
    re.I,
)
RE_TITULO = re.compile(r"<title>([^<|]+)", re.I)
RE_H1 = re.compile(r"<h1[^>]*>([^<]+)</h1>", re.I | re.S)
RE_WS = re.compile(r"\s+")

SUB_BOLSA_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"BOLSA\s+DEFINITIVA", re.I), "definitiva"),
    (re.compile(r"BOLSA\s+PROVISIONAL", re.I), "provisional"),
    (re.compile(r"BOLSA\s+DE\s+SUSPENSOS", re.I), "suspensos"),
    (re.compile(r"BOLSA\s+EXTRAORDINARIA", re.I), "extraordinaria"),
]

# PDFs de prueba (Toledo) — no descargar el corpus completo en verificación
PDFS_PRUEBA = [
    {
        "etiqueta": "Administrativos (Ejecutivo)",
        "url": f"{BASE}/sites/default/files/2026-07/TO_2.pdf",
        "colectivo": "funcionario",
    },
    {
        "etiqueta": "Gestión Administrativa (Técnico)",
        "url": f"{BASE}/sites/default/files/2026-07/TO_1.pdf",
        "colectivo": "funcionario",
    },
    {
        "etiqueta": "Ordenanza (Laboral Gr. V)",
        "url": f"{BASE}/sites/default/files/2026-07/bolsa%20ordenanza%20TO%2009-07-2026.pdf",
        "colectivo": "laboral",
    },
]


def norm(s: str) -> str:
    return RE_WS.sub(" ", unescape(s or "")).strip()


def quitar_acentos(texto: str) -> str:
    nfkd = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def slug_texto(texto: str) -> str:
    s = quitar_acentos(texto).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def fecha_iso(fecha_dmY: str) -> str | None:
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", fecha_dmY.strip())
    if not m:
        return None
    d, mo, y = m.groups()
    return f"{y}-{int(mo):02d}-{int(d):02d}"


def inferir_provincia(texto_enlace: str, url_pdf: str) -> str | None:
    texto = quitar_acentos(norm(texto_enlace)).lower()
    url = unquote(url_pdf).lower()

    for clave, nombre in PROVINCIAS_NOMBRE.items():
        if clave in texto:
            return nombre

    # Enlace genérico repetido (p. ej. "ADMINISTRACIÓN GENERAL") — inferir desde URL
    codigos_url = [
        (r"(?:^|[/_\-.])(?:ab|albacete)(?:[/_\-.]|\.pdf|\d)", "Albacete"),
        (r"(?:^|[/_\-.])(?:cr|ciudad[\s_-]?real)(?:[/_\-.]|\.pdf|\d)", "Ciudad Real"),
        (r"(?:^|[/_\-.])(?:cu|cuenca)(?:[/_\-.]|\.pdf|\d)", "Cuenca"),
        (r"(?:^|[/_\-.])(?:gu|gualajara|guadalajara)(?:[/_\-.]|\.pdf|\d)", "Guadalajara"),
        (r"(?:^|[/_\-.])(?:to|toledo)(?:[/_\-.]|\.pdf|\d)", "Toledo"),
        (r"\b(ab|cr|cu|gu|to)_\d", None),  # handled below
    ]
    for patron, nombre in codigos_url:
        if re.search(patron, url):
            if nombre:
                return nombre

    m = re.search(r"\b(ab|cr|cu|gu|to)_\d", url)
    if m:
        return {
            "ab": "Albacete",
            "cr": "Ciudad Real",
            "cu": "Cuenca",
            "gu": "Guadalajara",
            "to": "Toledo",
        }[m.group(1)]

    sufijos = {
        r"[_\-.]ab(?:[_.\s%]|\.pdf|$)": "Albacete",
        r"[_\-.]cr(?:[_.\s%]|\.pdf|$)": "Ciudad Real",
        r"[_\-.]cu(?:[_.\s%]|\.pdf|$)": "Cuenca",
        r"[_\-.]gu(?:[_.\s%]|\.pdf|$)": "Guadalajara",
        r"[_\-.]to(?:[_.\s%]|\.pdf|$)": "Toledo",
    }
    for patron, nombre in sufijos.items():
        if re.search(patron, url):
            return nombre

    return None


def es_pdf_listado(texto_enlace: str, url_pdf: str) -> bool:
    """Excluye normativa, anexos y formularios mezclados en algunas bolsas."""
    combinado = f"{texto_enlace} {unquote(url_pdf)}".upper()
    excluir = (
        "APERTURA DEL PLAZO",
        "ANEXO IV",
        "AUTOBAREMACI",
        "MODELO DE",
        "SOLICITUD DE",
        "FAQ ",
        "CONVENIO",
        "NORMATIVA",
    )
    return not any(x in combinado for x in excluir)


def parsear_titulo_bolsa(titulo: str) -> tuple[str | None, str | None]:
    """Devuelve (cuerpo_o_grupo, categoría) desde el título de página."""
    t = norm(titulo)
    t = re.sub(r"\s*\|\s*Portal.*$", "", t, flags=re.I)
    if " - " in t:
        izq, der = t.split(" - ", 1)
        return norm(izq), norm(der)
    return None, t


def detectar_sub_bolsa(linea: str) -> tuple[str | None, bool]:
    u = linea.upper()
    agotada = "AGOTADA" in u
    for patron, nombre in SUB_BOLSA_PATTERNS:
        if patron.search(linea):
            return nombre, agotada
    return None, False


def formatear_apellidos_nombre(ap1: str, ap2: str, nombre: str) -> str:
    ap1, ap2, nombre = norm(ap1), norm(ap2), norm(nombre)
    apellidos = " ".join(x for x in (ap1, ap2) if x)
    return f"{apellidos}, {nombre}" if apellidos and nombre else apellidos or nombre


def es_fila_cabecera(celdas: list[str | None]) -> bool:
    texto = " ".join(norm(c or "") for c in celdas).upper()
    return "APELLIDO" in texto or "ORDEN" in texto or "BOLSA" in texto and "NOMBRE" in texto


def parsear_fila_tabla(
    celdas: list[str | None],
    colectivo: str,
    sub_bolsa: str,
) -> dict | None:
    vals = [norm(c or "") for c in celdas if c is not None]
    if len(vals) < 4:
        return None
    if es_fila_cabecera(celdas):
        return None
    if not vals[0].isdigit():
        return None

    if colectivo == "laboral":
        if len(vals) < 5:
            return None
        num_bolsa, orden, ap1, ap2, nombre = vals[0], vals[1], vals[2], vals[3], vals[4]
    else:
        if len(vals) < 5:
            return None
        orden, num_bolsa, ap1, ap2, nombre = vals[0], vals[1], vals[2], vals[3], vals[4]

    if not orden.isdigit() or not num_bolsa.isdigit():
        return None

    return {
        "orden": int(orden),
        "apellidos_nombre": formatear_apellidos_nombre(ap1, ap2, nombre),
        "sub_bolsa": sub_bolsa,
        "num_bolsa": int(num_bolsa),
    }


def parsear_linea_datos(linea: str, colectivo: str, sub_bolsa: str) -> dict | None:
    linea = norm(linea)
    if not linea or re.search(r"P[áa]gina\s+\d+", linea, re.I):
        return None
    if "Listado de Aspirantes" in linea or "PORTAL DE EMPLEO" in linea.upper():
        return None
    if "Apellido" in linea and "Nombre" in linea:
        return None

    m = re.match(r"^(\d+)\s+(\d+)\s+(.+)$", linea)
    if not m:
        return None

    orden_s, num_s, resto = m.groups()
    tokens = resto.split()
    if len(tokens) < 2:
        return None

    # Nombre: desde el final; partículas comunes en nombres compuestos
    particulas_nombre = {"DE", "DEL", "LA", "LOS", "LAS", "Y", "DA", "DO"}
    idx = len(tokens)
    while idx > 1 and tokens[idx - 1].upper() in particulas_nombre:
        idx -= 1
    if idx <= 1:
        return None

    nombre = " ".join(tokens[idx - 1 :])
    ap_tokens = tokens[: idx - 1]
    if len(ap_tokens) >= 2:
        ap1, ap2 = ap_tokens[0], " ".join(ap_tokens[1:])
    else:
        ap1, ap2 = ap_tokens[0], ""

    return {
        "orden": int(orden_s),
        "apellidos_nombre": formatear_apellidos_nombre(ap1, ap2, nombre),
        "sub_bolsa": sub_bolsa,
        "num_bolsa": int(num_s),
    }


def parsear_pdf_bytes(contenido: bytes, colectivo: str) -> dict[str, list[dict]]:
    """Devuelve personas agrupadas por sub_bolsa."""
    sub_bolsas: dict[str, list[dict]] = {}
    agotadas: dict[str, bool] = {}
    sub_actual = "general" if colectivo == "laboral" else "sin_clasificar"
    vistos: set[tuple[int, int]] = set()

    def registrar(sub: str, persona: dict) -> None:
        clave = (persona["orden"], persona["num_bolsa"])
        if clave in vistos:
            return
        vistos.add(clave)
        sub_bolsas.setdefault(sub, []).append(persona)

    with pdfplumber.open(io.BytesIO(contenido)) as pdf:
        tablas_totales = 0
        for page in pdf.pages:
            page_tables = page.find_tables() or []
            tablas_totales += len(page_tables)

            for table_obj in page_tables:
                bbox = table_obj.bbox
                sub_tabla = sub_actual
                if bbox:
                    cabecera = page.crop((0, max(0, bbox[1] - 120), page.width, bbox[1]))
                    for linea in (cabecera.extract_text() or "").splitlines():
                        sub, agotada = detectar_sub_bolsa(linea)
                        if sub:
                            sub_tabla = sub
                            sub_actual = sub
                            if agotada:
                                agotadas[sub] = True

                for fila in table_obj.extract() or []:
                    if not fila:
                        continue
                    fila_txt = " ".join(norm(c or "") for c in fila)
                    sub_hdr, agotada = detectar_sub_bolsa(fila_txt)
                    if sub_hdr:
                        sub_tabla = sub_hdr
                        sub_actual = sub_hdr
                        if agotada:
                            agotadas[sub_tabla] = True
                        continue
                    if es_fila_cabecera(fila):
                        continue
                    persona = parsear_fila_tabla(fila, colectivo, sub_tabla)
                    if persona:
                        registrar(sub_tabla, persona)

        # Respaldo por líneas si el PDF no devolvió tablas
        if tablas_totales == 0:
            sub_actual = "general" if colectivo == "laboral" else "sin_clasificar"
            with pdfplumber.open(io.BytesIO(contenido)) as pdf:
                for page in pdf.pages:
                    for linea in (page.extract_text() or "").splitlines():
                        sub, agotada = detectar_sub_bolsa(linea)
                        if sub:
                            sub_actual = sub
                            if agotada:
                                agotadas[sub] = True
                            continue
                        persona = parsear_linea_datos(linea, colectivo, sub_actual)
                        if persona:
                            registrar(sub_actual, persona)

    resultado: dict[str, list[dict]] = {}
    for sub, personas in sub_bolsas.items():
        if personas:
            resultado[sub] = personas
    resultado["_agotadas"] = [{"sub_bolsa": k, "agotada": v} for k, v in agotadas.items()]
    return resultado


def limpiar_parseo(parseo: dict[str, list[dict]]) -> tuple[dict[str, list[dict]], dict[str, bool]]:
    agotadas = {x["sub_bolsa"]: x["agotada"] for x in parseo.pop("_agotadas", [])}
    limpio = {k: v for k, v in parseo.items() if v}
    return limpio, agotadas


@dataclass
class EntradaInventario:
    colectivo: str
    cuerpo: str | None
    grupo: str | None
    categoria: str
    slug_pagina: str
    url_pagina: str
    fecha_modificacion: str | None
    pdfs: list[dict] = field(default_factory=list)


class ClienteAdminCLM:
    def __init__(self) -> None:
        self.ses = requests.Session()
        self.ses.headers.update({"User-Agent": USER_AGENT, "Cache-Control": "no-cache"})

    def get(self, url: str) -> requests.Response:
        for intento in range(3):
            try:
                r = self.ses.get(url, timeout=60)
                if r.status_code in (429, 503):
                    time.sleep(2 * (intento + 1))
                    continue
                r.raise_for_status()
                r.encoding = r.apparent_encoding or "utf-8"
                return r
            except requests.RequestException:
                if intento == 2:
                    raise
                time.sleep(1.5 * (intento + 1))
        raise RuntimeError(f"No se pudo descargar {url}")

    def descargar_pdf(self, url: str) -> bytes:
        return self.get(url).content


def extraer_enlaces_indice(html: str, colectivo: str) -> list[str]:
    prefijo = f"/bolsas/personal-{colectivo}/"
    enlaces = RE_LINK_BOLSA.findall(html)
    out: list[str] = []
    vistos: set[str] = set()
    for href in enlaces:
        if not href.startswith(prefijo):
            continue
        slug = href[len(prefijo) :]
        if not slug or slug in vistos:
            continue
        vistos.add(slug)
        out.append(slug)
    return sorted(out)


def parsear_pagina_bolsa(html: str, colectivo: str, slug: str) -> EntradaInventario:
    plain = re.sub(r"<[^>]+>", " ", html)
    fecha_raw = RE_FECHA_MOD.search(plain)
    fecha_mod = fecha_iso(fecha_raw.group(1)) if fecha_raw else None

    h1 = RE_H1.search(html)
    titulo = norm(h1.group(1)) if h1 else slug
    cuerpo_o_grupo, categoria = parsear_titulo_bolsa(titulo)

    cuerpo = None
    grupo = None
    if colectivo == "funcionario":
        cuerpo = cuerpo_o_grupo
    else:
        grupo = cuerpo_o_grupo

    pdfs: list[dict] = []
    vistos_url: set[str] = set()
    for href, texto in RE_LINK_PDF.findall(html):
        url = urljoin(BASE, unescape(href))
        if url in vistos_url:
            continue
        if "/sites/default/files/" not in url.lower():
            continue
        if not es_pdf_listado(norm(re.sub(r"<[^>]+>", "", texto)), url):
            continue
        vistos_url.add(url)
        provincia = inferir_provincia(texto, url)
        pdfs.append(
            {
                "provincia": provincia,
                "url": url,
                "texto_enlace": norm(re.sub(r"<[^>]+>", "", texto)),
            }
        )

    return EntradaInventario(
        colectivo=colectivo,
        cuerpo=cuerpo,
        grupo=grupo,
        categoria=categoria or titulo,
        slug_pagina=slug,
        url_pagina=f"{BASE}/bolsas/personal-{colectivo}/{slug}",
        fecha_modificacion=fecha_mod,
        pdfs=pdfs,
    )


def inventario_a_dict(entry: EntradaInventario) -> dict:
    d = {
        "colectivo": entry.colectivo,
        "categoria": entry.categoria,
        "slug_pagina": entry.slug_pagina,
        "url_pagina": entry.url_pagina,
        "fecha_modificacion": entry.fecha_modificacion,
        "pdfs": entry.pdfs,
    }
    if entry.colectivo == "funcionario":
        d["cuerpo"] = entry.cuerpo
    else:
        d["grupo"] = entry.grupo
    return d


def ejecutar_inventario(cliente: ClienteAdminCLM) -> list[dict]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    catalogo: list[dict] = []

    for colectivo, index_url in (
        ("funcionario", INDEX_FUNCIONARIO),
        ("laboral", INDEX_LABORAL),
    ):
        print(f"\n=== Índice {colectivo}: {index_url} ===")
        html = cliente.get(index_url).text
        slugs = extraer_enlaces_indice(html, colectivo)
        print(f"  {len(slugs)} bolsas en índice")

        for i, slug in enumerate(slugs, 1):
            url = f"{BASE}/bolsas/personal-{colectivo}/{slug}"
            print(f"  [{i}/{len(slugs)}] {slug}")
            try:
                pagina = cliente.get(url).text
                entry = parsear_pagina_bolsa(pagina, colectivo, slug)
                catalogo.append(inventario_a_dict(entry))
            except requests.RequestException as exc:
                print(f"    ERROR: {exc}")
                catalogo.append(
                    {
                        "colectivo": colectivo,
                        "slug_pagina": slug,
                        "url_pagina": url,
                        "error": str(exc),
                    }
                )
            time.sleep(SLEEP_PAGINA)

    CATEGORIAS_PATH.write_text(
        json.dumps(catalogo, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nInventario guardado: {CATEGORIAS_PATH} ({len(catalogo)} entradas)")
    return catalogo


def cargar_inventario() -> list[dict]:
    if not CATEGORIAS_PATH.exists():
        raise SystemExit(f"No existe inventario. Ejecuta: python scraper_admin_clm.py --inventario")
    data = json.loads(CATEGORIAS_PATH.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    raise SystemExit("categorias.json debe ser una lista")


def filtrar_categorias(inventario: list[dict], nombre: str | None, todos: bool) -> list[dict]:
    validas = [c for c in inventario if not c.get("error")]
    if todos:
        return validas
    if not nombre:
        raise SystemExit('Indica --categoria "Nombre" o --todos')
    busqueda = quitar_acentos(nombre).lower()
    coincidencias = [
        c
        for c in validas
        if busqueda in quitar_acentos(c.get("categoria", "")).lower()
    ]
    if not coincidencias:
        raise SystemExit(f'Ninguna categoría coincide con "{nombre}"')
    return coincidencias


def guardar_provincia(
    cat: dict,
    pdf_info: dict,
    sub_bolsas: dict[str, list[dict]],
    agotadas: dict[str, bool],
) -> str:
    colectivo = cat["colectivo"]
    slug_cat = slug_texto(cat["categoria"])
    provincia = pdf_info.get("provincia") or "sin-provincia"
    slug_prov = slug_texto(provincia)

    dir_out = DATA_DIR / colectivo / slug_cat
    dir_out.mkdir(parents=True, exist_ok=True)
    path = dir_out / f"{slug_prov}.json"

    payload = {
        "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "fuente": {
            "pdf_url": pdf_info["url"],
            "portal": "Portal de Empleo Público de CLM",
            "fecha_modificacion_portal": cat.get("fecha_modificacion"),
        },
        "colectivo": colectivo,
        "categoria": cat["categoria"],
        "cuerpo": cat.get("cuerpo"),
        "grupo": cat.get("grupo"),
        "provincia": provincia,
        "sub_bolsas_agotadas": agotadas,
        "sub_bolsas": sub_bolsas,
        "total_personas": sum(len(v) for v in sub_bolsas.values()),
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return f"{colectivo}/{slug_cat}/{slug_prov}.json"


def actualizar_manifest(archivos: list[str]) -> None:
    existentes: set[str] = set(archivos)
    for colectivo in ("funcionario", "laboral"):
        base = DATA_DIR / colectivo
        if not base.is_dir():
            continue
        for path in base.rglob("*.json"):
            rel = path.relative_to(DATA_DIR).as_posix()
            existentes.add(rel)

    payload = {
        "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "sector": "admin-clm",
        "archivos": sorted(existentes),
    }
    MANIFEST_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def scrapear_categoria(
    cliente: ClienteAdminCLM,
    cat: dict,
    presupuesto: float | None,
) -> dict:
    inicio = time.time()
    etiqueta = cat["categoria"]
    print(f"\n=== {etiqueta} ({cat['colectivo']}) ===")

    pdfs = cat.get("pdfs") or []
    if not pdfs:
        print("  SKIP — sin PDFs en inventario")
        return {"categoria": etiqueta, "error": "sin_pdfs", "archivos": []}

    archivos: list[str] = []
    total_personas = 0

    for pdf_info in pdfs:
        if presupuesto and time.time() - inicio > presupuesto:
            print("  AVISO — presupuesto agotado")
            break

        url = pdf_info["url"]
        prov = pdf_info.get("provincia") or "?"
        print(f"  PDF {prov}: {url}")

        try:
            contenido = cliente.descargar_pdf(url)
        except requests.RequestException as exc:
            print(f"    ERROR descarga: {exc}")
            continue

        parseo_raw = parsear_pdf_bytes(contenido, cat["colectivo"])
        sub_bolsas, agotadas = limpiar_parseo(parseo_raw)
        n = sum(len(v) for v in sub_bolsas.values())
        total_personas += n
        subs = ", ".join(f"{k}({len(v)})" for k, v in sorted(sub_bolsas.items()))
        print(f"    OK {n} personas — sub-bolsas: {subs or 'ninguna'}")

        rel = guardar_provincia(cat, pdf_info, sub_bolsas, agotadas)
        archivos.append(rel)

        time.sleep(SLEEP_PAGINA)

    return {
        "categoria": etiqueta,
        "personas": total_personas,
        "archivos": archivos,
    }


def ejecutar_probar_parser(cliente: ClienteAdminCLM) -> None:
    print("\n=== Prueba de parser (3 PDFs) ===")
    for item in PDFS_PRUEBA:
        print(f"\n--- {item['etiqueta']} ---")
        contenido = cliente.descargar_pdf(item["url"])
        parseo_raw = parsear_pdf_bytes(contenido, item["colectivo"])
        sub_bolsas, agotadas = limpiar_parseo(parseo_raw)
        total = sum(len(v) for v in sub_bolsas.values())
        print(f"  Personas: {total}")
        for sub, personas in sorted(sub_bolsas.items()):
            ag = " [AGOTADA]" if agotadas.get(sub) else ""
            print(f"  - {sub}{ag}: {len(personas)}")
            if personas:
                muestra = personas[0]
                print(f"      ejemplo: orden={muestra['orden']} num_bolsa={muestra['num_bolsa']} {muestra['apellidos_nombre']}")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    p = argparse.ArgumentParser(description="Scraper Administración General CLM")
    p.add_argument("--inventario", action="store_true", help="Crawlear índice y generar categorias.json")
    p.add_argument("--categoria", help='Nombre de categoría (ej. "Administrativos")')
    p.add_argument("--todos", action="store_true", help="Scrapear todas las categorías del inventario")
    p.add_argument("--presupuesto", type=int, default=3600, help="Segundos máximos de ejecución")
    p.add_argument("--probar-parser", action="store_true", help="Verificar parser con 3 PDFs de muestra")
    args = p.parse_args()

    cliente = ClienteAdminCLM()
    inicio = time.time()

    if args.inventario:
        ejecutar_inventario(cliente)
        if not (args.todos or args.categoria or args.probar_parser):
            return

    if args.probar_parser:
        ejecutar_probar_parser(cliente)
        if not (args.todos or args.categoria):
            return

    if args.inventario or args.todos or args.categoria:
        inventario = cargar_inventario()
        objetivos = filtrar_categorias(inventario, args.categoria, args.todos)
        todos_archivos: list[str] = []
        resumenes = []

        for cat in objetivos:
            restante = None
            if args.presupuesto:
                restante = max(1, args.presupuesto - int(time.time() - inicio))
            res = scrapear_categoria(cliente, cat, restante)
            resumenes.append(res)
            todos_archivos.extend(res.get("archivos", []))

        if todos_archivos:
            actualizar_manifest(todos_archivos)

        print("\n=== RESUMEN ===")
        for r in resumenes:
            if r.get("error"):
                print(f"{r['categoria']}: ERROR {r['error']}")
            else:
                print(
                    f"{r['categoria']}: {r.get('personas', 0)} personas, "
                    f"{len(r.get('archivos', []))} archivos"
                )
        if todos_archivos:
            print(f"Manifest: {MANIFEST_PATH}")
        return

    p.print_help()


if __name__ == "__main__":
    main()
