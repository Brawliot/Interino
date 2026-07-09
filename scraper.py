"""
Scraper del listado de bolsa del SESCAM (Castilla-La Mancha).

CONFIRMADO CON UN PDF REAL (ENFERMERO/A - GAI Cuenca - Vigésima
Convocatoria 2025) que la tabla tiene estas columnas:

  ORDEN | APELLIDOS Y NOMBRE | DNI (****1234X) | AUTOBAR | COMPROBADO
  BAREMO | G.P | Larga TC | Larga TP | Corta TC | Corta TP | C.U. TC | C.U. TP

Y que los PDFs viven en una carpeta pública con nombre de archivo
predecible, así que NO hace falta replicar el formulario JavaScript:
basta con construir la URL y pedirla (si no existe, da 404 y se salta).
"""

import re
import io
import time
import json
import unicodedata
import requests
import pdfplumber
from dataclasses import dataclass, asdict, field

# ---------------------------------------------------------------
# CONFIGURACION
# ---------------------------------------------------------------

BASE_PDFS = "https://sanidad.castillalamancha.es/sites/sescam.castillalamancha.es/files/selecta-pdfs/"

# Ajustar cuando cambie la convocatoria (hoy: 20ª, año 2025)
ORDINAL_CONVOCATORIA = "Vigesima"
ANIO_CONVOCATORIA = "2025"

CATEGORIAS_SANIDAD_DIPLOMADO = [
    "ENFERMERO/A",
    "ENFERMERO/A DE EMERGENCIAS",
    "ENFERMERO/A ESPECIALISTA DEL TRABAJO",
    "ENFERMERO/A ESPECIALISTA EN ENF. FAMILIAR Y COMUNITARIA",
    "ENFERMERO/A ESPECIALISTA EN ENF. GERIATRICA",
    "ENFERMERO/A ESPECIALISTA EN ENF. PEDIATRICA",
    "ENFERMERO/A ESPECIALISTA EN SALUD MENTAL",
    "ENFERMERO/A ESPECIALISTA OBSTETRICIO - GINECOLOGICA (MATRONA)",
    "FISIOTERAPEUTA",
    "LOGOPEDA",
    "OPTICO/A OPTOMETRISTA",
    "PODOLOGO/A",
    "TERAPEUTA OCUPACIONAL",
    "DIETISTA-NUTRICIONISTA",
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
    Reconstruye la URL del PDF a partir del patrón real confirmado:

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
    tipos_contrato: dict = field(default_factory=dict)  # {"Larga TC": True, ...}
    categoria: str = ""
    gerencia: str = ""
    ambito: str = ""


CABECERAS_ESPERADAS = ["ORDEN", "APELLIDOS Y NOMBRE", "DNI", "AUTOBAR",
                        "COMPROBADO", "BAREMO", "G.P"]
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
                # saltar cabeceras / filas vacias
                if not fila or not fila[0].isdigit():
                    continue
                try:
                    orden = int(fila[0])
                    nombre = fila[1]
                    dni = fila[2]
                    # AUTOBAR = fila[3], normalmente "----"
                    baremo = float(fila[4].replace(".", "").replace(",", "."))
                    gp = fila[5].strip().upper() == "X"
                    contrato = {col: (fila[6 + i].strip().upper() == "X")
                                for i, col in enumerate(COLUMNAS_CONTRATO)
                                if 6 + i < len(fila)}
                except (ValueError, IndexError):
                    continue  # fila que no encaja con el patron, se ignora
                filas.append(FilaBaremo(
                    orden=orden, apellidos_nombre=nombre, dni_parcial=dni,
                    comprobado_baremo=baremo, grupo_preferente=gp,
                    tipos_contrato=contrato, categoria=categoria,
                    gerencia=gerencia, ambito=ambito,
                ))
    return filas


def obtener_listado(categoria: str, gerencia: str, ambito: str) -> list[FilaBaremo]:
    url = construir_url_pdf(categoria, gerencia, ambito)
    resp = requests.get(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; ListasApp/0.1; +contacto@ejemplo.es)"},
        timeout=20,
    )
    if resp.status_code == 404:
        return []  # esta combinacion categoria+gerencia+ambito no existe, normal
    resp.raise_for_status()
    return parsear_pdf(resp.content, categoria, gerencia, ambito)


def scrapear_todo(categorias=CATEGORIAS_SANIDAD_DIPLOMADO, gerencias=GERENCIAS,
                   ambitos=AMBITOS, pausa=1.5):
    resultado = {"generado": time.strftime("%Y-%m-%dT%H:%M:%S"), "listados": []}
    total_filas = 0
    for categoria in categorias:
        for gerencia in gerencias:
            for ambito in ambitos:
                try:
                    filas = obtener_listado(categoria, gerencia, ambito)
                    if not filas:
                        continue
                    resultado["listados"].append({
                        "categoria": categoria, "gerencia": gerencia, "ambito": ambito,
                        "filas": [asdict(f) for f in filas],
                    })
                    total_filas += len(filas)
                    print(f"OK  {categoria} · {gerencia} · {ambito} -> {len(filas)} filas")
                except Exception as e:
                    print(f"ERROR  {categoria} · {gerencia} · {ambito} -> {e}")
                time.sleep(pausa)
    return resultado, total_filas


if __name__ == "__main__":
    import os
    from datetime import datetime

    # 1. Ejecutar scraper
    datos, total_aspirantes = scrapear_todo()

    # 2. Leer histórico existente
    historico_path = "historico.json"
    historico = []
    if os.path.exists(historico_path):
        with open(historico_path, "r", encoding="utf-8") as f:
            try:
                historico = json.load(f)
            except json.JSONDecodeError:
                historico = []

    hoy = datetime.now().strftime("%Y-%m-%d")

    # 3. Si hoy ya está registrado, no duplicar
    if any(entry["fecha"] == hoy for entry in historico):
        print(f"Hoy ({hoy}) ya esta registrado. No se añade duplicado.")
    else:
        # 4. Añadir entrada nueva
        historico.append({
            "fecha": hoy,
            "total_aspirantes": total_aspirantes
        })

        # 5. Guardar el histórico actualizado
        with open(historico_path, "w", encoding="utf-8") as f:
            json.dump(historico, f, ensure_ascii=False, indent=2)

        print(f"Añadida entrada para {hoy} -> {total_aspirantes} aspirantes totales")
        print(f"Historico tiene {len(historico)} dias registrados")

    # Opcional: también se puede guardar el volcado completo de listados en otro archivo
    # con open("listados_completos.json", "w") as f: json.dump(datos, f)