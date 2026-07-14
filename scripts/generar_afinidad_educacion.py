#!/usr/bin/env python3
"""
Genera data/educacion/afinidad.json a partir del Anexo II (Orden 32/2018 / 90/2024).

Uso:
  python scripts/generar_afinidad_educacion.py
  python scripts/generar_afinidad_educacion.py --texto ruta/anexo-ii.txt
"""
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATEGORIAS = ROOT / "data" / "educacion" / "categorias.json"
SALIDA = ROOT / "data" / "educacion" / "afinidad.json"
FUENTE_DEFAULT = ROOT / "data" / "educacion" / "fuentes" / "anexo-ii-orden-32-2018.txt"

# Nombre en Anexo II → clave categorias.json ("NNN NOMBRE")
ANEXO_A_CLAVE: dict[str, dict[str, str]] = {
    "0590": {
        "Filosofía": "001 FILOSOFIA",
        "Griego": "002 GRIEGO",
        "Latín": "003 LATIN",
        "Lengua castellana y literatura": "004 LENGUA CASTELLANA Y LITERATURA",
        "Geografía e historia": "005 GEOGRAFIA E HISTORIA",
        "Matemáticas": "006 MATEMATICAS",
        "Física y química": "007 FISICA Y QUIMICA",
        "Biología y geología": "008 BIOLOGIA Y GEOLOGIA",
        "Dibujo": "009 DIBUJO",
        "Francés": "010 FRANCES",
        "Inglés": "011 INGLES",
        "Alemán": "012 ALEMAN",
        "Italiano": "013 ITALIANO",
        "Música": "016 MUSICA",
        "Educación física": "017 EDUCACION FISICA",
        "Orientación educativa": "018 ORIENTACION EDUCATIVA",
        "Tecnología": "019 TECNOLOGIA",
        "Economía": "061 ECONOMIA",
        "Administración de empresas": "101 ADMINISTRACION DE EMPRESAS",
        "Asesoría y procesos de imagen personal": "103 ASESORIA Y PROCESOS DE IMAGEN PERSONAL",
        "Construcciones civiles y edificación": "104 CONSTRUCCIONES CIVILES Y EDIFICACION",
        "Formación y orientación laboral": "105 FORMACION Y ORIENTACION LABORAL",
        "Hostelería y turismo": "106 HOSTELERIA Y TURISMO",
        "Informática": "107 INFORMATICA",
        "Intervención sociocomunitaria": "108 INTERVENCION SOCIOCOMUNITARIA",
        "Organización y gestión comercial": "110 ORGANIZACION Y GESTION COMERCIAL",
        "Organización y procesos de mantenimiento de vehículos": "111 ORGANIZACION Y PROCESOS DE MANTENIMIENTO DE VEHICULOS",
        "Organización y proyectos de fabricación mecánica": "112 ORGANIZACION Y PROYECTOS DE FABRICACION MECANICA",
        "Organización y proyectos de sistemas energéticos": "113 ORGANIZACION Y PROYECTOS DE SISTEMAS ENERGETICOS",
        "Procesos diagnósticos clínicos y productos ortoprotésicos": "117 PROCESOS DIAGNOSTICOS CLINICOS Y PRODUCTOS ORTOPROTESICOS",
        "Procesos sanitarios": "118 PROCESOS SANITARIOS",
        "Procesos y medios de comunicación": "119 PROCESOS Y MEDIOS DE COMUNICACION",
        "Procesos y productos en madera y mueble": "123 PROCESOS Y PRODUCTOS EN MADERA Y MUEBLE",
        "Sistemas electrotécnicos y automáticos": "125 SISTEMAS ELECTROTECNICOS Y AUTOMATICOS",
        "Instalaciones electrotécnicas": "206 INSTALACIONES ELECTROTECNICAS",
        "Procedimientos de diagnóstico clínico y ortoprotésico": "219 PROCEDIMIENTOS DE DIAGNOSTICO CLINICO Y ORTOPROTESICO",
        "Procedimientos sanitarios y asistenciales": "220 PROCEDIMIENTOS SANITARIOS Y ASISTENCIALES",
        "Procesos comerciales": "221 PROCESOS COMERCIALES",
        "Procesos de gestión administrativa": "222 PROCESOS DE GESTION ADMINISTRATIVA",
        "Servicios a la comunidad": "225 SERVICIOS A LA COMUNIDAD",
        "Sistemas y aplicaciones informáticas": "227 SISTEMAS Y APLICACIONES INFORMATICAS",
    },
    "0597": {
        "Educación infantil": "031 EDUCACION INFANTIL",
        "Lengua extranjera: inglés": "032 LENGUA EXTRANJERA: INGLES",
        "Lengua extranjera: francés": "033 LENGUA EXTRANJERA: FRANCES",
        "Educación física": "034 EDUCACION FISICA",
        "Música": "035 MUSICA",
        "Pedagogía terapéutica": "036 PEDAGOGIA TERAPEUTICA",
        "Audición y lenguaje": "037 AUDICION Y LENGUAJE",
        "Educación primaria": "038 EDUCACION PRIMARIA",
        "Ciencias sociales": "070 CIENCIAS SOCIALES",
        "Matemáticas y ciencias de la naturaleza": "071 MATEMATICAS Y CIENCIAS DE LA NATURALEZA",
    },
    "0591": {
        "Equipos electrónicos": "202 EQUIPOS ELECTRONICOS",
        "Estética": "203 ESTETICA",
        "Instalaciones y equipos de cría y cultivo": "207 INSTALACIONES Y EQUIPOS DE CRIA Y CULTIVO",
        "Laboratorio": "208 LABORATORIO",
        "Oficina de proyectos de construcción": "212 OFICINA DE PROYECTOS DE CONSTRUCCION",
        "Operaciones de producción agraria": "216 OPERACIONES DE PRODUCCION AGRARIA",
        "Patronaje y confección": "217 PATRONAJE Y CONFECCION",
        "Servicios de restauración": "226 SERVICIOS DE RESTAURACION",
        "Técnicas y procedimientos de imagen y sonido": "229 TECNICAS Y PROCEDIMIENTOS DE IMAGEN Y SONIDO",
    },
    "0592": {
        "Español para extranjeros": "006 ESPAÑOL PARA EXTRANJEROS",
        "Inglés": "011 INGLES",
    },
}

