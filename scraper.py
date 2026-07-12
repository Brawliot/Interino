"""
Scraper del listado de bolsa del SESCAM (Castilla-La Mancha).

CONFIRMADO CON UN PDF REAL (ENFERMERO/A - GAI Cuenca - Vigesima
Convocatoria 2025) que la tabla tiene estas columnas:

  ORDEN | APELLIDOS Y NOMBRE | DNI (****1234X) | AUTOBAR | COMPROBADO
  BAREMO | G.P | Larga TC | Larga TP | Corta TC | Corta TP | C.U. TC | C.U. TP

Los PDFs se obtienen consultando el formulario web del SESCAM (Drupal,
formulario sescam_baremo_bolsa_form): POST a la misma URL de baremos del
grupo con categoria, gerencia y (si aplica) ambito. No hay endpoint AJAX
JSON separado; el navegador recarga la pagina via POST al cambiar cada
desplegable.

IMPORTANTE - honestidad sobre lo que este dato representa:
El PDF es el listado de ADMITIDOS en la bolsa (ordenado por puntuacion),
NO un listado de "quien ha sido llamado". Por tanto, lo que guardamos en
el historico como "punto_minimo" es la puntuacion mas baja actualmente
admitida en la lista, que sirve como indicador de tendencia, pero NO es
literalmente "el punto de corte del ultimo llamamiento". La app tiene que
dejar esto claro, no presentarlo como si fuera lo mismo.
"""

import io
import os
import re
import time
import json
import argparse
import unicodedata
from datetime import datetime
from html import unescape

import requests
import pdfplumber
from dataclasses import dataclass, asdict, field

# ---------------------------------------------------------------
# CONFIGURACION
# ---------------------------------------------------------------

BASE_BAREMOS = (
    "https://sanidad.castillalamancha.es/profesionales/atencion-al-profesional/"
    "bolsas-constituidas/baremos/"
)
GRUPOS_PORTAL_SLUG = {
    "diplomado": "personal-sanitario-diplomado",
    "facultativo": "personal-facultativo",
    "licenciados": "personal-sanitario-licenciados",
    "tecnico": "personal-sanitario-tecnico",
    "gestion": "personal-de-gestion-y-servicios",
}

USER_AGENT = "Mozilla/5.0 (compatible; ListasApp/0.2; +fedebotija@gmail.com)"
REQUEST_HEADERS = {"User-Agent": USER_AGENT, "Cache-Control": "no-cache"}
PDF_TIMEOUT_SEG = 180
PDF_REINTENTOS = 3
PDF_BACKOFF_SEG = (5, 15, 30)

# Ajustar cuando cambie la convocatoria (hoy: 20a, año 2025)
CATEGORIAS_SANIDAD_DIPLOMADO = [
    "DIETISTA-NUTRICIONISTA",
    "ENFERMERO/A",
    "ENFERMERO/A DE EMERGENCIAS",
    "ENFERMERO/A ESPECIALISTA DEL TRABAJO",
    "ENFERMERO/A ESPECIALISTA EN ENF. FAMILIAR Y COMUNITARIA",
    "ENFERMERO/A ESPECIALISTA EN ENF. GERIATRICA",
    "ENFERMERO/A ESPECIALISTA EN ENF. PEDIATRICA",
    "ENFERMERO/A ESPECIALISTA EN SALUD MENTAL",
    "ENFERMERO/A ESPECIALISTA OBSTETRICIO - GINECOLOGICA (MATRONA)",
    "ENFERMERO/A INSPECTOR/A DE SERVICIOS SANITARIOS Y PRESTACIONES",
    "ENFERMERO/A P.E.A.C.",
    "FISIOTERAPEUTA",
    "LOGOPEDA",
    "OPTICO/A OPTOMETRISTA",
    "PODOLOGO/A",
    "TERAPEUTA OCUPACIONAL",
]

GERENCIAS = [
    "Gerencia de Atencion Integrada de Albacete",
    "Gerencia de Atencion Integrada de Alcazar de San Juan",
    "Gerencia de Atencion Integrada de Almansa",
    "Gerencia de Atencion Integrada de Ciudad Real",
    "Gerencia de Atencion Integrada de Cuenca",
    "Gerencia de Atencion Integrada de Guadalajara",
    "Gerencia de Atencion Integrada de Hellin",
    "Gerencia de Atencion Integrada de Manzanares",
    "Gerencia de Atencion Integrada de Puertollano",
    "Gerencia de Atencion Integrada de Talavera de la Reina",
    "Gerencia de Atencion Integrada de Tomelloso",
    "Gerencia de Atencion Integrada de Valdepeñas",
    "Gerencia de Atencion Integrada de Villarrobledo",
    "Gerencia de Atencion Primaria de Toledo",
    "Gerencia de Atencion Especializada de Toledo",
    "Gerencia del Hospital Nacional de Paraplejicos",
]

AMBITOS = ["Atencion Primaria", "Atencion Especializada"]

# data/public/ = espejo R2 (copiar su contenido a la raíz del bucket interino-data)
# data/_local/ = logs, vigía, informes (no subir a R2)
DATA_ROOT = "data"
PUBLIC_DATA_DIR = os.path.join(DATA_ROOT, "public")
LOCAL_DATA_DIR = os.path.join(DATA_ROOT, "_local")
LOCAL_LOGS_DIR = os.path.join(LOCAL_DATA_DIR, "logs")
DATA_DIR = PUBLIC_DATA_DIR


def public_path(*parts: str) -> str:
    return os.path.join(PUBLIC_DATA_DIR, *parts)


def local_path(*parts: str) -> str:
    return os.path.join(LOCAL_DATA_DIR, *parts)


HISTORICO_PATH = public_path("historico.json")
MANIFEST_PATH = public_path("manifest.json")
CATEGORIAS_JSON = public_path("categorias_por_grupo.json")
LATEST_PATH = public_path("latest.json")  # legacy; migrar y borrar

