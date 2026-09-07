# Expansion a otras CCAA

Regla de oro (README): clasificar cada fuente en **maximo 1 hora**.

## Plan 15 dias — eje de 5 CCAA (fijado 7 sep 2026)

**Eje:** CLM · Murcia · Madrid · Castilla y León · Extremadura.  
**Mejor profundidad en estas 5 que dispersar al resto de España.**

| CCAA | Objetivo sprint | Fuera / aparcado |
|------|-----------------|------------------|
| **CLM** | Entera (3 sectores) — ya | Facultativo SESCAM = B |
| **Murcia** | Sanidad + educación (Maestros+) | Admin = **B** (no pelear) |
| **Madrid** | Sanidad (hecho) + **admin** | Educación = A débil (~20 h) |
| **Castilla y León** | **Sanidad** primero; edu/admin solo si A en ≤1 h | — |
| **Extremadura** | **Sanidad** primero; edu/admin solo si A en ≤1 h | — |

**No entra en el sprint:** Valencia, Andalucía, Cataluña, País Vasco, Navarra, Canarias, Baleares, resto — salvo sobra tiempo tras clasificar el eje.

**Orden de trabajo datos:**
1. Cerrar frescura/vigía CLM (R2 al día).
2. Madrid admin (ya Cajón A pendiente).
3. Clasificar CyL + Extremadura (sanidad, 1 h c/u) → scrapear solo A.
4. Edu/admin CyL/Ext solo si salen A baratos.
5. Pipeline de expansión (plantillas) en paralelo cuando toque repetir scrape.

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
| Murcia | Sanidad SMS | A | `scraper_murcia.py` | Si | HTML; app sanidad Murcia |
| Murcia | Educacion | A | `scraper_educacion_murcia.py` | Si (Maestros) | App Educación Murcia |
| Murcia | Admin general | B | No | No | Fuera del sprint |
| Madrid | Sanidad SERMAS | A | `scraper_madrid.py` | Si (32 cats) | Anexo I PDF multi-formato |
| Madrid | Educacion | A débil | No | No | Índice fragmentado — aparcar sprint |
| Madrid | Admin general | A | No | No | BOCM+sede; siguiente celda |
| Castilla y León | Sanidad | ? | No | No | Eje 15 d — clasificar ≤1 h |
| Castilla y León | Edu / Admin | ? | No | No | Solo si A barato |
| Extremadura | Sanidad | ? | No | No | Eje 15 d — clasificar ≤1 h |
| Extremadura | Edu / Admin | ? | No | No | Solo si A barato |
| Resto | — | — | No | No | Fuera del eje 15 d |

Clasificacion Murcia (sep 2026): sanidad y educacion OK; admin B.
Clasificacion Madrid (sep 2026): sanidad cerrada 32/32; educacion A aparcado (sin índice); admin pendiente.
Eje 15 d (7 sep 2026): CLM + MUR + MAD + CyL + EXT (sanidad primero en CyL/EXT).

## Pendiente — automatizar expansion (no CCAA a CCAA a mano)

Objetivo: no repetir el proceso manual por cada comunidad.

**Hacer (pendiente):**
1. Clasificar A/B en lote para CyL × sanidad y Extremadura × sanidad (luego edu/admin si aplica).
2. Plantilla de scraper por tipo de fuente (HTML tablas / PDF / indice URLs), no un scraper unico de Espana.
3. Misma forma JSON + subida R2 + vigia; adaptador por CCAA en la app.
4. UI ya centralizada por flujo (buscar → confirmar → resultado); reforzar adaptadores, no pantallas nuevas por portal.

**No hacer:** scraper unico que digiera todos los portales; pelear Cajon B; ampliar a Valencia/Andalucía antes de cerrar el eje.

Estado: **en curso** (eje fijado 7 sep 2026). Tras vigía/frescura → Madrid admin → clasificar CyL + Extremadura.

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
- Pendiente app: cuerpos no-Maestros

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

- Educacion: hay listas con puntuación, pero índice fragmentado (BOCM + comunidad + educa2; PDFs de ejemplo a menudo 404). **Aparcar en sprint** (~20h). No scrapear hasta índice usable.
- Admin: BOCM (`www.bocm.es`) + sede listas espera; siguiente celda de datos tras sanidad (eje 15 d).

## Castilla y León / Extremadura

Pendiente clasificacion (plantilla 1 h). Objetivo: sanidad Cajón A → scraper + R2 + adaptador app. Edu/admin solo si A barato.

## Plantilla exploracion (1h)

1. URL oficial bolsa
2. Login requerido? Si/no
3. Formato listado (PDF/HTML/API)
4. Campos (nombre, DNI parcial, puntuacion, gerencia)
5. Decision A/B y estimacion scrape
