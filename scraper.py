"""
Scraper del listado de bolsa del SESCAM (Castilla-La Mancha).

CONFIRMADO CON UN PDF REAL (ENFERMERO/A - GAI Cuenca - Vigesima
Convocatoria 2025) que la tabla tiene estas columnas:

  ORDEN | APELLIDOS Y NOMBRE | DNI (****1234X) | AUTOBAR | COMPROBADO
  BAREMO | G.P | Larga TC | Larga TP | Corta TC | Corta TP | C.U. TC | C.U. TP

Los PDFs viven en una carpeta publica con nombre de archivo predecible,
asi que NO hace falta replicar el formulario JavaScript: basta con
construir la URL y pedirla (si no existe, da 404 y se salta).

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

import requests
import pdfplumber
from dataclasses import dataclass, asdict, field

# ---------------------------------------------------------------
# CONFIGURACION
# ---------------------------------------------------------------

BASE_PDFS = "https://sanidad.castillalamancha.es/sites/sescam.castillalamancha.es/files/selecta-pdfs/"

# TODO: El patrón URL PDF de licenciados, técnico y gestión no coincide con diplomado
# (404 con Vigésima 2025). No investigado — no prioritario.

# Ajustar cuando cambie la convocatoria (hoy: 20a, año 2025)
ORDINAL_CONVOCATORIA = "Vigesima"
ANIO_CONVOCATORIA = "2025"

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
    "Gerencia de Atencion Integrada de Puertollano",
    "Gerencia de Atencion Integrada de Talavera de la Reina",
    "Gerencia de Atencion Integrada de Tomelloso",
    "Gerencia de Atencion Integrada de Valdepeñas",
    "Gerencia de Atencion Integrada de Villarrobledo",
    "Gerencia de Atencion Primaria de Toledo",
]

AMBITOS = ["Atencion Primaria", "Atencion Especializada"]

DATA_DIR = "data"
HISTORICO_PATH = os.path.join(DATA_DIR, "historico.json")
MANIFEST_PATH = os.path.join(DATA_DIR, "manifest.json")
CATEGORIAS_JSON = os.path.join(DATA_DIR, "categorias_por_grupo.json")
LATEST_PATH = os.path.join(DATA_DIR, "latest.json")  # legacy; migrar y borrar

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


def construir_url_pdf(categoria: str, gerencia: str, ambito: str,
                       estado: str = "ADMITIDOS", subtipo: str | None = None,
                       tipo_listado: str = "DEFINITIVO") -> str:
    """
    Reconstruye la URL del PDF a partir del patron real confirmado:

    {CATEGORIA}_Listado {TIPO} de {ESTADO}[. {SUBTIPO}].
    {ORDINAL} Convocatoria {AÑO} - {AMBITO} - {GERENCIA sin acentos}.pdf
    """
    partes_nombre = [f"Listado {tipo_listado} de {estado}"]
    if subtipo:
        partes_nombre[0] += f". {subtipo}"
    nombre = (
        f"{slug_categoria(categoria)}_"
        + ". ".join(partes_nombre)
        + f". {ORDINAL_CONVOCATORIA} Convocatoria {ANIO_CONVOCATORIA}"
        + f" - {ambito} - {quitar_acentos(gerencia)}.pdf"
    )
    return BASE_PDFS + requests.utils.quote(nombre)


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
                    gerencia=gerencia, ambito=ambito,
                ))
    return filas


def obtener_listado(categoria: str, gerencia: str, ambito: str, intentos: int = 2) -> list[FilaBaremo]:
    url = construir_url_pdf(categoria, gerencia, ambito)
    for intento in range(intentos):
        try:
            resp = requests.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; ListasApp/0.1; +contacto@ejemplo.es)"},
                timeout=12,
            )
            if resp.status_code == 404:
                return []  # esta combinacion no existe, es normal
            resp.raise_for_status()
            return parsear_pdf(resp.content, categoria, gerencia, ambito)
        except requests.exceptions.RequestException:
            if intento == intentos - 1:
                return []  # tras los reintentos, se salta y sigue -- no revienta el resto
            time.sleep(3)
    return []


def scrapear_todo(categorias=CATEGORIAS_SANIDAD_DIPLOMADO, gerencias=GERENCIAS,
                   ambitos=AMBITOS, pausa=1.5, presupuesto_segundos=35 * 60) -> dict:
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
                    filas = obtener_listado(categoria, gerencia, ambito)
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


def scrapear_categoria(categoria: str, gerencias=GERENCIAS, ambitos=AMBITOS,
                       pausa=1.5, presupuesto_segundos=None) -> list[dict]:
    """Scrapea una sola categoría (todas gerencias × ámbitos). Devuelve listados."""
    inicio = time.time()
    listados = []
    for gerencia in gerencias:
        for ambito in ambitos:
            if presupuesto_segundos and time.time() - inicio > presupuesto_segundos:
                print(f"\nPresupuesto agotado ({presupuesto_segundos}s) en {categoria}.")
                return listados
            try:
                filas = obtener_listado(categoria, gerencia, ambito)
                if not filas:
                    continue
                listados.append({
                    "categoria": categoria, "gerencia": gerencia, "ambito": ambito,
                    "filas": [asdict(f) for f in filas],
                })
                print(f"OK  {categoria} · {gerencia} · {ambito} -> {len(filas)} filas")
            except Exception as e:
                print(f"ERROR  {categoria} · {gerencia} · {ambito} -> {e}")
            time.sleep(pausa)
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
    return path


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
            if not nombre.endswith(".json"):
                continue
            with open(os.path.join(dir_grupo, nombre), "r", encoding="utf-8") as f:
                try:
                    data = json.load(f)
                except json.JSONDecodeError:
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
    print(f"Migrado latest.json -> {len(por_categoria)} categorías en data/diplomado/")


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
        puntos = [f["comprobado_baremo"] for f in listado["filas"]]
        resumen.append({
            "fecha": fecha,
            "categoria": listado["categoria"],
            "gerencia": listado["gerencia"],
            "ambito": listado["ambito"],
            "total_admitidos": len(puntos),
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
            categoria, presupuesto_segundos=restante
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
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    os.makedirs(DATA_DIR, exist_ok=True)

    if args.migrar_latest:
        migrar_latest_json()
        actualizar_manifest()
        raise SystemExit(0)

    inventario = cargar_categorias_desde_inventario()
    cats = inventario.get(args.grupo, GRUPOS.get(args.grupo, []))
    if args.categoria:
        cats = [args.categoria]
    if not cats:
        print(f"Sin categorías para grupo {args.grupo}. Ejecuta scripts/inventario_categorias.py")
        raise SystemExit(1)

    ejecutar_scrape(args.grupo, cats, presupuesto_segundos=args.presupuesto)
