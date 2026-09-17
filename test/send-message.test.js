import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ||= "postgresql://localhost/whatsapp_notifier_test";
process.env.API_KEY ||= "local-test-api-key";

const { default: WhatsappWebSessionManager } = await import(
  "../src/infrastructure/whatsapp/whatsapp-web-session-manager.js"
);

test("no toma control de otra sesión web por defecto", () => {
  const manager = Object.create(WhatsappWebSessionManager.prototype);
  const client = manager.createClient("sender_test");
  assert.equal(client.options.takeoverOnConflict, false);
  if (process.platform === "darwin") {
    assert.equal(client.options.puppeteer.headless, false);
    assert.deepEqual(client.options.puppeteer.args, []);
  }
});

function managerWithClient(client) {
  const manager = Object.create(WhatsappWebSessionManager.prototype);
  manager.sessions = new Map([[4, { status: "connected", client }]]);
  manager.logger = { error() {}, warn() {} };
  return manager;
}

test("envía directamente aunque la interfaz para abrir el chat no funcione", async () => {
  let sent;
  let opened = false;
  const manager = managerWithClient({
    interface: { openChatWindow() { opened = true; throw new Error("WhatsApp UI changed"); } },
    async getNumberId() { return { _serialized: "573001112233@c.us" }; },
    async sendMessage(chatId, message, options) {
      sent = { chatId, message, options };
      return { id: { _serialized: "message-123" } };
    },
  });

  const result = await manager.sendMessage({
    senderId: 4,
    recipientPhoneNumber: "+57 300 111 2233",
    message: "Prueba",
  });

  assert.deepEqual(sent, {
    chatId: "573001112233@c.us",
    message: "Prueba",
    options: { waitUntilMsgSent: true },
  });
  assert.equal(opened, false);
  assert.equal(result.messageId, "message-123");
  assert.equal(result.confirmationStatus, "confirmed");
});

test("marca el envío como indeterminado si WhatsApp no devuelve ID", async () => {
  const manager = managerWithClient({
    async getNumberId() { return { _serialized: "573001112233@c.us" }; },
    async sendMessage() { return undefined; },
  });

  const result = await manager.sendMessage({
    senderId: 4,
    recipientPhoneNumber: "+573001112233",
    message: "Prueba",
  });
  assert.equal(result.messageId, null);
  assert.equal(result.confirmationStatus, "unconfirmed");
  assert.equal(result.sentAt, null);
});

test("distingue errores de consulta del destinatario y errores de envío", async () => {
  for (const [client, expectedCode] of [
    [{ async getNumberId() { throw new Error("page closed"); } }, "RECIPIENT_LOOKUP_FAILED"],
    [{ async getNumberId() { return { _serialized: "573001112233@c.us" }; }, async sendMessage() { throw new Error("page closed"); } }, "WHATSAPP_SEND_FAILED"],
  ]) {
    const manager = managerWithClient(client);
    await assert.rejects(
      manager.sendMessage({ senderId: 4, recipientPhoneNumber: "+573001112233", message: "Prueba" }),
      (error) => error.statusCode === 502 && error.details?.code === expectedCode,
    );
  }
});
