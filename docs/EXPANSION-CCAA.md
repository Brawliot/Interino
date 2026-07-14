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
| Murcia | Sanidad SMS | A | `scraper_murcia.py` | Pendiente | HTML paginado |
| Madrid | Sanidad | ? | No | Solo inventario | Explorar SERMAS |
| Resto | — | — | No | No | Mapa bloqueado en app |

## Murcia — operacion

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