TITULACION_START = re.compile(
    r"\b(Grado en|Licenciatura en|Ingeniería|Ingenieria|Diplomatura en|Título de|Titulo de|Maestro|Arquitectura)\b",
    re.IGNORECASE,
)
GENERIC_CUERPO = "cualquier titulacion universitaria requerida para el ingreso en este cuerpo"


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", s.lower().strip())


def norm_clave(s: str) -> str:
    return norm(s).upper()


def extraer_anexo_ii(texto: str) -> str:
    m = re.search(r"Anexo\s+II\s+Titulaciones", texto, re.IGNORECASE)
    if not m:
        raise SystemExit("No se encontró Anexo II en el texto")
    inicio = m.start()
    fin = re.search(r"\nAnexo\s+III\b", texto[inicio:], re.IGNORECASE)
    return texto[inicio : inicio + fin.start()] if fin else texto[inicio:]


def titulaciones_en_bloque(bloque: str) -> set[str]:
    out: set[str] = set()
    for m in TITULACION_START.finditer(bloque):
        ini = m.start()
        nxt = TITULACION_START.search(bloque, m.end())
        fin = nxt.start() if nxt else len(bloque)
        frag = bloque[ini:fin].strip()
        frag = re.split(
            r"\b(?:Cualquier titulaci[oó]n|Especialidad Titulaci[oó]n)\b",
            frag,
            maxsplit=1,
            flags=re.I,
        )[0]
        t = norm(frag)
        if len(t) > 15 and not t.startswith("especialidad titulacion"):
            out.add(t)
    if GENERIC_CUERPO in norm(bloque):
        out.add(GENERIC_CUERPO)
    return out