GRUPOS = {
    "diplomado": CATEGORIAS_SANIDAD_DIPLOMADO,
    "gestion": [],
    "tecnico": [],
    "licenciados": [],
    "facultativo": [],
}


def quitar_acentos(texto: str) -> str:
    """El SESCAM nombra los ficheros sin acentos (Atencion, Vigesima...)."""
    nfkd = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def slug_categoria(categoria: str) -> str:
    """ENFERMERO/A -> ENFERMERO_A (confirmado con el PDF real)."""
    return categoria.replace("/", "_").replace(" ", "_")


def _normalizar_clave(texto: str) -> str:
    t = quitar_acentos(texto).upper().strip()
    return re.sub(r"\s+", " ", t)


def normalizar_gerencia_guardada(gerencia: str) -> str:
    """Nombre canónico en JSON: sin tildes, coherente con listados antiguos."""
    return quitar_acentos(gerencia).strip()


def _coincide_etiqueta(opciones: dict[str, str], buscada: str) -> str | None:
    """Devuelve la clave real del <select> que coincide con la etiqueta buscada."""
    w = _normalizar_clave(buscada)
    for etiqueta in opciones:
        if _normalizar_clave(etiqueta) == w:
            return etiqueta
    for etiqueta in opciones:
        if w in _normalizar_clave(etiqueta):
            return etiqueta
    return None


def _variantes_gerencia(gerencia: str, ambito: str) -> list[str]:
    """Algunas gerencias AE/AP tienen nombre distinto en el portal (p. ej. Toledo)."""
    variantes = [gerencia]
    if "Primaria de Toledo" in gerencia and "Especializada" in ambito:
        variantes.append("Gerencia de Atencion Especializada de Toledo")
    return variantes


@dataclass
class _SesionCategoria:
    html: str
    cat_id: str
    categoria: str


@dataclass
class ResultadoListado:
    filas: list["FilaBaremo"]
    estado: str  # ok | sin_pdf | sin_gerencia | 404 | timeout | error
    url: str | None = None


def _log_listado(categoria: str, gerencia: str, ambito: str, estado: str, url: str | None, filas: int = 0):
    prefijos = {
        "ok": "OK",
        "sin_pdf": "SIN PDF",
        "sin_gerencia": "SIN GERENCIA",
        "404": "404",
        "timeout": "TIMEOUT",
        "error": "ERROR",
    }
    pref = prefijos.get(estado, estado.upper())
    extra = f" -> {filas} filas" if estado == "ok" else ""
    print(f"{pref}  {categoria} · {gerencia} · {ambito}{extra}")
    if url and estado != "ok":
        print(f"      {url[:100]}")


