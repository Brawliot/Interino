# Auth Interino (Cloudflare Pages + D1)

Login sin contraseña ni pagos: **magic link** por email. Los seguimientos se sincronizan en D1 cuando hay sesión.

## Arquitectura

| Pieza | Rol |
|-------|-----|
| Pages Functions (`functions/api/*`) | `/api/auth/*`, `/api/me`, `/api/seguimientos` |
| D1 (`interino-auth`) | users, magic_tokens, sessions, seguimientos |
| Cookie `interino_session` | HttpOnly, Secure, SameSite=Lax, 30 días |
| Resend | Envío del enlace (opcional en local con `AUTH_DEV_MODE`) |

Flujo: email → token hasheado en D1 → enlace `/api/auth/callback?token=…` → cookie de sesión → redirect `/?login=ok`.

## Variables (Pages → Settings → Environment variables)

| Variable | Obligatorio | Descripción |
|----------|-------------|-------------|
| `APP_ORIGIN` | sí (prod) | p.ej. `https://interino.pages.dev` |
| `AUTH_DEV_MODE` | local | `1` = no envía email; la API devuelve `devLink` |
| `RESEND_API_KEY` | prod sin dev mode | API key de Resend |
| `AUTH_FROM_EMAIL` | recomendado | p.ej. `Interino <onboarding@resend.dev>` |
| `AUTH_SECRET` | reserva | string aleatorio (futuro) |

El binding D1 se declara en `wrangler.toml` (`DB` → `interino-auth`).

## Crear D1 y migrar (una vez)

```bash
npx wrangler login
npx wrangler d1 create interino-auth
```

Copia el `database_id` real en `wrangler.toml`. Luego:

```bash
npx wrangler d1 migrations apply interino-auth --local
npx wrangler d1 migrations apply interino-auth --remote
```

En el dashboard de Cloudflare Pages, vincula la misma base D1 al proyecto con binding `DB`.

## Desarrollo local con Functions

`npm run dev` (Vite solo) no ejecuta Functions: `/api/*` fallará.

```bash
npm run build
npx wrangler pages dev dist --d1=DB=interino-auth --local
```

Pon `AUTH_DEV_MODE=1` en el entorno de `pages dev` (`.dev.vars`):

```
AUTH_DEV_MODE=1
APP_ORIGIN=http://127.0.0.1:8788
```

Pide el enlace en **Más → Cuenta**; la respuesta JSON incluye `devLink`.

## Endpoints

- `POST /api/auth/request` `{ "email": "…" }` → `{ ok, message, devLink? }`
- `GET /api/auth/callback?token=…` → cookie + redirect
- `POST /api/auth/logout`
- `GET /api/me` → `{ user, authConfigured }`
- `GET|PUT /api/seguimientos` (sesión requerida)

## Cliente

- `src/auth.js` — fetch + fusión local/nube
- `src/pantallas/PantallaCuenta.jsx` — UI
- Entrada desde **Más → Cuenta**

Web Push: ver [PUSH.md](./PUSH.md).
