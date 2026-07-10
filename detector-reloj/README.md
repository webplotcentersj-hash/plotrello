# Detector reloj tablet (Paso 1)

Servicio Python en la VPS Hostinger: **YOLO + supervision** para validar que hay **una persona** frente a la cámara antes de llamar a Gemini.

## Qué hace

- `GET /health` — estado del servicio
- `POST /detectar` — recibe JPEG, responde `{ ok: true/false, personas, motivo, ms }`
- Header obligatorio: `X-Detector-Key: <DETECTOR_API_KEY>`

## Deploy en Hostinger (paso a paso)

### 1. Subir archivos a la VPS

Por SSH (`root@187.77.251.35` o el Terminal del panel):

```bash
mkdir -p /opt/reloj-detector
cd /opt/reloj-detector
```

Copiá esta carpeta (`detector-reloj/`) ahí (git clone del repo, scp, o pegar archivos).

### 2. Configurar clave

```bash
cp .env.example .env
nano .env
```

Generá una clave larga para `DETECTOR_API_KEY` (guardala: la vas a usar en Vercel en el paso 2).

### 3. Levantar con Docker

```bash
docker compose build
docker compose up -d
docker compose logs -f
```

La primera vez descarga `yolov8n.pt` (~6 MB). Puede tardar 1–2 minutos.

### 4. Probar en la VPS

```bash
curl http://127.0.0.1:8080/health
```

Con una foto de prueba:

```bash
curl -X POST http://127.0.0.1:8080/detectar \
  -H "X-Detector-Key: TU_CLAVE" \
  -F "file=@/ruta/a/foto.jpg"
```

Respuesta esperada si hay una persona de frente:

```json
{"ok": true, "personas": 1, "area": 0.15, "confianza": 0.87, "motivo": "Persona detectada", "ms": 280}
```

### 5. Nginx + HTTPS (subdominio)

Ejemplo `detector.plotcenter.com.ar` → `127.0.0.1:8080`

```nginx
server {
    listen 80;
    server_name detector.plotcenter.com.ar;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_read_timeout 30s;
        client_max_body_size 5m;
    }
}
```

```bash
sudo certbot --nginx -d detector.plotcenter.com.ar
```

En DNS (Hostinger): registro **A** `detector` → IP de la VPS.

### 6. Verificar desde afuera

```bash
curl https://detector.plotcenter.com.ar/health
```

## Recursos

- Usa **yolov8n** (nano) para CPU
- Límite de memoria en compose: 1.5 GB
- Puerto 8080 solo en localhost; afuera entra por nginx 443

## Siguiente paso

Cuando `/health` y `/detectar` funcionen en la VPS, avisá y seguimos con:

- **Paso 2:** proxy en Vercel (`RELOJ_DETECTOR_URL` + `RELOJ_DETECTOR_API_KEY`)
- **Paso 3:** integración en la tablet antes de `marcar-auto` (ya en plotrello)

### Exponer el detector a internet (para Vercel)

El puerto 8080 está solo en localhost. Instalá nginx:

```bash
apt install -y nginx
nano /etc/nginx/sites-available/reloj-detector
```

Contenido (con subdominio o solo IP):

```nginx
server {
    listen 80;
    server_name detector.plotcenter.com.ar;   # o _ para cualquier host / solo IP

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_read_timeout 30s;
        client_max_body_size 5m;
    }
}
```

```bash
ln -sf /etc/nginx/sites-available/reloj-detector /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

Probar desde afuera:

```bash
curl http://TU_IP/health
# o curl https://detector.plotcenter.com.ar/health
```

En **Vercel** → Environment Variables:

| Variable | Ejemplo |
|----------|---------|
| `RELOJ_DETECTOR_URL` | `http://187.77.251.35/detectar` o `https://detector.plotcenter.com.ar/detectar` |
| `RELOJ_DETECTOR_API_KEY` | la misma que `DETECTOR_API_KEY` en `.env` de la VPS |

Redeploy plotrello en Vercel.