class ClienteFormularioBaremo:
    """
    Replica el formulario web de baremos del SESCAM para obtener URLs reales de PDF.

    Endpoint: POST a la URL de baremos del grupo (una por grupo profesional).
    Mismo mecanismo para diplomado, tecnico, licenciados y gestion.
    """

    def __init__(self, grupo: str):
        if grupo not in GRUPOS_PORTAL_SLUG:
            raise ValueError(f"Grupo desconocido: {grupo}")
        self.grupo = grupo
        self.page_url = BASE_BAREMOS + GRUPOS_PORTAL_SLUG[grupo]
        self.session = requests.Session()

    def _get(self) -> str:
        r = self.session.get(self.page_url, headers=REQUEST_HEADERS, timeout=45)
        r.raise_for_status()
        r.encoding = r.apparent_encoding or "utf-8"
        return r.text

    def _post(self, data: dict) -> str:
        r = self.session.post(
            self.page_url,
            data=data,
            headers={**REQUEST_HEADERS, "Referer": self.page_url},
            timeout=45,
        )
        r.raise_for_status()
        r.encoding = r.apparent_encoding or "utf-8"
        return r.text

    @staticmethod
    def _chunk_baremo(html: str) -> str:
        idx = html.find("sescam-baremo-bolsa-form")
        return html[idx : idx + 16000] if idx >= 0 else ""

    def _tokens(self, html: str) -> tuple[str, str]:
        chunk = self._chunk_baremo(html)
        fb = re.search(r'name="form_build_id"[^>]*value="([^"]+)"', chunk)
        fid = re.search(r'name="form_id"[^>]*value="([^"]+)"', chunk)
        if not fb or not fid:
            raise ValueError("No se encontraron tokens del formulario baremo")
        return fb.group(1), fid.group(1)

    def _opciones_select(self, html: str, nombre: str) -> dict[str, str]:
        chunk = self._chunk_baremo(html)
        m = re.search(rf'name="{nombre}"[^>]*>(.*?)</select>', chunk, re.I | re.S)
        if not m:
            return {}
        out: dict[str, str] = {}
        for valor, texto in re.findall(
            r'<option[^>]*value="([^"]*)"[^>]*>(.*?)</option>', m.group(1), re.I | re.S
        ):
            etiqueta = unescape(re.sub(r"<[^>]+>", "", texto)).strip()
            if valor and valor != "0":
                out[etiqueta] = valor
        return out

    @staticmethod
    def _urls_pdf(html: str) -> list[str]:
        urls = []
        for href in re.findall(r'href="([^"]*selecta-pdfs[^"]+\.pdf)"', html, re.I):
            urls.append(unescape(href))
        return list(dict.fromkeys(urls))

    @staticmethod
    def _elegir_pdf(urls: list[str], ambito: str) -> str | None:
        if not urls:
            return None
        amb = _normalizar_clave(ambito)
        candidatas = [u for u in urls if "DISCAPACIDAD" not in u.upper()]
        for url in candidatas:
            if amb in _normalizar_clave(url):
                return url
        return candidatas[0] if candidatas else urls[0]

    def iniciar_categoria(self, categoria: str) -> _SesionCategoria:
        """GET + POST categoria (una vez por categoria scrapeada)."""
        html = self._get()
        fb, fid = self._tokens(html)
        opciones = self._opciones_select(html, "categoria")
        etiqueta = _coincide_etiqueta(opciones, categoria)
        if not etiqueta:
            raise ValueError(f"Categoria no encontrada en portal: {categoria}")
        cat_id = opciones[etiqueta]
        html = self._post({
            "categoria": cat_id,
            "form_build_id": fb,
            "form_id": fid,
        })
        return _SesionCategoria(html=html, cat_id=cat_id, categoria=categoria)

    def renovar_tras_post(self, html_respuesta: str, cat_id: str) -> str:
        """Vuelve al estado 'categoria elegida' sin GET (tokens del ultimo POST)."""
        fb, fid = self._tokens(html_respuesta)
        return self._post({
            "categoria": cat_id,
            "form_build_id": fb,
            "form_id": fid,
        })

    def _post_gerencia(self, html_estado: str, cat_id: str, gerencia_id: str) -> str:
        fb, fid = self._tokens(html_estado)
        return self._post({
            "categoria": cat_id,
            "gerencia": gerencia_id,
            "form_build_id": fb,
            "form_id": fid,
        })

    def _id_gerencia_en_html(self, html_estado: str, gerencia: str) -> tuple[str, str] | None:
        gerencias = self._opciones_select(html_estado, "gerencia")
        candidatas = list(_variantes_gerencia(gerencia, "Atencion Primaria"))
        candidatas += [g for g in _variantes_gerencia(gerencia, "Atencion Especializada") if g not in candidatas]
        for nombre in candidatas:
            etiqueta = _coincide_etiqueta(gerencias, nombre)
            if etiqueta:
                return etiqueta, gerencias[etiqueta]
        return None

    def pdfs_por_gerencia(self, sesion: _SesionCategoria, gerencia: str) -> tuple[dict[str, str], str]:
        """
        Un POST de gerencia; devuelve mapa ambito->url y html tras el POST (para renovar).
        """
        match = self._id_gerencia_en_html(sesion.html, gerencia)
        if not match:
            return {}, sesion.html

        _, ger_id = match
        html_g = self._post_gerencia(sesion.html, sesion.cat_id, ger_id)
        urls = self._urls_pdf(html_g)
        por_ambito: dict[str, str] = {}

        for amb in AMBITOS:
            u = self._elegir_pdf(urls, amb)
            if u:
                por_ambito[amb] = u

        if not por_ambito:
            fb2, fid2 = self._tokens(html_g)
            ambitos_op = self._opciones_select(html_g, "ambito")
            if ambitos_op:
                for etiqueta_a, amb_id in ambitos_op.items():
                    html_a = self._post({
                        "categoria": sesion.cat_id,
                        "gerencia": ger_id,
                        "ambito": amb_id,
                        "form_build_id": fb2,
                        "form_id": fid2,
                    })
                    for amb in AMBITOS:
                        u = self._elegir_pdf(self._urls_pdf(html_a), amb)
                        if u:
                            por_ambito[amb] = u
                    html_g = html_a

        return por_ambito, html_g

    def url_pdf_en_sesion(
        self, sesion: _SesionCategoria, gerencia: str, ambito: str
    ) -> tuple[str | None, str]:
        """
        Resuelve URL del PDF para una gerencia/ambito.
        Devuelve (url o None, html tras el POST de gerencia para renovar sesion).
        """
        html_estado = sesion.html
        gerencias = self._opciones_select(html_estado, "gerencia")

        for gerencia_buscar in _variantes_gerencia(gerencia, ambito):
            etiqueta_g = _coincide_etiqueta(gerencias, gerencia_buscar)
            if not etiqueta_g:
                continue

            html_g = self._post_gerencia(html_estado, sesion.cat_id, gerencias[etiqueta_g])
            url = self._elegir_pdf(self._urls_pdf(html_g), ambito)
            if url:
                return url, html_g

            fb2, fid2 = self._tokens(html_g)
            ambitos_op = self._opciones_select(html_g, "ambito")
            if ambitos_op:
                etiqueta_a = _coincide_etiqueta(ambitos_op, ambito) or next(iter(ambitos_op))
                html_a = self._post({
                    "categoria": sesion.cat_id,
                    "gerencia": gerencias[etiqueta_g],
                    "ambito": ambitos_op[etiqueta_a],
                    "form_build_id": fb2,
                    "form_id": fid2,
                })
                url = self._elegir_pdf(self._urls_pdf(html_a), ambito)
                if url:
                    return url, html_a
            return None, html_g

        return None, html_estado

    def resolver_url_pdf(self, categoria: str, gerencia: str, ambito: str) -> str | None:
        """Atajo para una sola consulta (no reutiliza sesion entre gerencias)."""
        try:
            sesion = self.iniciar_categoria(categoria)
            url, _ = self.url_pdf_en_sesion(sesion, gerencia, ambito)
            return url
        except (requests.exceptions.RequestException, ValueError):
            return None


_clientes_portal: dict[str, ClienteFormularioBaremo] = {}


def cliente_portal(grupo: str) -> ClienteFormularioBaremo:
    if grupo not in _clientes_portal:
        _clientes_portal[grupo] = ClienteFormularioBaremo(grupo)
    return _clientes_portal[grupo]


@dataclass
class FilaBaremo:
    orden: int
    apellidos_nombre: str
    dni_parcial: str            # ej. "****9660C"
    comprobado_baremo: float    # esto es "puntos" en el resto de la app
    grupo_preferente: bool
    tipos_contrato: dict = field(default_factory=dict)  # {"Larga TC.": True, ...}
    categoria: str = ""
    gerencia: str = ""
    ambito: str = ""


COLUMNAS_CONTRATO = ["Larga TC.", "Larga TP.", "Corta TC.", "Corta TP.", "C.U. TC.", "C.U. TP."]


