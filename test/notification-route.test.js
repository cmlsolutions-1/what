import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ||= "postgresql://localhost/whatsapp_notifier_test";
process.env.API_KEY = "local-test-api-key";
process.env.RESTORE_SESSIONS_ON_STARTUP = "false";
process.env.ALERT_EMAIL_ENABLED = "false";

const { default: createApp } = await import("../src/app.js");
const { default: NotificationController } = await import("../src/infrastructure/http/controllers/notification-controller.js");

test("la ruta de envío distingue un resultado sin confirmación", async () => {
  const controller = new NotificationController({
    sendNotificationUseCase: {
      async execute() {
        return { messageId: null, confirmationStatus: "unconfirmed" };
      },
    },
  });
  const response = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await controller.send(
    { body: { fromPhoneNumber: "123", toPhoneNumber: "456", message: "Prueba" } },
    response,
    (error) => { throw error; },
  );
  assert.equal(response.statusCode, 202);
  assert.equal(response.body.data.confirmationStatus, "unconfirmed");
  assert.match(response.body.message, /not confirmed/);
});

test("la ruta de envío devuelve JSON para errores de validación", async () => {
  const server = createApp().listen(0);
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/notifications/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "local-test-api-key" },
      body: JSON.stringify({ message: "Prueba" }),
    });
    assert.equal(response.status, 400);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.equal((await response.json()).message, "fromPhoneNumber, toPhoneNumber and message are required");
  } finally {
    server.close();
  }
});

test("la ruta de envío rechaza solicitudes sin API key", async () => {
  const server = createApp().listen(0);
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/notifications/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 401);
  } finally {
    server.close();
  }
});
