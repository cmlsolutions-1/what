import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ||= "postgresql://localhost/whatsapp_notifier_test";
process.env.API_KEY ||= "local-test-api-key";

const { default: WhatsappWebSessionManager } = await import(
  "../src/infrastructure/whatsapp/whatsapp-web-session-manager.js"
);

test("un fallo de inicialización destruye el cliente y permite reintentar", async () => {
  const manager = Object.create(WhatsappWebSessionManager.prototype);
  const failure = new Error("WhatsApp Web initialization failed");
  let destroyed = 0;

  manager.logger = { error() {} };
  manager.sessions = new Map();
  manager.connectingPromises = new Map();
  manager.reconnectTimers = new Map();
  manager.updateConnectionStatusSafe = async () => {};
  manager.sendAlertSafe = async () => {};
  manager.registerClientEvents = () => {};
  manager.createClient = () => ({
    async initialize() { throw failure; },
    async destroy() { destroyed++; },
  });

  const sender = { id: 4, authFolder: "sender_573001112233" };
  for (let attempt = 1; attempt <= 2; attempt++) {
    await assert.rejects(manager.connect(sender), (error) =>
      error.statusCode === 502 &&
      error.details?.code === "WHATSAPP_INITIALIZE_FAILED" &&
      error.details?.stage === "initialize"
    );
    assert.equal(destroyed, attempt);
    assert.equal(manager.sessions.has(4), false);
    assert.equal(manager.connectingPromises.has(4), false);
  }
});