def parsear_pdf(contenido: bytes, categoria: str, gerencia: str, ambito: str) -> list[FilaBaremo]:
    """Extrae la tabla real usando pdfplumber.extract_table() (el PDF confirmado
    tiene lineas de rejilla, asi que la extraccion por tabla es fiable)."""
    filas = []
    with pdfplumber.open(io.BytesIO(contenido)) as pdf:
        for pagina in pdf.pages:
            tabla = pagina.extract_table()
            if not tabla:
                continue
            for fila in tabla:
                fila = [c.strip() if c else "" for c in fila]
                if not fila or not fila[0].isdigit():
                    continue  # cabecera o fila que no encaja
                try:
                    orden = int(fila[0])
                    nombre = fila[1]
                    dni = fila[2]
                    # AUTOBAR = fila[3], normalmente "----", no se usa
                    baremo = float(fila[4].replace(".", "").replace(",", "."))
                    gp = fila[5].strip().upper() == "X"
                    contrato = {col: (fila[6 + i].strip().upper() == "X")
                                for i, col in enumerate(COLUMNAS_CONTRATO)
                                if 6 + i < len(fila)}
                except (ValueError, IndexError):
                    continue
                filas.append(FilaBaremo(
                    orden=orden, apellidos_nombre=nombre, dni_parcial=dni,
                    comprobado_baremo=baremo, grupo_preferente=gp,
                    tipos_contrato=contrato, categoria=categoria,
                    gerencia=normalizar_gerencia_guardada(gerencia), ambito=ambito,
                ))
    return filas


def descargar_pdf(url: str) -> tuple[bytes | None, str]:
    """Descarga con reintentos y backoff. Devuelve (contenido, estado)."""
    estado = "error"
    for intento in range(PDF_REINTENTOS):
        try:
            resp = requests.get(url, headers=REQUEST_HEADERS, timeout=PDF_TIMEOUT_SEG)
            if resp.status_code == 404:
                return None, "404"
            resp.raise_for_status()
            return resp.content, "ok"
        except requests.exceptions.Timeout:
            estado = "timeout"
        except requests.exceptions.RequestException:
            estado = "error"
        if intento < PDF_REINTENTOS - 1:
            time.sleep(PDF_BACKOFF_SEG[min(intento, len(PDF_BACKOFF_SEG) - 1)])
    return None, estado


def resolver_url_pdf(categoria: str, gerencia: str, ambito: str, grupo: str = "diplomado") -> str | None:
    try:
        return cliente_portal(grupo).resolver_url_pdf(categoria, gerencia, ambito)
    except (requests.exceptions.RequestException, ValueError):
        return None


def obtener_listado_detalle(
    categoria: str,
    gerencia: str,
    ambito: str,
    grupo: str = "diplomado",
    cliente: ClienteFormularioBaremo | None = None,
    sesion: _SesionCategoria | None = None,
) -> ResultadoListado:
    """Resuelve URL, descarga y parsea. Una sola pasada por el formulario."""
    try:
        cli = cliente or cliente_portal(grupo)
        ses = sesion or cli.iniciar_categoria(categoria)
        url, html_tras = cli.url_pdf_en_sesion(ses, gerencia, ambito)

        if not url:
            hay_gerencia = cli._id_gerencia_en_html(ses.html, gerencia) is not None
            estado = "sin_gerencia" if not hay_gerencia else "sin_pdf"
            _log_listado(categoria, gerencia, ambito, estado, None)
            return ResultadoListado([], estado)

        contenido, estado_dl = descargar_pdf(url)
        if estado_dl != "ok":
            _log_listado(categoria, gerencia, ambito, estado_dl, url)
            return ResultadoListado([], estado_dl, url)

        filas = parsear_pdf(contenido, categoria, gerencia, ambito)
        _log_listado(categoria, gerencia, ambito, "ok", url, len(filas))
        return ResultadoListado(filas, "ok", url)

    except (requests.exceptions.RequestException, ValueError) as e:
        print(f"ERROR  {categoria} · {gerencia} · {ambito} -> {e}")
        return ResultadoListado([], "error")


def obtener_listado(
    categoria: str,
    gerencia: str,
    ambito: str,
    grupo: str = "diplomado",
    cliente: ClienteFormularioBaremo | None = None,
    sesion: _SesionCategoria | None = None,
) -> list[FilaBaremo]:
    return obtener_listado_detalle(
        categoria, gerencia, ambito, grupo=grupo, cliente=cliente, sesion=sesion
    ).filas


def scrapear_todo(categorias=CATEGORIAS_SANIDAD_DIPLOMADO, gerencias=GERENCIAS,
                   ambitos=AMBITOS, grupo: str = "diplomado", pausa=1.5,
                   presupuesto_segundos=35 * 60) -> dict:
    """Devuelve un unico dict con la foto completa de hoy. Nada de tuplas raras:
    todo lo que hace falta para guardar y para resumir esta aqui dentro.

    presupuesto_segundos: si se supera, para de forma ordenada y devuelve lo
    que ya tiene -- mejor un resultado parcial guardado que uno completo que
    nunca llega a escribirse porque Actions mata el job a media ejecucion."""
    inicio = time.time()
    resultado = {"generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"), "listados": []}
    for categoria in categorias:
        for gerencia in gerencias:
            for ambito in ambitos:
                if time.time() - inicio > presupuesto_segundos:
                    print(f"\nPresupuesto de tiempo agotado ({presupuesto_segundos}s) -- paro aqui con lo que hay.")
                    return resultado
                try:
                    filas = obtener_listado(categoria, gerencia, ambito, grupo=grupo)
                    if not filas:
                        continue
                    resultado["listados"].append({
                        "categoria": categoria, "gerencia": gerencia, "ambito": ambito,
                        "filas": [asdict(f) for f in filas],
                    })
                    print(f"OK  {categoria} · {gerencia} · {ambito} -> {len(filas)} filas")
                except Exception as e:
                    print(f"ERROR  {categoria} · {gerencia} · {ambito} -> {e}")
                time.sleep(pausa)
    return resultado


