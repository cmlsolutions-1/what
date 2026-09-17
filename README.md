# API de notificaciones WhatsApp

API REST para registrar líneas emisoras, vincularlas mediante QR y enviar notificaciones. Usa Node.js, PostgreSQL y `whatsapp-web.js`.

La dependencia `whatsapp-web.js` está fijada en `1.34.7`: esta versión dejó de cargar todos los módulos internos de WhatsApp Web para inicializar la sesión. Si se cambia de versión, hay que volver a verificar la vinculación y el envío antes de desplegar.

## Preparar el entorno local

Requisitos: Node.js 20 o superior, PostgreSQL y Chrome/Chromium. Instala dependencias con `npm ci` y configura `.env` tomando `.env.example` como referencia. No uses la base de datos, la API key ni el directorio de sesiones de producción durante las pruebas.

Variables principales:

| Variable | Valor local sugerido | Uso |
| --- | --- | --- |
| `PORT` | `3010` | Puerto HTTP |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5439/whatsapp_notifier` | Conexión a PostgreSQL |
| `API_KEY` | Valor aleatorio propio | Cabecera `x-api-key` |
| `WWEBJS_AUTH_DIR` | `.wwebjs_auth` | Sesiones locales |
| `PRINT_QR_IN_TERMINAL` | `false` | Mostrar QR también en terminal |
| `WWEBJS_TAKEOVER_ON_CONFLICT` | `false` | Evita desplazar otra sesión web del mismo número |
| `WWEBJS_HEADLESS` | `false` para diagnóstico en macOS | Permite ver el Chrome controlado por la API; producción puede usar `true` |
| `RESTORE_SESSIONS_ON_STARTUP` | `false` | Evita restaurar todas las líneas al probar localmente |
| `WWEBJS_EXECUTABLE_PATH` / `PUPPETEER_EXECUTABLE_PATH` | Vacío si Puppeteer encuentra Chromium | Ruta al navegador, si hace falta |

Las variables de alertas por correo son opcionales. Para pruebas locales, usa `ALERT_EMAIL_ENABLED=false`; deja usuario y contraseña de Gmail vacíos. Si `PORT` está vacío, se usa `3010`.

Para iniciar sólo la base de datos incluida en `docker-compose.yml`:

```bash
docker compose up -d postgres
npm run db:init
npm run dev
```

Si PostgreSQL ya está instalado localmente, puedes usarlo y ajustar `DATABASE_URL`. La API responde en `http://localhost:3010/health`.

## Pruebas sin WhatsApp ni credenciales

```bash
npm test
```

Estas pruebas verifican el envío directo con un cliente simulado y las respuestas JSON de error. No envían mensajes reales.

## Endpoints

Todos los endpoints bajo `/api` requieren la cabecera `x-api-key`.

| Acción | Método y ruta |
| --- | --- |
| Registrar emisor | `POST /api/senders` |
| Listar emisores | `GET /api/senders` |
| Iniciar conexión | `POST /api/senders/:senderId/connect` |
| Consultar estado y QR | `GET /api/senders/:senderId/status` |
| Desconectar | `GET /api/senders/:senderId/disconnect` |
| Archivar sesión guardada para volver a vincular | `POST /api/senders/:senderId/reset-auth` |
| Eliminar emisor y liberar su número | `DELETE /api/senders/:senderId` |
| Enviar notificación | `POST /api/notifications/send` |

Si una línea antigua no puede inicializarse pero una nueva sí conecta, usa `POST /api/senders/:senderId/reset-auth` para esa línea y después `POST /api/senders/:senderId/connect`. El primer paso desconecta la línea, mueve su carpeta de autenticación a una copia con sufijo `backup-...` dentro de `WWEBJS_AUTH_DIR` y conserva el registro en PostgreSQL. No se permite restablecer una línea conectada ni una conexión que esté iniciándose. El segundo paso genera un QR nuevo para volver a vincular el teléfono. Hazlo una línea a la vez; el teléfono deberá escanear el QR de nuevo.

Si necesitas registrar de nuevo el mismo número con otro ID, usa `DELETE /api/senders/:senderId` mientras la línea esté desconectada. La operación también archiva la carpeta de autenticación, elimina el registro de PostgreSQL y libera la restricción de número único. Luego llama a `POST /api/senders` y vincula la nueva línea con QR. La línea nueva tendrá otro ID; cualquier sistema que guarde el ID anterior deberá actualizarlo. Las copias de sesión archivadas permanecen en `WWEBJS_AUTH_DIR` para recuperación manual.

Ejemplo de envío:

```json
{
  "fromPhoneNumber": "+573001112233",
  "toPhoneNumber": "+573004445566",
  "message": "Tu pedido fue confirmado"
}
```

El envío utiliza el ID del destinatario que devuelve `whatsapp-web.js`. No necesita abrir la ventana del chat. Si la consulta del destinatario o el envío fallan, la API responde JSON con `message` y `details.code` / `details.stage`. El error original se registra en los logs del servidor sin devolver datos internos de WhatsApp al cliente. Un resultado `200` incluye `messageId` y `confirmationStatus: "confirmed"`; confirma que la librería devolvió el mensaje, no la entrega al teléfono destino. Si la librería no devuelve un ID, la API responde `202` con `messageId: null` y `confirmationStatus: "unconfirmed"`. En ese caso la entrega es indeterminada: comprueba el chat o el teléfono destino antes de reintentar para evitar duplicados.

Para una prueba real, registra una línea local, vincúlala con el QR, confirma `session.status: connected` y envía un mensaje a un número de prueba autorizado. Ese flujo necesita WhatsApp y PostgreSQL disponibles y no forma parte de `npm test`.
