import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const authDir = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-recovery-"));
process.env.WWEBJS_AUTH_DIR = authDir;
process.env.DATABASE_URL ||= "postgresql://localhost/whatsapp_notifier_test";
process.env.API_KEY ||= "local-test-api-key";

const { default: WhatsappWebSessionManager } = await import(
  "../src/infrastructure/whatsapp/whatsapp-web-session-manager.js"
);
const { default: DeleteSenderUseCase } = await import(
  "../src/application/use-cases/delete-sender-use-case.js"
);

test("archiva el perfil antiguo sin afectar otras líneas", async (t) => {
  t.after(() => {
    const resolved = path.resolve(authDir);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  });

  const oldPath = path.join(authDir, "session-sender_573001112233");
  const otherPath = path.join(authDir, "session-sender_573009998888");
  fs.mkdirSync(oldPath);
  fs.mkdirSync(otherPath);
  fs.writeFileSync(path.join(oldPath, "saved-state"), "preserved");

  const manager = Object.create(WhatsappWebSessionManager.prototype);
  manager.sessions = new Map();
  manager.connectingPromises = new Map();
  manager.reconnectTimers = new Map();
  manager.logger = { info() {}, error() {} };
  manager.updateConnectionStatusSafe = async () => {};

  const sender = { id: 4, authFolder: "sender_573001112233" };
  const result = await manager.resetAuth(sender);
  assert.deepEqual(result, { status: "disconnected", archived: true });
  assert.equal(fs.existsSync(oldPath), false);
  assert.equal(fs.existsSync(otherPath), true);

  const backups = fs.readdirSync(authDir).filter((name) =>
    name.startsWith("session-sender_573001112233-backup-")
  );
  assert.equal(backups.length, 1);
  assert.equal(fs.readFileSync(path.join(authDir, backups[0], "saved-state"), "utf8"), "preserved");
  assert.deepEqual(await manager.resetAuth(sender), { status: "disconnected", archived: false });

  manager.sessions.set(4, { status: "connected" });
  await assert.rejects(manager.resetAuth(sender), (error) => error.statusCode === 409);
});

test("elimina el registro solo después de archivar su sesión", async () => {
  const sender = { id: 4, authFolder: "sender_573001112233" };
  const operations = [];
  const repository = {
    async findById() { return sender; },
    async deleteById() { operations.push("delete"); return true; },
  };
  const sessionManager = {
    async resetAuth() { operations.push("archive"); return { status: "disconnected", archived: true }; },
  };
  const useCase = new DeleteSenderUseCase(repository, sessionManager);

  assert.deepEqual(await useCase.execute(4), {
    sender,
    session: { status: "disconnected", archived: true },
  });
  assert.deepEqual(operations, ["archive", "delete"]);
});