def slug_archivo(categoria: str) -> str:
    """Nombre de fichero JSON: minúsculas, sin tildes, espacios → guiones."""
    s = quitar_acentos(categoria).lower()
    s = s.replace("/", "-")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def path_categoria_json(grupo: str, categoria: str) -> str:
    return os.path.join(DATA_DIR, grupo, slug_archivo(categoria) + ".json")


def path_indice_busqueda_json(grupo: str, categoria: str) -> str:
    return os.path.join(DATA_DIR, grupo, slug_archivo(categoria) + ".busqueda.json")


def _gerencia_corta(gerencia_completa: str) -> str:
    if not gerencia_completa:
        return ""
    if "Primaria de Toledo" in gerencia_completa:
        return "Toledo"
    if "Especializada de Toledo" in gerencia_completa:
        return "Toledo AE"
    prefijo = "Gerencia de Atencion Integrada de "
    if gerencia_completa.startswith(prefijo):
        return gerencia_completa[len(prefijo):]
    return gerencia_completa


def _formatear_nombre(apellidos_nombre: str) -> str:
    return re.sub(r"\s+", " ", apellidos_nombre.replace("\n", " ")).strip()


def construir_indice_busqueda(listados: list[dict], categoria: str) -> dict:
    """Índice compacto para búsqueda por apellidos/DNI sin cargar el JSON completo."""
    gerencias = sorted({
        _gerencia_corta(b["gerencia"]) for b in listados if b.get("gerencia")
    }, key=lambda x: x.lower())
    por_persona: dict[str, dict] = {}

    for bloque in listados:
        total = len(bloque.get("filas") or [])
        g = _gerencia_corta(bloque.get("gerencia", ""))
        ambito = bloque.get("ambito", "")
        for fila in bloque.get("filas") or []:
            clave = fila.get("dni_parcial") or _formatear_nombre(fila.get("apellidos_nombre", ""))
            nombre_completo = _formatear_nombre(fila.get("apellidos_nombre", ""))
            apellidos = nombre_completo.split(",")[0].strip() if "," in nombre_completo else nombre_completo
            aparicion = {
                "gerencia": g,
                "ambito": ambito,
                "posicion": fila.get("orden"),
                "total": total,
                "puntos": fila.get("comprobado_baremo"),
                "delante": max(0, (fila.get("orden") or 1) - 1),
                "tiposContrato": fila.get("tipos_contrato") or {},
            }
            if clave not in por_persona:
                por_persona[clave] = {
                    "nombreCompleto": nombre_completo,
                    "dniParcial": fila.get("dni_parcial", ""),
                    "apellidos": apellidos,
                    "apariciones": [],
                }
            por_persona[clave]["apariciones"].append(aparicion)

    return {
        "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "categoria": categoria,
        "gerencias": gerencias,
        "personas": list(por_persona.values()),
    }


def guardar_indice_busqueda(grupo: str, categoria: str, listados: list[dict]) -> str:
    path = path_indice_busqueda_json(grupo, categoria)
    payload = construir_indice_busqueda(listados, categoria)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Indice busqueda {path} -> {len(payload['personas'])} personas")
    return path


def cargar_categorias_desde_inventario() -> dict[str, list[str]]:
    """Lee data/categorias_por_grupo.json (generado por scripts/inventario_categorias.py)."""
    if not os.path.exists(CATEGORIAS_JSON):
        return {"diplomado": CATEGORIAS_SANIDAD_DIPLOMADO}
    with open(CATEGORIAS_JSON, "r", encoding="utf-8") as f:
        raw = json.load(f)
    out = {}
    for grupo, info in raw.items():
        pdfs = info.get("categorias_pdf") or []
        if pdfs:
            out[grupo] = pdfs
    if "diplomado" not in out:
        out["diplomado"] = CATEGORIAS_SANIDAD_DIPLOMADO
    return out


def gerencias_de_categoria(cliente: ClienteFormularioBaremo, sesion: _SesionCategoria,
                           gerencias_fallback: list[str] | None = None) -> list[str]:
    """Gerencias del portal tras elegir categoría (p. ej. central URGENCIAS o Coordinación e Inspección)."""
    del_portal = list(cliente._opciones_select(sesion.html, "gerencia").keys())
    if del_portal:
        return del_portal
    return list(gerencias_fallback or GERENCIAS)


def clave_listado(gerencia: str, ambito: str) -> tuple[str, str]:
    return (_normalizar_clave(gerencia), ambito)


def claves_listados(listados: list[dict]) -> set[tuple[str, str]]:
    return {clave_listado(l["gerencia"], l["ambito"]) for l in listados}


def pares_portal_faltantes(cliente: ClienteFormularioBaremo, sesion: _SesionCategoria,
                           existentes: list[dict]) -> list[tuple[str, str]]:
    """Pares (gerencia, ámbito) del portal sin listado guardado."""
    claves = claves_listados(existentes)
    faltan: list[tuple[str, str]] = []
    for gerencia in gerencias_de_categoria(cliente, sesion):
        for ambito in AMBITOS:
            if clave_listado(gerencia, ambito) not in claves:
                faltan.append((gerencia, ambito))
    return faltan


def gerencias_portal_faltantes(cliente: ClienteFormularioBaremo, sesion: _SesionCategoria,
                               existentes: list[dict]) -> list[str]:
    """Gerencias del portal con al menos un ámbito sin listado guardado."""
    vistos: dict[str, None] = {}
    for gerencia, _ in pares_portal_faltantes(cliente, sesion, existentes):
        vistos[gerencia] = None
    return list(vistos.keys())


