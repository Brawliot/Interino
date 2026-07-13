#!/usr/bin/env python3
"""
Scraper de listados de interinos docentes — Educación CLM.

Descarga PDFs «Aspirantes disponibles {CUERPO} {FECHA}.pdf», parsea especialidades
y guarda JSON por especialidad en data/educacion/{cuerpo}/.

Uso:
  python scraper_educacion_clm.py --cuerpo 0597 --presupuesto 3600
  python scraper_educacion_clm.py --cuerpo 0590 --presupuesto 3600
  python scraper_educacion_clm.py --todos --presupuesto 7200
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote, urljoin

import pdfplumber
import requests

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data" / "educacion"
CATEGORIAS_PATH = DATA_DIR / "categorias.json"
MANIFEST_PATH = DATA_DIR / "manifest.json"
LOCAL_TMP = ROOT / "data" / "_local" / "educacion_tmp"

USER_AGENT = "Interino-App/1.0 (contacto: fedebotija@gmail.com)"
BASE_EDUCACION = "https://educacion.castillalamancha.es"
BOLSAS_URL = f"{BASE_EDUCACION}/profesorado/bolsas-de-trabajo"

# Slug de carpeta por código de cuerpo
CUERPO_SLUG: dict[str, str] = {
    "0597": "maestros",
    "0590": "secundaria",
    "0591": "tecnicos-fp",
    "0592": "eoii",
    "0593": "catedraticos-musica",
    "0594": "profesores-musica",
    "0595": "artes-plasticas",
    "0596": "maestros-taller",
    "0598": "fp-singulares",
}

RE_WS = re.compile(r"\s+")
RE_ESPECIALIDAD = re.compile(r"Especialidad\s+(\d{3})\s+(.+?)(?:\s+Tipo|\s*$)", re.IGNORECASE)
RE_CUERPO = re.compile(r"CUERPO\s*-\s*(\d{4})\s*-\s*(.+?)(?:\s+FECHA|\s*$)", re.IGNORECASE)
RE_FECHA_PUB = re.compile(r"FECHA\s+PUBLICACI[ÓO]N:\s*(\d{2}/\d{2}/\d{4})", re.IGNORECASE)
RE_FILA = re.compile(
    r"^(\d+)\s+(\*{3}\d{4}\*{2})\s+(.+?)\s+(\d{1,3})\s+(\d+)\s+(.+)$"
)
RE_DNI = re.compile(r"\*{3}\d{4}\*{2}")
RE_PAGINA = re.compile(r"P[áa]gina\s+\d+", re.IGNORECASE)
RE_ADJUDICACION = re.compile(r'href="(/profesorado/bolsas-de-trabajo/adjudicacion-del-dia-[^"]+)"', re.I)


def norm(s: str) -> str:
    return RE_WS.sub(" ", (s or "").strip())


def quitar_acentos(texto: str) -> str:
    nfkd = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def slug_texto(texto: str) -> str:
    s = quitar_acentos(texto).lower()
    s = s.replace(":", " ")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def slug_especialidad(codigo: str, nombre: str) -> str:
    return slug_texto(f"{codigo}-{nombre}")


def tipo_bolsa_legible(codigo: str) -> str:
    return "ordinaria" if codigo == "91" else "reserva" if codigo == "0" else f"tipo-{codigo}"


def parse_provincias_idiomas(cola: str) -> tuple[list[str], dict[str, bool]]:
    idiomas = {"ingles": False, "frances": False, "aleman": False, "italiano": False}
    provincias = re.findall(r"\b(\d{2})\b", cola)
    # Letras sueltas al final (marcadores de idioma en el PDF)
    letras = re.findall(r"(?<!\w)([A-Za-z])(?!\w)", cola)
    for ch in letras:
        u = ch.upper()
        if u in ("I", "S", "E"):
            idiomas["ingles"] = True
        elif u == "F":
            idiomas["frances"] = True
        elif u == "A":
            idiomas["aleman"] = True
        elif u == "T":
            idiomas["italiano"] = True
    return provincias, idiomas


def parsear_fila(linea: str) -> dict | None:
    linea = norm(linea)
    if not linea or RE_PAGINA.search(linea):
        return None
    if "PORTAL DE EDUCACION" in linea.upper():
        return None
    if linea.startswith("Orden ") or "Apellidos, Nombre" in linea:
        return None
    if not RE_DNI.search(linea):
        return None

    m = RE_FILA.match(linea)
    if not m:
        return None

    orden, dni, nombre, tipo_cod, bolsa_orden, cola = m.groups()
    provincias, idiomas = parse_provincias_idiomas(cola)
    return {
        "orden": int(orden),
        "apellidos_nombre": nombre.strip(),
        "dni_parcial": dni,
        "tipo_bolsa": tipo_bolsa_legible(tipo_cod),
        "tipo_bolsa_codigo": tipo_cod,
        "bolsa_orden": int(bolsa_orden),
        "provincias": provincias,
        "idiomas": idiomas,
    }


@dataclass
class EspecialidadParseada:
    codigo: str
    nombre: str
    personas: list[dict] = field(default_factory=list)


class ClienteEducacion:
    def __init__(self) -> None:
        self.ses = requests.Session()
        self.ses.headers.update({"User-Agent": USER_AGENT})

    def get(self, url: str, **kwargs) -> requests.Response:
        for intento in range(3):
            try:
                r = self.ses.get(url, timeout=45, **kwargs)
                if r.status_code in (429, 503):
                    time.sleep(2 * (intento + 1))
                    continue
                r.raise_for_status()
                return r
            except requests.RequestException:
                if intento == 2:
                    raise
                time.sleep(1.5 * (intento + 1))
        raise RuntimeError(f"No se pudo descargar {url}")

    def descubrir_urls_adjudicaciones(self, max_paginas: int = 12) -> list[str]:
        html = self.get(BOLSAS_URL).text
        links = RE_ADJUDICACION.findall(html)
        urls = [urljoin(BASE_EDUCACION, unquote(l)) for l in links]
        # dedupe preservando orden
        vistos: set[str] = set()
        out: list[str] = []
        for u in urls:
            if u not in vistos:
                vistos.add(u)
                out.append(u)
        return out[:max_paginas]

    def descubrir_pdf_mas_reciente(self, codigo_cuerpo: str) -> str | None:
        """Busca el PDF «Aspirantes disponibles {codigo} {fecha}» más reciente en adjudicaciones."""
        mejor: tuple[str, str] | None = None  # (fecha YYYYMMDD, url)
        patron = re.compile(
            rf'/sites/default/files/[^"\']*Aspirantes(?:%20|\s)disponibles(?:%20|\s){codigo_cuerpo}(?:%20|\s)(\d{{8}})\.pdf',
            re.IGNORECASE,
        )

        for pagina in self.descubrir_urls_adjudicaciones():
            try:
                html = self.get(pagina).text
            except requests.RequestException:
                continue
            for m in patron.finditer(html):
                fecha = m.group(1)
                url = urljoin(BASE_EDUCACION, m.group(0))
                if not mejor or fecha > mejor[0]:
                    mejor = (fecha, url)

        if mejor:
            return mejor[1]

        cat = cargar_inventario().get(codigo_cuerpo)
        if cat and cat.get("ejemplo_pdf_url"):
            return cat["ejemplo_pdf_url"]
        return None

    def descargar_pdf(self, url: str, destino: Path) -> Path:
        destino.parent.mkdir(parents=True, exist_ok=True)
        r = self.get(url)
        destino.write_bytes(r.content)
        return destino


def cargar_inventario() -> dict[str, dict]:
    if not CATEGORIAS_PATH.exists():
        return {}
    data = json.loads(CATEGORIAS_PATH.read_text(encoding="utf-8"))
    return {c["codigo"]: c for c in data.get("cuerpos", [])}


def cargar_cuerpos_objetivo(codigo: str | None, todos: bool) -> list[dict]:
    data = json.loads(CATEGORIAS_PATH.read_text(encoding="utf-8"))
    cuerpos = data.get("cuerpos", [])
    if todos:
        return cuerpos
    if codigo:
        for c in cuerpos:
            if c["codigo"] == codigo:
                return [c]
        raise SystemExit(f"Cuerpo desconocido: {codigo}")
    raise SystemExit("Indica --cuerpo CODE o --todos")


def parsear_pdf_bytes(contenido: bytes, codigo_cuerpo: str) -> tuple[dict, dict[str, EspecialidadParseada]]:
    meta: dict = {"cuerpo_codigo": codigo_cuerpo, "cuerpo_nombre": None, "fecha_publicacion": None}
    especialidades: dict[str, EspecialidadParseada] = {}
    esp_actual: EspecialidadParseada | None = None

    with pdfplumber.open(io.BytesIO(contenido)) as pdf:
        for page in pdf.pages:
            texto = page.extract_text() or ""
            for linea in texto.splitlines():
                linea = norm(linea)
                if not linea:
                    continue

                m_cuerpo = RE_CUERPO.search(linea)
                if m_cuerpo and m_cuerpo.group(1) == codigo_cuerpo:
                    meta["cuerpo_nombre"] = norm(m_cuerpo.group(2))

                m_fecha = RE_FECHA_PUB.search(linea)
                if m_fecha:
                    meta["fecha_publicacion"] = m_fecha.group(1)

                m_esp = RE_ESPECIALIDAD.search(linea)
                if m_esp:
                    cod = m_esp.group(1)
                    nombre = norm(m_esp.group(2))
                    esp_actual = especialidades.get(cod)
                    if not esp_actual:
                        esp_actual = EspecialidadParseada(codigo=cod, nombre=nombre)
                        especialidades[cod] = esp_actual
                    continue

                if esp_actual is None:
                    continue

                fila = parsear_fila(linea)
                if fila:
                    esp_actual.personas.append(fila)

    return meta, especialidades


def construir_indice_busqueda(especialidad: EspecialidadParseada, cuerpo: dict) -> dict:
    personas_idx = []
    for p in especialidad.personas:
        apellidos = p["apellidos_nombre"].split(",")[0].strip() if "," in p["apellidos_nombre"] else p["apellidos_nombre"]
        personas_idx.append({
            "nombreCompleto": p["apellidos_nombre"],
            "dniParcial": p["dni_parcial"],
            "apellidos": apellidos,
            "orden": p["orden"],
            "bolsa_orden": p["bolsa_orden"],
            "provincias": p["provincias"],
            "tipo_bolsa": p["tipo_bolsa"],
        })
    return {
        "cuerpo": cuerpo["codigo"],
        "cuerpo_nombre": cuerpo.get("nombre"),
        "especialidad_codigo": especialidad.codigo,
        "especialidad_nombre": especialidad.nombre,
        "personas": personas_idx,
    }


def guardar_especialidad(
    cuerpo: dict,
    esp: EspecialidadParseada,
    meta_pdf: dict,
    pdf_url: str,
) -> tuple[str, str]:
    slug_cuerpo = CUERPO_SLUG.get(cuerpo["codigo"], slug_texto(cuerpo.get("nombre") or cuerpo["codigo"]))
    dir_out = DATA_DIR / slug_cuerpo
    dir_out.mkdir(parents=True, exist_ok=True)

    fname = slug_especialidad(esp.codigo, esp.nombre) + ".json"
    path = dir_out / fname

    payload = {
        "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "fuente": {
            "pdf_url": pdf_url,
            "fecha_publicacion_pdf": meta_pdf.get("fecha_publicacion"),
            "portal": "Educación Castilla-La Mancha",
        },
        "cuerpo_codigo": cuerpo["codigo"],
        "cuerpo_nombre": meta_pdf.get("cuerpo_nombre") or cuerpo.get("nombre"),
        "especialidad_codigo": esp.codigo,
        "especialidad_nombre": esp.nombre,
        "personas": esp.personas,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    idx_path = dir_out / (slug_especialidad(esp.codigo, esp.nombre) + ".busqueda.json")
    idx_path.write_text(
        json.dumps(construir_indice_busqueda(esp, cuerpo), ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    rel = f"{slug_cuerpo}/{fname}"
    rel_idx = f"{slug_cuerpo}/{idx_path.name}"
    return rel, rel_idx


def actualizar_manifest(archivos: list[str]) -> None:
    existentes: set[str] = set()
    if MANIFEST_PATH.exists():
        try:
            existentes = set(json.loads(MANIFEST_PATH.read_text(encoding="utf-8")).get("archivos", []))
        except json.JSONDecodeError:
            pass
    existentes.update(archivos)
    # regenerar desde disco por si hay restos
    for dir_cuerpo in DATA_DIR.iterdir():
        if not dir_cuerpo.is_dir():
            continue
        for f in dir_cuerpo.glob("*.json"):
            if f.name.endswith(".busqueda.json") or f.name == "categorias.json":
                continue
            existentes.add(f"{dir_cuerpo.name}/{f.name}")

    payload = {
        "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "sector": "educacion",
        "archivos": sorted(existentes),
    }
    MANIFEST_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def scrapear_cuerpo(cliente: ClienteEducacion, cuerpo: dict, presupuesto: float | None) -> dict:
    codigo = cuerpo["codigo"]
    inicio = time.time()
    print(f"\n=== Cuerpo {codigo} — {cuerpo.get('nombre', '')} ===")

    url = cliente.descubrir_pdf_mas_reciente(codigo)
    if not url:
        print(f"ERROR  No se encontró PDF para cuerpo {codigo}")
        return {"cuerpo": codigo, "error": "sin_pdf", "archivos": []}

    print(f"PDF  {url}")
    LOCAL_TMP.mkdir(parents=True, exist_ok=True)
    pdf_local = LOCAL_TMP / f"aspirantes_{codigo}.pdf"
    cliente.descargar_pdf(url, pdf_local)
    print(f"OK   Descargado {pdf_local.stat().st_size // 1024} KB")

    if presupuesto and time.time() - inicio > presupuesto:
        return {"cuerpo": codigo, "error": "presupuesto_agotado", "archivos": []}

    contenido = pdf_local.read_bytes()
    meta, especialidades = parsear_pdf_bytes(contenido, codigo)
    print(f"OK   {len(especialidades)} especialidades detectadas")

    archivos: list[str] = []
    total_personas = 0
    for cod_esp, esp in sorted(especialidades.items()):
        if presupuesto and time.time() - inicio > presupuesto:
            print("AVISO Presupuesto agotado — paro aquí.")
            break
        if not esp.personas:
            print(f"SKIP {esp.codigo} {esp.nombre} (0 personas)")
            continue
        rel, rel_idx = guardar_especialidad(cuerpo, esp, meta, url)
        archivos.extend([rel, rel_idx])
        total_personas += len(esp.personas)
        print(f"OK   {esp.codigo} {esp.nombre}: {len(esp.personas)} personas -> {rel}")

    return {
        "cuerpo": codigo,
        "pdf_url": url,
        "especialidades": len(especialidades),
        "personas": total_personas,
        "archivos": archivos,
    }


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    p = argparse.ArgumentParser(description="Scraper Educación CLM — PDFs de aspirantes disponibles")
    p.add_argument("--cuerpo", help="Código de cuerpo (ej. 0597, 0590)")
    p.add_argument("--todos", action="store_true", help="Scrapear todos los cuerpos del inventario")
    p.add_argument("--presupuesto", type=int, default=3600, help="Segundos máximos por ejecución")
    args = p.parse_args()

    if not CATEGORIAS_PATH.exists():
        raise SystemExit(f"No existe inventario: {CATEGORIAS_PATH}")

    cuerpos = cargar_cuerpos_objetivo(args.cuerpo, args.todos)
    cliente = ClienteEducacion()
    inicio = time.time()
    todos_archivos: list[str] = []
    resumenes = []

    for cuerpo in cuerpos:
        restante = None
        if args.presupuesto:
            restante = max(1, args.presupuesto - int(time.time() - inicio))
        res = scrapear_cuerpo(cliente, cuerpo, restante)
        resumenes.append(res)
        todos_archivos.extend(res.get("archivos", []))
        time.sleep(1.0)

    actualizar_manifest([a for a in todos_archivos if not a.endswith(".busqueda.json")])

    print("\n=== RESUMEN ===")
    for r in resumenes:
        if r.get("error"):
            print(f"{r['cuerpo']}: ERROR {r['error']}")
        else:
            print(
                f"{r['cuerpo']}: {r.get('especialidades', 0)} especialidades, "
                f"{r.get('personas', 0)} personas, {len(r.get('archivos', []))} archivos"
            )
    print(f"Manifest: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
