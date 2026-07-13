#!/usr/bin/env python3
"""
Scraper de bolsas ordinarias (listado completo por puntuación) — Educación CLM.

Fuente distinta al scraper de «Aspirantes disponibles» (scraper_educacion_clm.py).
Descarga PDFs «Admitidos ordinaria {CUERPO}» / «Admitidos Cuerpo {CUERPO}» de la
renovación anual y genera JSON por especialidad en data/educacion-bolsa/.

Uso:
  python scraper_bolsa_ordinaria_educacion_clm.py --bolsa-ordinaria --cuerpo 0590
  python scraper_bolsa_ordinaria_educacion_clm.py --bolsa-ordinaria --cuerpo 0597
  python scraper_bolsa_ordinaria_educacion_clm.py --bolsa-ordinaria --cuerpo 0590 --pdf-url URL
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
from pathlib import Path
from urllib.parse import unquote, urljoin

import pdfplumber
import requests

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data" / "educacion-bolsa"
CATEGORIAS_EDUCACION = ROOT / "data" / "educacion" / "categorias.json"
MANIFEST_PATH = DATA_DIR / "manifest.json"
LOCAL_TMP = ROOT / "data" / "_local" / "educacion_bolsa_tmp"

USER_AGENT = "Interino-App/1.0 (contacto: fedebotija@gmail.com)"
BASE_EDUCACION = "https://educacion.castillalamancha.es"
BOLSAS_URL = f"{BASE_EDUCACION}/profesorado/bolsas-de-trabajo"

RENOVACION_SLUGS = (
    "procedimiento-de-renovacion-de-aspirantes-interinidades-y-solicitud-de-destinos-para-el-curso-1",
    "procedimiento-de-renovacion-de-aspirantes-interinidades-y-solicitud-de-destinos-para-el-curso",
)

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
RE_DNI = re.compile(r"\*{3}\d{4}\*{2}")
RE_PAGINA = re.compile(r"P[áa]gina\s+\d+", re.IGNORECASE)
RE_ESPECIALIDAD = re.compile(r"Especialidad\s+(\d{3})\s+(.+?)(?:\s+Tipo|\s*$)", re.IGNORECASE)
RE_CUERPO = re.compile(r"Cuerpo\s+(\d{4})\s+(.+?)(?:\s+Especialidad|\s+Tipo|\s*$)", re.IGNORECASE)
RE_CURSO = re.compile(r"PARA EL CURSO\s+(\d{4}/\d{4})", re.IGNORECASE)
RE_FECHA_RES = re.compile(r"(\d{1,2})\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{4})", re.IGNORECASE)
RE_PDF_HREF = re.compile(r"href=\s*([^\s>\"']+\.pdf[^\s>\"']*)", re.IGNORECASE)
MESES = {
    "enero": "01", "febrero": "02", "marzo": "03", "abril": "04",
    "mayo": "05", "junio": "06", "julio": "07", "agosto": "08",
    "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12",
}


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
    if codigo in ("0", "91"):
        return "ordinaria"
    if re.fullmatch(r"P\d+", codigo, re.I):
        return "ordinaria"
    if re.fullmatch(r"R\d+", codigo, re.I):
        return "reserva"
    return f"tipo-{codigo.lower()}"


def linea_ruido(linea: str) -> bool:
    if not linea or RE_PAGINA.search(linea):
        return True
    u = linea.upper()
    if "PORTAL DE EDUCACION" in u:
        return True
    if linea.startswith("Orden ") or "Apellidos, Nombre" in linea:
        return True
    if linea.startswith("Tipo") and "Orden" in linea:
        return True
    return False


def parsear_cola_dni(orden: int, dni: str, rest: str) -> dict | None:
    """Parsea cola tras DNI usando rsplit (soporta filas sin nombre)."""
    parts = rest.rsplit(None, 2)
    if len(parts) == 3:
        nombre, acceso, bolsa = parts
    elif len(parts) == 2:
        nombre, acceso, bolsa = "", parts[0], parts[1]
    else:
        return None
    bolsa = bolsa.strip()
    return {
        "orden": orden,
        "apellidos_nombre": nombre.strip(),
        "dni_parcial": dni,
        "acceso": int(acceso) if acceso.isdigit() else acceso,
        "bolsa_codigo": bolsa,
        "tipo_bolsa": tipo_bolsa_legible(bolsa),
        "bolsa_orden": orden,
    }


def parsear_fila_por_especialidad(linea: str) -> dict | None:
    linea = norm(linea)
    if linea_ruido(linea) or not RE_DNI.search(linea):
        return None
    m = re.match(r"^(\d+)\s+(\*{3}\d{4}\*{2})\s+(.*)$", linea)
    if not m:
        return None
    return parsear_cola_dni(int(m.group(1)), m.group(2), m.group(3))


def parsear_fila_multi_especialidad(linea: str) -> dict | None:
    linea = norm(linea)
    if linea_ruido(linea) or not RE_DNI.search(linea):
        return None
    m = re.match(r"^(\d+)\s+(\*{3}\d{4}\*{2})\s+(.*)$", linea)
    if not m:
        return None
    orden, dni, rest = int(m.group(1)), m.group(2), m.group(3)
    parts = rest.rsplit(None, 3)
    if len(parts) == 4:
        nombre, acceso, bolsa, esps = parts
    elif len(parts) == 3 and re.search(r"\d{3}", parts[2]):
        nombre, acceso, bolsa, esps = "", parts[0], parts[1], parts[2]
    else:
        return None
    codes = [c.strip() for c in esps.split(",") if re.fullmatch(r"\d{3}", c.strip())]
    if not codes:
        return None
    return {
        "orden": orden,
        "apellidos_nombre": nombre.strip(),
        "dni_parcial": dni,
        "acceso": int(acceso) if acceso.isdigit() else acceso,
        "bolsa_codigo": bolsa.strip(),
        "tipo_bolsa": tipo_bolsa_legible(bolsa.strip()),
        "bolsa_orden": orden,
        "especialidades_codigos": codes,
    }


@dataclass
class EspecialidadParseada:
    codigo: str
    nombre: str
    personas: list[dict] = field(default_factory=list)


def extraer_meta(texto: str, codigo_cuerpo: str) -> dict:
    meta: dict = {
        "cuerpo_codigo": codigo_cuerpo,
        "cuerpo_nombre": None,
        "curso": None,
        "fecha_resolucion": None,
        "formato": None,
    }
    for linea in texto.splitlines():
        linea = norm(linea)
        m_c = RE_CUERPO.search(linea)
        if m_c and m_c.group(1) == codigo_cuerpo:
            meta["cuerpo_nombre"] = norm(m_c.group(2))
        m_curso = RE_CURSO.search(linea)
        if m_curso:
            meta["curso"] = m_curso.group(1)
        m_f = RE_FECHA_RES.search(linea)
        if m_f:
            dd, mes, yyyy = m_f.groups()
            meta["fecha_resolucion"] = f"{dd.zfill(2)}/{MESES[mes.lower()]}/{yyyy}"
    u = texto.upper()
    if "ESPECIALIDADES ANTERIORES A LA LOGSE" in u:
        meta["formato"] = "por_especialidad_logse_antigua"
    elif RE_ESPECIALIDAD.search(texto):
        meta["formato"] = "por_especialidad"
    elif "ACCESO ESPECIALIDADES" in u.replace("Ó", "O").replace("ó", "o"):
        meta["formato"] = "multi_especialidad"
    return meta


def detectar_formato(contenido: bytes, codigo_cuerpo: str) -> str:
    with pdfplumber.open(io.BytesIO(contenido)) as pdf:
        muestra = "\n".join((pdf.pages[i].extract_text() or "") for i in range(min(3, len(pdf.pages))))
    meta = extraer_meta(muestra, codigo_cuerpo)
    if meta.get("formato"):
        return meta["formato"]
    if codigo_cuerpo == "0597":
        return "multi_especialidad"
    return "por_especialidad"


def parsear_pdf_por_especialidad(
    contenido: bytes, codigo_cuerpo: str
) -> tuple[dict, dict[str, EspecialidadParseada]]:
    meta: dict = {"cuerpo_codigo": codigo_cuerpo}
    especialidades: dict[str, EspecialidadParseada] = {}
    esp_actual: EspecialidadParseada | None = None
    texto_acum = ""

    with pdfplumber.open(io.BytesIO(contenido)) as pdf:
        for page in pdf.pages:
            texto = page.extract_text() or ""
            texto_acum += texto + "\n"
            for linea in texto.splitlines():
                linea = norm(linea)
                if not linea:
                    continue
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
                fila = parsear_fila_por_especialidad(linea)
                if fila:
                    esp_actual.personas.append(fila)

    meta.update(extraer_meta(texto_acum, codigo_cuerpo))
    return meta, especialidades


def mapa_nombres_especialidad(cuerpo: dict) -> dict[str, str]:
    out: dict[str, str] = {}
    for item in cuerpo.get("especialidades", []):
        m = re.match(r"(\d{3})\s+(.+)", item)
        if m:
            out[m.group(1)] = norm(m.group(2))
    return out


def parsear_pdf_multi_especialidad(
    contenido: bytes, codigo_cuerpo: str, cuerpo: dict
) -> tuple[dict, dict[str, EspecialidadParseada], dict]:
    meta: dict = {"cuerpo_codigo": codigo_cuerpo}
    especialidades: dict[str, EspecialidadParseada] = {}
    nombres = mapa_nombres_especialidad(cuerpo)
    texto_acum = ""
    stats = {"filas_ok": 0, "filas_sin_especialidad": 0}

    with pdfplumber.open(io.BytesIO(contenido)) as pdf:
        for page in pdf.pages:
            texto = page.extract_text() or ""
            texto_acum += texto + "\n"
            for linea in texto.splitlines():
                fila = parsear_fila_multi_especialidad(linea)
                if not fila:
                    if RE_DNI.search(linea or "") and not linea_ruido(norm(linea)):
                        stats["filas_sin_especialidad"] += 1
                    continue
                stats["filas_ok"] += 1
                base = {k: v for k, v in fila.items() if k != "especialidades_codigos"}
                for cod in fila["especialidades_codigos"]:
                    esp = especialidades.get(cod)
                    if not esp:
                        esp = EspecialidadParseada(codigo=cod, nombre=nombres.get(cod, f"ESPECIALIDAD {cod}"))
                        especialidades[cod] = esp
                    esp.personas.append(dict(base))

    meta.update(extraer_meta(texto_acum, codigo_cuerpo))
    return meta, especialidades, stats


def construir_indice_busqueda(especialidad: EspecialidadParseada, cuerpo: dict) -> dict:
    personas_idx = []
    for p in especialidad.personas:
        apellidos = (
            p["apellidos_nombre"].split(",")[0].strip()
            if "," in p["apellidos_nombre"]
            else p["apellidos_nombre"]
        )
        personas_idx.append({
            "nombreCompleto": p["apellidos_nombre"],
            "dniParcial": p["dni_parcial"],
            "apellidos": apellidos,
            "orden": p["orden"],
            "bolsa_orden": p["bolsa_orden"],
            "tipo_bolsa": p["tipo_bolsa"],
            "acceso": p.get("acceso"),
            "bolsa_codigo": p.get("bolsa_codigo"),
        })
    return {
        "cuerpo": cuerpo["codigo"],
        "cuerpo_nombre": cuerpo.get("nombre"),
        "especialidad_codigo": especialidad.codigo,
        "especialidad_nombre": especialidad.nombre,
        "tipo_listado": "bolsa_ordinaria",
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
            "tipo": "bolsa_ordinaria",
            "pdf_url": pdf_url,
            "fecha_resolucion": meta_pdf.get("fecha_resolucion"),
            "curso": meta_pdf.get("curso"),
            "formato_pdf": meta_pdf.get("formato"),
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
    existentes.update(a for a in archivos if not a.endswith(".busqueda.json"))
    for dir_cuerpo in DATA_DIR.iterdir():
        if not dir_cuerpo.is_dir():
            continue
        for f in dir_cuerpo.glob("*.json"):
            if f.name.endswith(".busqueda.json"):
                continue
            existentes.add(f"{dir_cuerpo.name}/{f.name}")

    payload = {
        "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "sector": "educacion",
        "tipo": "bolsa_ordinaria",
        "archivos": sorted(existentes),
    }
    MANIFEST_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


class ClienteBolsaOrdinaria:
    def __init__(self) -> None:
        self.ses = requests.Session()
        self.ses.headers.update({"User-Agent": USER_AGENT})

    def get(self, url: str, timeout: int = 120, **kwargs) -> requests.Response:
        for intento in range(3):
            try:
                r = self.ses.get(url, timeout=timeout, **kwargs)
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

    def descubrir_pdf(self, codigo_cuerpo: str) -> str | None:
        """Busca el PDF de admitidos ordinaria/cuerpo más reciente en páginas de renovación."""
        mejor: tuple[str, str] | None = None
        patrones = [
            re.compile(
                rf"Admitidos(?:%20|\s)ordinaria(?:%20|\s){codigo_cuerpo}(?:%20|\s)(?:especialidades(?:%20|\s)anteriores(?:%20|\s)a(?:%20|\s)LOGSE(?:%20|\s))?(\d{{8}})\.pdf",
                re.I,
            ),
            re.compile(
                rf"(\d{{8}})(?:%20|\s)Admitidos(?:%20|\s)Cuerpo(?:%20|\s){codigo_cuerpo}(?:\.pdf|(?:%20|\s)[^.]*\.pdf)",
                re.I,
            ),
        ]

        paginas = [f"{BOLSAS_URL}/{slug}" for slug in RENOVACION_SLUGS]
        for pagina in paginas:
            try:
                html = self.get(pagina, timeout=45).text
            except requests.RequestException:
                continue
            for m in RE_PDF_HREF.finditer(html):
                href = unquote(m.group(1).split("?")[0])
                nombre = href.split("/")[-1]
                if codigo_cuerpo not in nombre:
                    continue
                if "admitid" not in nombre.lower():
                    continue
                if "excluid" in nombre.lower():
                    continue
                # Maestros LOGSE: evitar PDF de especialidades antiguas salvo que no haya otro
                es_logse_antigua = "logse" in nombre.lower()
                fecha = None
                for pat in patrones:
                    fm = pat.search(href.replace("%20", " "))
                    if fm:
                        fecha = fm.group(1)
                        break
                if not fecha:
                    fm = re.search(r"(\d{8})", nombre)
                    fecha = fm.group(1) if fm else "00000000"
                url = urljoin(BASE_EDUCACION, href)
                if codigo_cuerpo == "0597" and es_logse_antigua:
                    continue
                if not mejor or fecha > mejor[0]:
                    mejor = (fecha, url)

        if mejor:
            return mejor[1]

        # Fallback conocido
        fallbacks = {
            "0590": f"{BASE_EDUCACION}/sites/default/files/2026-06/Admitidos%20ordinaria%200590%2020260622.pdf",
            "0597": f"{BASE_EDUCACION}/sites/default/files/2025-06/20250624%20Admitidos%20Cuerpo%200597.pdf",
        }
        return fallbacks.get(codigo_cuerpo)

    def descargar_pdf(self, url: str, destino: Path) -> Path:
        destino.parent.mkdir(parents=True, exist_ok=True)
        r = self.get(url)
        destino.write_bytes(r.content)
        return destino


def cargar_cuerpos_objetivo(codigo: str | None) -> list[dict]:
    if not CATEGORIAS_EDUCACION.exists():
        raise SystemExit(f"No existe inventario: {CATEGORIAS_EDUCACION}")
    data = json.loads(CATEGORIAS_EDUCACION.read_text(encoding="utf-8"))
    cuerpos = data.get("cuerpos", [])
    if codigo:
        for c in cuerpos:
            if c["codigo"] == codigo:
                return [c]
        raise SystemExit(f"Cuerpo desconocido: {codigo}")
    raise SystemExit("Indica --cuerpo CODE")


def scrapear_cuerpo(
    cliente: ClienteBolsaOrdinaria,
    cuerpo: dict,
    pdf_url: str | None,
    formato: str | None,
) -> dict:
    codigo = cuerpo["codigo"]
    print(f"\n=== Bolsa ordinaria — Cuerpo {codigo} — {cuerpo.get('nombre', '')} ===")

    url = pdf_url or cliente.descubrir_pdf(codigo)
    if not url:
        print(f"ERROR  No se encontró PDF de bolsa ordinaria para {codigo}")
        return {"cuerpo": codigo, "error": "sin_pdf", "archivos": []}

    print(f"PDF  {url}")
    LOCAL_TMP.mkdir(parents=True, exist_ok=True)
    pdf_local = LOCAL_TMP / f"ordinaria_{codigo}.pdf"
    cliente.descargar_pdf(url, pdf_local)
    print(f"OK   Descargado {pdf_local.stat().st_size // 1024} KB")

    contenido = pdf_local.read_bytes()
    fmt = formato or detectar_formato(contenido, codigo)
    print(f"OK   Formato detectado: {fmt}")

    stats_extra: dict = {}
    if fmt == "multi_especialidad":
        meta, especialidades, stats_extra = parsear_pdf_multi_especialidad(contenido, codigo, cuerpo)
    else:
        meta, especialidades = parsear_pdf_por_especialidad(contenido, codigo)

    print(f"OK   {len(especialidades)} especialidades detectadas")
    if stats_extra:
        print(
            f"     Filas parseadas: {stats_extra.get('filas_ok', 0)} | "
            f"sin especialidad en PDF: {stats_extra.get('filas_sin_especialidad', 0)}"
        )

    archivos: list[str] = []
    total_personas = 0
    for cod_esp, esp in sorted(especialidades.items()):
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
        "formato": fmt,
        "curso": meta.get("curso"),
        "fecha_resolucion": meta.get("fecha_resolucion"),
        "especialidades": len([e for e in especialidades.values() if e.personas]),
        "personas_entradas": total_personas,
        "stats": stats_extra,
        "archivos": archivos,
    }


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    p = argparse.ArgumentParser(description="Scraper Educación CLM — bolsa ordinaria (listado completo)")
    p.add_argument("--bolsa-ordinaria", action="store_true", help="Modo bolsa ordinaria (requerido)")
    p.add_argument("--cuerpo", help="Código de cuerpo (ej. 0590, 0597)")
    p.add_argument("--pdf-url", help="URL del PDF (opcional, salta descubrimiento)")
    p.add_argument(
        "--formato",
        choices=("por_especialidad", "multi_especialidad", "auto"),
        default="auto",
        help="Formato del PDF (auto detecta por defecto)",
    )
    args = p.parse_args()

    if not args.bolsa_ordinaria:
        raise SystemExit("Indica --bolsa-ordinaria para ejecutar este scraper.")

    if not args.cuerpo:
        raise SystemExit("Indica --cuerpo (ej. 0590 o 0597).")

    cuerpos = cargar_cuerpos_objetivo(args.cuerpo)
    cliente = ClienteBolsaOrdinaria()
    formato = None if args.formato == "auto" else args.formato

    resumenes = []
    todos_archivos: list[str] = []
    for cuerpo in cuerpos:
        res = scrapear_cuerpo(cliente, cuerpo, args.pdf_url, formato)
        resumenes.append(res)
        todos_archivos.extend(res.get("archivos", []))

    actualizar_manifest(todos_archivos)

    print("\n=== RESUMEN BOLSA ORDINARIA ===")
    for r in resumenes:
        if r.get("error"):
            print(f"{r['cuerpo']}: ERROR {r['error']}")
        else:
            print(
                f"{r['cuerpo']}: curso {r.get('curso')} | {r.get('especialidades', 0)} especialidades | "
                f"{r.get('personas_entradas', 0)} entradas | formato {r.get('formato')}"
            )
    print(f"Salida: {DATA_DIR}")
    print(f"Manifest: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