def scrapear_listados_pares(
    categoria: str,
    grupo: str,
    pares_objetivo: list[tuple[str, str]],
    sesion: _SesionCategoria | None = None,
    html_estado: str | None = None,
    pausa: float = 1.5,
) -> tuple[list[dict], _SesionCategoria, str]:
    """Descarga listados solo para los pares gerencia+ámbito indicados."""
    from collections import defaultdict

    cliente = ClienteFormularioBaremo(grupo)
    if sesion is None:
        sesion = cliente.iniciar_categoria(categoria)
    if html_estado is None:
        html_estado = sesion.html

    por_gerencia: dict[str, set[str]] = defaultdict(set)
    for gerencia, ambito in pares_objetivo:
        por_gerencia[gerencia].add(ambito)

    nuevos: list[dict] = []
    for gerencia, ambitos_necesarios in por_gerencia.items():
        sesion.html = html_estado
        try:
            pdfs, html_tras = cliente.pdfs_por_gerencia(sesion, gerencia)
        except (requests.exceptions.RequestException, ValueError) as e:
            print(f"ERROR  {categoria} · {gerencia} -> {e}")
            continue

        gerencia_norm = normalizar_gerencia_guardada(gerencia)
        if not pdfs:
            for ambito in sorted(ambitos_necesarios):
                estado = "sin_gerencia" if not cliente._id_gerencia_en_html(html_estado, gerencia) else "sin_pdf"
                _log_listado(categoria, gerencia_norm, ambito, estado, None)
            continue

        urls_descargadas: set[str] = set()
        for ambito in sorted(ambitos_necesarios):
            url = pdfs.get(ambito)
            if not url:
                _log_listado(categoria, gerencia_norm, ambito, "sin_pdf", None)
                continue
            if url in urls_descargadas:
                continue

            contenido, estado = descargar_pdf(url)
            if estado != "ok":
                _log_listado(categoria, gerencia_norm, ambito, estado, url)
                continue

            filas = parsear_pdf(contenido, categoria, gerencia_norm, ambito)
            if filas:
                nuevos.append({
                    "categoria": categoria,
                    "gerencia": gerencia_norm,
                    "ambito": ambito,
                    "filas": [asdict(f) for f in filas],
                })
            urls_descargadas.add(url)
            _log_listado(categoria, gerencia_norm, ambito, "ok", url, len(filas))
            time.sleep(pausa)

        try:
            html_estado = cliente.renovar_tras_post(html_tras, sesion.cat_id)
        except (requests.exceptions.RequestException, ValueError) as e:
            print(f"AVISO  Renovacion de sesion tras {gerencia}: {e}")
            sesion = cliente.iniciar_categoria(categoria)
            html_estado = sesion.html

    return nuevos, sesion, html_estado


def scrapear_listados_gerencias(
    categoria: str,
    grupo: str,
    gerencias_objetivo: list[str],
    sesion: _SesionCategoria | None = None,
    html_estado: str | None = None,
    pausa: float = 1.5,
) -> tuple[list[dict], _SesionCategoria, str]:
    """Descarga todos los ámbitos faltantes por gerencia (compatibilidad)."""
    pares = [(g, a) for g in gerencias_objetivo for a in AMBITOS]
    return scrapear_listados_pares(
        categoria, grupo, pares, sesion=sesion, html_estado=html_estado, pausa=pausa
    )


def normalizar_gerencias_en_listados(listados: list[dict]) -> list[dict]:
    """Unifica nombres de gerencia en bloques y filas (sin borrar datos)."""
    for bloque in listados:
        g = normalizar_gerencia_guardada(bloque.get("gerencia", ""))
        bloque["gerencia"] = g
        for fila in bloque.get("filas") or []:
            fila["gerencia"] = g
    return listados


def fusionar_listados(existentes: list[dict], nuevos: list[dict]) -> tuple[list[dict], list[dict]]:
    """Añade listados nuevos sin sobrescribir gerencia+ámbito ya presentes."""
    claves = claves_listados(existentes)
    anadidos = []
    for bloque in nuevos:
        k = clave_listado(bloque["gerencia"], bloque["ambito"])
        if k in claves:
            continue
        anadidos.append(bloque)
        claves.add(k)
    return existentes + anadidos, anadidos


def completar_gerencias_categoria(grupo: str, categoria: str, pausa: float = 1.5) -> dict:
    """
    Añade al JSON existente las gerencias/ámbitos que faltan según el portal.
    No re-descarga listados ya guardados.
    """
    path = path_categoria_json(grupo, categoria)
    if not os.path.exists(path):
        return {"categoria": categoria, "grupo": grupo, "error": "sin_json", "personas_anadidas": 0}

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    existentes = data.get("listados") or []

    cliente = ClienteFormularioBaremo(grupo)
    try:
        sesion = cliente.iniciar_categoria(categoria)
    except (requests.exceptions.RequestException, ValueError) as e:
        return {"categoria": categoria, "grupo": grupo, "error": str(e), "personas_anadidas": 0}

    existentes = normalizar_gerencias_en_listados(existentes)
    pares = pares_portal_faltantes(cliente, sesion, existentes)
    if not pares:
        return {
            "categoria": categoria, "grupo": grupo, "gerencias_anadidas": 0,
            "listados_anadidos": 0, "personas_anadidas": 0,
        }

    print(f"Completar {grupo}/{categoria}: {len(pares)} par(es) gerencia+ambito pendientes")
    nuevos, _, _ = scrapear_listados_pares(
        categoria, grupo, pares, sesion=sesion, html_estado=sesion.html, pausa=pausa
    )
    merged, anadidos = fusionar_listados(existentes, nuevos)
    if not anadidos and existentes != (data.get("listados") or []):
        data["listados"] = merged
        data["generado"] = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        guardar_indice_busqueda(grupo, categoria, merged)
        return {
            "categoria": categoria, "grupo": grupo, "gerencias_anadidas": 0,
            "listados_anadidos": 0, "personas_anadidas": 0, "nota": "solo_normalizacion",
        }
    if not anadidos:
        return {
            "categoria": categoria, "grupo": grupo, "gerencias_anadidas": 0,
            "listados_anadidos": 0, "personas_anadidas": 0,
        }

    data["listados"] = merged
    data["generado"] = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    personas = sum(len(l["filas"]) for l in anadidos)
    print(f"Actualizado {path} -> +{len(anadidos)} listas, +{personas} personas")
    guardar_indice_busqueda(grupo, categoria, merged)
    hoy = datetime.now().strftime("%Y-%m-%d")
    actualizar_historico(resumir_listados(anadidos, hoy))
    return {
        "categoria": categoria,
        "grupo": grupo,
        "gerencias_anadidas": len({l["gerencia"] for l in anadidos}),
        "listados_anadidos": len(anadidos),
        "personas_anadidas": personas,
        "gerencias": sorted({l["gerencia"] for l in anadidos}),
    }


