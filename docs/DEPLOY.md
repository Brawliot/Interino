# Despliegue y dominio propio

## Cloudflare Pages (actual)

- Repo: GitHub `Interino`
- Build: `npm run build`
- Output: `dist`
- URL: `interino.pages.dev`
- Variables: `VITE_DATA_CATEGORIAS_URL` en `.env.production` (R2)

## Dominio propio (pendiente de compra)

1. Comprar dominio (p. ej. `interino.app`, `consultainterino.es`).
2. Cloudflare Dashboard → **Pages** → proyecto Interino → **Custom domains** → Add.
3. Seguir DNS (CNAME a `interino.pages.dev` o nameservers Cloudflare).
4. Activar HTTPS (automatico).
5. Opcional: redirigir `www` → raiz.

No requiere cambios de codigo salvo actualizar enlaces publicos si cambias marca.

## PWA

- Manifest: `public/manifest.webmanifest`
- Service worker: `public/sw.js` (shell offline; JSON de bolsas siempre desde red/R2)
- Instalable desde Chrome/Edge en Android y escritorio («Anadir a pantalla de inicio»)

## SEO

Meta tags en `index.html`. Tras dominio propio, actualizar `og:url` si se hardcodea.

## Beta publica — checklist

- [ ] Dominio propio
- [ ] Probar instalacion PWA en movil
- [ ] Enlace feedback en Mas → email operativo
- [ ] Consulta legal antes de cobros (ver README)
- [ ] Subir manifest bolsa educacion a R2 (163 listados)
