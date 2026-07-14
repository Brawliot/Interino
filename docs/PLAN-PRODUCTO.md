# Plan de producto — freemium

Decision cerrada en README: consulta basica gratis; premium ~2,99 EUR.

## Fases

| Fase | Plan | Precio | Estado |
|------|------|--------|--------|
| Beta | `beta` | 0 EUR | **Activa** (`BETA_GRATIS` en `src/plan.js`) |
| Gratis | `gratis` | 0 EUR | Tras beta, con limites |
| Premium | `premium` | 2,99 EUR | Tras legal + Stripe |

## Limites previstos (cuando `BETA_GRATIS = false`)

| Funcion | Gratis | Premium |
|---------|--------|---------|
| Busqueda listados | Si | Si |
| Seguimientos | 8 | Ilimitados |
| Notificaciones locales | Si | Si + push background (futuro) |
| Historico corte / tendencia | Basico | Extendido |
| Sync nube (Supabase) | No | Si |

## Primeros 100 usuarios

Regla de negocio: **gratis de por vida** para los primeros 100. Requiere backend o lista manual al activar cobros — no implementado en beta (todo gratis).

## Activar cobros (checklist)

1. Consulta legal (RGPD + LSSI comercio electronico).
2. Stripe (o similar) + pagina de terminos.
3. Poner `BETA_GRATIS = false` en `src/plan.js`.
4. Implementar checkout y flag `interino_premium_v1` tras pago verificado.

## Codigo

- `src/plan.js` — limites y helpers
- Sin Stripe en repo hasta paso 2.