def completar_gerencias_grupo(grupo: str, categorias: list[str] | None = None,
                              pausa: float = 1.5) -> list[dict]:
    """Completa gerencias faltantes en todas las categorías del grupo con JSON."""
    dir_grupo = os.path.join(DATA_DIR, grupo)
    if not os.path.isdir(dir_grupo):
        return []
    if categorias is None:
        categorias = []
        for nombre in sorted(os.listdir(dir_grupo)):
            if not nombre.endswith(".json") or nombre.endswith(".busqueda.json"):
                continue
            with open(os.path.join(dir_grupo, nombre), "r", encoding="utf-8") as f:
                data = json.load(f)
            if data.get("categoria"):
                categorias.append(data["categoria"])

    resultados = []
    for categoria in categorias:
        resultados.append(completar_gerencias_categoria(grupo, categoria, pausa=pausa))
    actualizar_manifest()
    return resultados


def scrapear_categoria(categoria: str, grupo: str = "diplomado", gerencias=GERENCIAS,
                       ambitos=AMBITOS, pausa=1.5, presupuesto_segundos=None) -> list[dict]:
    """Scrapea una sola categoría reutilizando sesión del formulario (1 GET+POST cat)."""
    inicio = time.time()
    listados = []
    cliente = ClienteFormularioBaremo(grupo)
    try:
        sesion = cliente.iniciar_categoria(categoria)
    except (requests.exceptions.RequestException, ValueError) as e:
        print(f"ERROR  No se pudo iniciar categoria {categoria}: {e}")
        return listados

    html_estado = sesion.html
    gerencias_cat = gerencias_de_categoria(cliente, sesion, gerencias)
    for gerencia in gerencias_cat:
        if presupuesto_segundos and time.time() - inicio > presupuesto_segundos:
            print(f"\nPresupuesto agotado ({presupuesto_segundos}s) en {categoria}.")
            return listados

        sesion.html = html_estado
        try:
            pdfs, html_tras = cliente.pdfs_por_gerencia(sesion, gerencia)
        except (requests.exceptions.RequestException, ValueError) as e:
            print(f"ERROR  {categoria} · {gerencia} -> {e}")
            continue

        if not pdfs:
            for ambito in ambitos:
                estado = "sin_gerencia" if not cliente._id_gerencia_en_html(html_estado, gerencia) else "sin_pdf"
                _log_listado(categoria, gerencia, ambito, estado, None)
            continue

        urls_descargadas: set[str] = set()
        for ambito in ambitos:
            if presupuesto_segundos and time.time() - inicio > presupuesto_segundos:
                return listados
            url = pdfs.get(ambito)
            if not url:
                _log_listado(categoria, gerencia, ambito, "sin_pdf", None)
                continue
            if url in urls_descargadas:
                continue  # listado central: AP y AE apuntan al mismo PDF

            contenido, estado = descargar_pdf(url)
            if estado != "ok":
                _log_listado(categoria, gerencia, ambito, estado, url)
                continue

            filas = parsear_pdf(contenido, categoria, gerencia, ambito)
            if filas:
                listados.append({
                    "categoria": categoria, "gerencia": gerencia, "ambito": ambito,
                    "filas": [asdict(f) for f in filas],
                })
            urls_descargadas.add(url)
            _log_listado(categoria, gerencia, ambito, "ok", url, len(filas))
            time.sleep(pausa)

        try:
            html_estado = cliente.renovar_tras_post(html_tras, sesion.cat_id)
        except (requests.exceptions.RequestException, ValueError) as e:
            print(f"AVISO  Renovacion de sesion tras {gerencia}: {e}")
            try:
                sesion = cliente.iniciar_categoria(categoria)
                html_estado = sesion.html
            except (requests.exceptions.RequestException, ValueError):
                return listados

    return listados


def guardar_categoria_json(grupo: str, categoria: str, listados: list[dict]) -> str:
    os.makedirs(os.path.join(DATA_DIR, grupo), exist_ok=True)
    path = path_categoria_json(grupo, categoria)
    payload = {
        "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "grupo": grupo,
        "categoria": categoria,
        "listados": listados,
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    personas = sum(len(l["filas"]) for l in listados)
    print(f"Guardado {path} -> {len(listados)} listas, {personas} personas")
    guardar_indice_busqueda(grupo, categoria, listados)
    return path


# JSON de metadatos/inventario en data/{region}/ — no son snapshots de listados.
_JSON_INVENTARIO = frozenset({"categorias.json", "categorias_sanidad.json", "manifest.json"})


def leer_todos_listados_data() -> list[dict]:
    """Recorre data/{grupo}/*.json y devuelve todos los listados (para histórico)."""
    todos = []
    if not os.path.isdir(DATA_DIR):
        return todos
    for grupo in os.listdir(DATA_DIR):
        dir_grupo = os.path.join(DATA_DIR, grupo)
        if not os.path.isdir(dir_grupo):
            continue
        for nombre in os.listdir(dir_grupo):
            if not nombre.endswith(".json") or nombre.endswith(".busqueda.json"):
                continue
            if nombre in _JSON_INVENTARIO:
                continue
            with open(os.path.join(dir_grupo, nombre), "r", encoding="utf-8") as f:
                try:
                    data = json.load(f)
                except json.JSONDecodeError:
                    continue
            if not isinstance(data, dict):
                continue
            todos.extend(data.get("listados", []))
    return todos


def actualizar_manifest():
    archivos = []
    for grupo in sorted(os.listdir(DATA_DIR)):
        dir_grupo = os.path.join(DATA_DIR, grupo)
        if not os.path.isdir(dir_grupo):
            continue
        for nombre in sorted(os.listdir(dir_grupo)):
            if nombre.endswith(".json"):
                archivos.append(f"{grupo}/{nombre}")
    manifest = {
        "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "archivos": archivos,
    }
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"Manifest: {len(archivos)} archivos en {MANIFEST_PATH}")