def bloques_por_especialidad(anexo: str, cuerpo: str) -> dict[str, set[str]]:
    mapping = ANEXO_A_CLAVE.get(cuerpo, {})
    if not mapping:
        return {}

    nombres = sorted(mapping.keys(), key=len, reverse=True)
    patrones = []
    for nombre in nombres:
        esc = re.escape(nombre)
        patrones.append((nombre, re.compile(esc, re.IGNORECASE)))

    hits: list[tuple[int, str, str]] = []
    for nombre, rx in patrones:
        for m in rx.finditer(anexo):
            hits.append((m.start(), nombre, mapping[nombre]))

    hits.sort(key=lambda x: x[0])
    vistos: set[str] = set()
    unicos: list[tuple[int, str, str]] = []
    for h in hits:
        if h[2] in vistos:
            continue
        vistos.add(h[2])
        unicos.append(h)
    unicos.sort(key=lambda x: x[0])

    resultado: dict[str, set[str]] = {}
    for i, (pos, _nombre, clave) in enumerate(unicos):
        fin = unicos[i + 1][0] if i + 1 < len(unicos) else len(anexo)
        bloque = anexo[pos:fin]
        resultado[clave] = titulaciones_en_bloque(bloque)
    return resultado


def calcular_desde_bolsa(tit_por_esp: dict[str, set[str]]) -> dict[str, list[str]]:
    claves = list(tit_por_esp.keys())
    desde: dict[str, list[str]] = {}
    for origen in claves:
        tit_o = tit_por_esp.get(origen, set())
        if not tit_o:
            continue
        destinos: list[str] = []
        for destino in claves:
            if destino == origen:
                continue
            tit_d = tit_por_esp.get(destino, set())
            if not tit_d:
                continue
            inter = tit_o & tit_d
            if inter:
                destinos.append(destino)
        desde[origen] = sorted(destinos, key=lambda x: x.split(" ", 1)[0])
    return desde


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--texto", type=Path, default=FUENTE_DEFAULT)
    ap.add_argument("--categorias", type=Path, default=CATEGORIAS)
    ap.add_argument("--salida", type=Path, default=SALIDA)
    args = ap.parse_args()

    if not args.texto.is_file():
        raise SystemExit(f"Falta texto Anexo II: {args.texto}")

    texto = args.texto.read_text(encoding="utf-8", errors="replace")
    anexo = extraer_anexo_ii(texto)
    categorias = json.loads(args.categorias.read_text(encoding="utf-8"))

    titulaciones: dict[str, dict[str, list[str]]] = {}
    desde_bolsa: dict[str, dict[str, list[str]]] = {}
    resumen: dict[str, int] = {}

    for cuerpo in categorias.get("cuerpos", []):
        cod = cuerpo["codigo"]
        bloques = bloques_por_especialidad(anexo, cod)
        if not bloques:
            continue
        titulaciones[cod] = {k: sorted(v) for k, v in bloques.items()}
        desde_bolsa[cod] = calcular_desde_bolsa(bloques)
        resumen[cod] = sum(len(v) for v in desde_bolsa[cod].values())

    doc = {
        "normativa": "Orden 32/2018 (art. 9-10) y Orden 90/2024 — Anexo II titulaciones",
        "generado_por": "scripts/generar_afinidad_educacion.py",
        "titulaciones_por_especialidad": titulaciones,
        "desde_bolsa": desde_bolsa,
        "resumen_vinculos": resumen,
    }

    args.salida.parent.mkdir(parents=True, exist_ok=True)
    args.salida.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Escrito {args.salida} — cuerpos: {', '.join(f'{k}({v})' for k, v in resumen.items())}")


if __name__ == "__main__":
    main()
