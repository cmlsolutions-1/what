# WhatsApp Notifications API (Baileys + PostgreSQL)

API REST para registrar numeros emisores de WhatsApp y enviar notificaciones desde el numero emisor indicado.

## Estructura

```text
src/
  app.js
  server.js
  config/
    env.js
    logger.js
  shared/
    errors/
    utils/
  domain/
    entities/
    repositories/
  application/
    use-cases/
  infrastructure/
    database/
      migrations/
    repositories/
    whatsapp/
    http/
      controllers/
      routes/
      middlewares/
  scripts/
    init-db.js
```

## Requisitos

- Node.js 18+
- PostgreSQL activo

## Configuracion

1. Copia variables de entorno:

```bash
cp .env.example .env
```

2. Ajusta `DATABASE_URL` con tus credenciales.

## Inicializar base de datos

```bash
npm run db:init
```

Esto crea la tabla `whatsapp_senders`.

## Ejecutar API

```bash
npm run dev
```

Base URL: `http://localhost:3010`

## Endpoints

### 1) Registrar numero emisor

`POST /api/senders`

Body:

```json
{
  "displayName": "Linea Ventas",
  "phoneNumber": "+573001112233"
}
```

### 2) Listar numeros emisores

`GET /api/senders`

### 3) Iniciar conexion WhatsApp de un emisor (QR)

`POST /api/senders/:senderId/connect`

Respuesta:
- `status: "qr"` cuando hay QR para escanear.
- `status: "connected"` cuando la sesion ya esta activa.

### 4) Consultar estado de sesion

`GET /api/senders/:senderId/status`

### 5) Enviar notificacion

`POST /api/notifications/send`

Body:

```json
{
  "fromPhoneNumber": "+573001112233",
  "toPhoneNumber": "+573004445566",
  "message": "Tu pedido fue confirmado"
}
```

## Flujo recomendado

1. Crear emisor en `/api/senders`.
2. Conectar emisor en `/api/senders/:senderId/connect`.
3. Obtener QR y escanear con WhatsApp del emisor.
4. Verificar estado `connected` con `/api/senders/:senderId/status`.
5. Enviar mensajes con `/api/notifications/send`.

## Notas

- Las credenciales de Baileys se guardan en `.baileys_auth/`.
- Si un emisor no esta conectado, la API devolvera error 400 al enviar.
- `PRINT_QR_IN_TERMINAL=true` imprime QR en consola para escaneo rapido.



