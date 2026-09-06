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
| Madrid | Sanidad SERMAS | A | `scraper_madrid.py` | Parcial | PDF Anexo I puntuacion; sede `oferta-empleo` |
| Madrid | Educacion | A* | No | No | Condicionado: confirmar bolsa/orden (no solo asignacion) |
| Madrid | Admin general | A | No | No | BOCM+sede; despues de sanidad |
| Resto | — | — | No | No | Mapa bloqueado en app |

Clasificacion Murcia (sep 2026): sanidad y educacion en sprint; admin solo inventario / no scrapear.
Clasificacion Madrid (sep 2026): sanidad A prioridad; educacion A condicionado; admin A despues.

## Pendiente — automatizar expansion (no CCAA a CCAA a mano)

Objetivo: no repetir el proceso manual por cada comunidad.

**Hacer (pendiente):**
1. Clasificar A/B en lote (prompts / agente en paralelo) para varias CCAA×sector.
2. Plantilla de scraper por tipo de fuente (HTML tablas / PDF / indice URLs), no un scraper unico de Espana.
3. Misma forma JSON + subida R2 + vigia; adaptador por CCAA en la app.
4. UI ya centralizada por flujo (buscar → confirmar → resultado); reforzar adaptadores, no pantallas nuevas por portal.

**No hacer:** scraper unico que digiera todos los portales; pelear Cajon B.

Estado: **pendiente** (apuntado 6 sep 2026). Seguir tras cerrar Murcia admin (B, solo UI si aplica) y antes/durante Madrid.

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

## Madrid — sanidad (A)

- Indice: `https://www.comunidad.madrid/salud/bolsas-contratacion-temporal-servicio-madrileno-salud`
- Por categoria: enlace «Listados provisionales y definitivos» → sede → PDF `…puntuacion…/download`
- Sin login; PDF texto seleccionable; campos: orden, DNI parcial, nombre, puntos, centro grabacion
- Scraper: `scraper_madrid.py` → `data/public/madrid/` → R2 prefijo `madrid/`
- UI inventario: `categorias_sanidad.json`; scrape inventario: `categorias.json`

```bash
python scraper_madrid.py --inventario
python scraper_madrid.py --categoria "Técnico Auxiliar de Farmacia"
python scraper_madrid.py --todas --presupuesto 7200
python scripts/subir_sectores_r2.py --sectores madrid --skip-existing
```

## Madrid — educacion / admin

- Educacion: solo si hay listados de bolsa/orden (no solo asignacion provisional).
- Admin: BOCM (`www.bocm.es`) + sede listas espera; tras sanidad usable.

## Plantilla exploracion (1h)

1. URL oficial bolsa
2. Login requerido? Si/no
3. Formato listado (PDF/HTML/API)
4. Campos (nombre, DNI parcial, puntuacion, gerencia)
5. Decision A/B y estimacion scrape
