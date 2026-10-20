import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";

process.env.DATABASE_URL ||= "postgresql://localhost/whatsapp_notifier_test";
process.env.API_KEY ||= "local-test-api-key";

const { default: WhatsappWebSessionManager } = await import(
  "../src/infrastructure/whatsapp/whatsapp-web-session-manager.js"
);

const flushEvents = () => new Promise((resolve) => setImmediate(resolve));

function buildManager() {
  const manager = Object.create(WhatsappWebSessionManager.prototype);
  manager.logger = { info() {}, warn() {}, error() {} };
  manager.sessions = new Map();
  manager.reconnectAttempts = new Map();
  manager.reconnectTimers = new Map();
  manager.updateConnectionStatusSafe = async () => {};
  manager.clearAuthStateSafe = async () => {};
  manager.safeDestroyClient = async (client) => client.destroy?.();
  manager.scheduleReconnect = () => {};
  manager.clearReconnectTimer = () => {};
  manager.alerts = [];
  manager.sendAlertSafe = async (alert) => manager.alerts.push(alert);
  return manager;
}

function buildSession(client) {
  return {
    client,
    status: "connected",
    qr: null,
    lastDisconnectReason: null,
    reconnectTimer: null,
    authClientId: "sender_9",
    isClosing: false,
  };
}

test("auth_failure y logged_out generan alertas", async () => {
  for (const [event, value, expectedReason] of [
    ["auth_failure", undefined, "auth_failure"],
    ["disconnected", "LOGOUT", "logged_out"],
  ]) {
    const manager = buildManager();
    const client = new EventEmitter();
    client.destroy = async () => {};
    const session = buildSession(client);
    const sender = { id: 9, displayName: "Línea nueve", phoneNumber: "+579999999999" };
    manager.sessions.set(9, session);
    manager.registerClientEvents({ sender, session });

    client.emit(event, value);
    await flushEvents();

    assert.equal(manager.alerts.length, 1);
    assert.equal(manager.alerts[0].reason, expectedReason);
  }
});

test("una desconexión inesperada genera alerta y una manual no", async () => {
  const sender = { id: 9, displayName: "Línea nueve", phoneNumber: "+579999999999" };

  const unexpectedManager = buildManager();
  const unexpectedClient = new EventEmitter();
  unexpectedClient.destroy = async () => {};
  const unexpectedSession = buildSession(unexpectedClient);
  unexpectedManager.sessions.set(9, unexpectedSession);
  unexpectedManager.registerClientEvents({ sender, session: unexpectedSession });
  unexpectedClient.emit("disconnected", "NAVIGATION");
  await flushEvents();
  assert.equal(unexpectedManager.alerts.length, 1);
  assert.equal(unexpectedManager.alerts[0].reason, "navigation");

  const manualManager = buildManager();
  const manualClient = new EventEmitter();
  manualClient.destroy = async () => manualClient.emit("disconnected", "NAVIGATION");
  const manualSession = buildSession(manualClient);
  manualManager.sessions.set(9, manualSession);
  manualManager.registerClientEvents({ sender, session: manualSession });
  await manualManager.disconnect(9);
  await flushEvents();
  assert.equal(manualManager.alerts.length, 0);
});

test("ready invalida los enlaces públicos activos de la línea", async () => {
  const manager = buildManager();
  const consumed = [];
  manager.pairingLinkRepository = {
    async consumeActiveForSender(senderId, reason) { consumed.push({ senderId, reason }); },
  };
  const client = new EventEmitter();
  client.destroy = async () => {};
  const session = buildSession(client);
  const sender = { id: 9, displayName: "Línea nueve", phoneNumber: "+579999999999" };
  manager.sessions.set(9, session);
  manager.registerClientEvents({ sender, session });

  client.emit("ready");
  await flushEvents();

  assert.deepEqual(consumed, [{ senderId: 9, reason: "connected" }]);
  assert.equal(session.status, "connected");
});
