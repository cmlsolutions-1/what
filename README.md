# WhatsApp Notifications API (whatsapp-web.js + PostgreSQL)

API REST para registrar numeros emisores de WhatsApp y enviar notificaciones desde el numero emisor indicado.

## Requisitos

- Node.js 18+
- PostgreSQL activo
- Chrome/Chromium instalado (si no usas el binario por defecto de Puppeteer)

## Configuracion

1. Copia variables de entorno:

```powershell
Copy-Item .env.example .env
```

2. Ajusta `DATABASE_URL` y, si aplica, `WWEBJS_EXECUTABLE_PATH`.

## Variables de entorno

- `PORT`: puerto HTTP.
- `DATABASE_URL`: cadena de conexion Postgres.
- `PRINT_QR_IN_TERMINAL`: `true|false` para mostrar QR.
- `WWEBJS_AUTH_DIR`: carpeta local de sesiones de whatsapp-web.js.
- `WWEBJS_HEADLESS`: `true|false` para ejecutar navegador en headless.
- `WWEBJS_EXECUTABLE_PATH`: ruta a Chrome/Chromium (opcional).

## Inicializar base de datos

```bash
npm run db:init
```

Crea/actualiza la tabla `whatsapp_senders`.

## Ejecutar API

```bash
npm run dev
```

Base URL: `http://localhost:3010`

## Endpoints

### 1) Registrar numero emisor

`POST /api/senders`

```json
{
  "displayName": "Linea Ventas",
  "phoneNumber": "+573001112233"
}
```

### 2) Listar emisores

`GET /api/senders`

### 3) Conectar emisor (QR)

`POST /api/senders/:senderId/connect`

### 4) Estado de sesion

`GET /api/senders/:senderId/status`

### 5) Enviar notificacion

`POST /api/notifications/send`

```json
{
  "fromPhoneNumber": "+573001112233",
  "toPhoneNumber": "+573004445566",
  "message": "Tu pedido fue confirmado"
}
```

## Comportamiento de envio

Antes de enviar el mensaje, la API abre el chat objetivo (open chat window) y luego envia el texto.

## Flujo recomendado

1. Crear emisor.
2. Conectar emisor y escanear QR.
3. Confirmar estado `connected`.
4. Enviar notificaciones.
