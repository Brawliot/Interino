# Expansion a otras CCAA

Regla de oro (README): clasificar cada fuente en **maximo 1 hora**.

## Cajon A — seguir

- PDF o HTML publico sin login
- Texto seleccionable / listado parseable
- Patron de URL o paginacion estable

## Cajon B — parar

- Login, certificado, CAPTCHA
- Dropdown vacio sin API documentada (ej. facultativo SESCAM)
- OCR masivo sin patron

## Estado por CCAA

| CCAA | Sector | Cajon | Scraper | R2 | Notas |
|------|--------|-------|---------|-----|-------|
| CLM | Sanidad | A | Si | Si | 4 grupos + facultativo B |
| CLM | Educacion | A | Si | Parcial bolsa | 3 modos + AFIN |
| CLM | Admin | A | Si | Si | 4 bolsas sin PDF |
| Murcia | Sanidad SMS | A | `scraper_murcia.py` | Pendiente | HTML tablas; URL estable `id_listado` + letra A-Z |
| Murcia | Educacion | A | `scraper_educacion_murcia.py` | Si (Maestros) | App: sector Educación en Murcia |
| Murcia | Admin general | B | No | No | Autogestion/Cl@ve; PDFs impredecibles — fuera del sprint |
| Madrid | Sanidad | ? | No | Solo inventario | Explorar SERMAS |
| Resto | — | — | No | No | Mapa bloqueado en app |

Clasificacion Murcia (sep 2026): sanidad y educacion en sprint; admin solo inventario / no scrapear.

## Murcia — detalle clasificacion

### Sanidad (A)

- Portal: `https://www.murciasalud.es/bolsas.php?idsec=39`
- Categorias: `op=mostrar_categorias`
- Listado: `op=mostrar_listado&id_listado=…&letra=…`
- Sin login/captcha; HTML seleccionable; campos: nombre, DNI parcial, puntuacion, orden, areas

### Educacion (A)

- Indice: `https://www.carm.es/web/pagina?IDCONTENIDO=4088&IDTIPO=100&…`
- Listados en PDF (texto seleccionable / tablas); sin login
- Campos: nº lista, DNI parcial, nombre, puntos
- Scraper: `scraper_educacion_murcia.py` (MVP Maestros 2025/2026)
- Salida: `data/educacion-murcia/` → R2 prefijo `educacion-murcia/`
- Si Radware Captcha: descargar PDF a mano + `--pdf`
- Pendiente app: sector Educación en Murcia; cuerpos no-Maestros

### Administracion general (B)

- Portales: `empleopublico.carm.es`, `listasdeespera.carm.es` (login), sede procedimiento 2120
- Listados completos no automatizables sin Cl@ve / PDFs con nombres no predecibles
- Alternativa: dejar fuera; no pelear en sprint 15 dias

## Murcia — operacion (sanidad)

```bash
python scraper_murcia.py --inventario
python scraper_murcia.py --todas --presupuesto 3600
python scripts/estado_regiones.py
python scripts/subir_sectores_r2.py --sectores murcia --skip-existing
```

## Madrid — siguiente paso

1. Localizar URLs de listados SERMAS (1h exploracion).
2. Si cajon A: scraper similar a Murcia.
3. Subir: `--sectores madrid` (solo metadatos hasta entonces).

## Plantilla exploracion (1h)

1. URL oficial bolsa
2. Login requerido? Si/no
3. Formato listado (PDF/HTML/API)
4. Campos (nombre, DNI parcial, puntuacion, gerencia)
5. Decision A/B y estimacion scrape
