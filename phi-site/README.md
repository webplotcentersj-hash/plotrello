# phi (φ) · Plot Design

Landing y web pública para diseñadores externos de Plot Center.

**Producción:** [https://phi-omega-one.vercel.app/](https://phi-omega-one.vercel.app/)

Basada en la plantilla [Paperfolio](https://v0-paperfolio.vercel.app) (neo-brutalista), adaptada para la red **Plot Design**.

## Desarrollo

```bash
npm install
npm run dev
```

## Variables de entorno

Copiá `.env.example` a `.env` y ajustá la URL de Plot Lab si hace falta:

```env
VITE_PLOTLAB_ORIGIN=https://trello.plotcenter.com.ar
```

Los botones de postulación, login y panel diseñador apuntan a esa base.

## Build

```bash
npm run build
npm run preview
```

## Deploy

Proyecto Vite estático: compatible con Vercel, Netlify o cualquier host de `dist/`.