def migrar_latest_json():
    """Convierte data/latest.json monolítico a JSON por categoría y lo borra."""
    if not os.path.exists(LATEST_PATH):
        print("No hay latest.json que migrar.")
        return
    with open(LATEST_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    por_categoria: dict[str, list] = {}
    for listado in data.get("listados", []):
        por_categoria.setdefault(listado["categoria"], []).append(listado)
    for categoria, listados in por_categoria.items():
        guardar_categoria_json("diplomado", categoria, listados)
    os.remove(LATEST_PATH)
    print(f"Migrado latest.json -> {len(por_categoria)} categorías en data/public/diplomado/")


def resumir_listados(listados: list[dict], fecha: str) -> list[dict]:
    """
    Por cada categoria+gerencia+ambito, guarda un resumen pequeño (no las
    filas completas, para no reventar el tamaño del repo con el tiempo):
    fecha, total de admitidos, y la puntuacion minima actual en la lista
    (proxy de tendencia -- NO es "el punto de corte del ultimo llamamiento",
    eso no lo publica el SESCAM; ver aviso al principio del fichero).
    """
    resumen = []
    for listado in listados:
        puntos = [f["comprobado_baremo"] for f in listado["filas"] if f.get("comprobado_baremo", 0) > 0]
        resumen.append({
            "fecha": fecha,
            "categoria": listado["categoria"],
            "gerencia": listado["gerencia"],
            "ambito": listado["ambito"],
            "total_admitidos": len(listado["filas"]),
            "punto_minimo_admitido": min(puntos) if puntos else None,
        })
    return resumen


def actualizar_historico(nuevas_entradas: list[dict]):
    """Añade al historico solo lo que falte hoy, por combinacion. No sobrescribe
    dias anteriores, y no duplica si se relanza el mismo dia."""
    historico = []
    if os.path.exists(HISTORICO_PATH):
        with open(HISTORICO_PATH, "r", encoding="utf-8") as f:
            try:
                historico = json.load(f)
            except json.JSONDecodeError:
                historico = []

    ya_existentes = {
        (e["fecha"], e["categoria"], e["gerencia"], e["ambito"]) for e in historico
    }
    añadidas = 0
    for entrada in nuevas_entradas:
        clave = (entrada["fecha"], entrada["categoria"], entrada["gerencia"], entrada["ambito"])
        if clave not in ya_existentes:
            historico.append(entrada)
            añadidas += 1

    with open(HISTORICO_PATH, "w", encoding="utf-8") as f:
        json.dump(historico, f, ensure_ascii=False, indent=2)

    print(f"Historico: {añadidas} entradas nuevas añadidas, {len(historico)} en total.")


def resumir_para_historico(resultado: dict, fecha: str) -> list[dict]:
    return resumir_listados(resultado.get("listados", []), fecha)


def ejecutar_scrape(grupo: str, categorias: list[str], presupuesto_segundos=35 * 60):
    """Scrapea categorías de un grupo y guarda un JSON por categoría."""
    os.makedirs(DATA_DIR, exist_ok=True)
    inicio = time.time()
    for categoria in categorias:
        restante = None
        if presupuesto_segundos:
            restante = presupuesto_segundos - (time.time() - inicio)
            if restante <= 0:
                print("Presupuesto global agotado.")
                break
        listados = scrapear_categoria(
            categoria, grupo=grupo, presupuesto_segundos=restante
        )
        if listados:
            guardar_categoria_json(grupo, categoria, listados)
    actualizar_manifest()
    hoy = datetime.now().strftime("%Y-%m-%d")
    resumen = resumir_listados(leer_todos_listados_data(), hoy)
    actualizar_historico(resumen)


def parse_args():
    p = argparse.ArgumentParser(description="Scraper SESCAM — JSON por categoría")
    p.add_argument("--grupo", default="diplomado",
                   choices=["diplomado", "facultativo", "licenciados", "tecnico", "gestion"])
    p.add_argument("--categoria", help="Una categoría concreta (nombre PDF, ej. FISIOTERAPEUTA)")
    p.add_argument("--migrar-latest", action="store_true", help="Migrar data/latest.json y borrarlo")
    p.add_argument("--presupuesto", type=int, default=35 * 60,
                   help="Segundos máximos por ejecución (default 2100)")
    p.add_argument("--completar-gerencias", action="store_true",
                   help="Solo añade gerencias/ámbitos faltantes al JSON existente (no re-scrapea todo)")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    os.makedirs(DATA_DIR, exist_ok=True)

    if args.migrar_latest:
        migrar_latest_json()
        actualizar_manifest()
        raise SystemExit(0)

    if args.completar_gerencias:
        if args.categoria:
            res = [completar_gerencias_categoria(args.grupo, args.categoria)]
        else:
            res = completar_gerencias_grupo(args.grupo)
        total_p = sum(r.get("personas_anadidas", 0) for r in res)
        total_l = sum(r.get("listados_anadidos", 0) for r in res)
        print(f"Completar gerencias: +{total_l} listados, +{total_p} personas en {len(res)} categorías")
        raise SystemExit(0)

    inventario = cargar_categorias_desde_inventario()
    cats = inventario.get(args.grupo, GRUPOS.get(args.grupo, []))
    if args.categoria:
        cats = [args.categoria]
    if not cats:
        print(f"Sin categorías para grupo {args.grupo}. Ejecuta scripts/inventario_categorias.py")
        raise SystemExit(1)

    ejecutar_scrape(args.grupo, cats, presupuesto_segundos=args.presupuesto)
