import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ||= "postgresql://localhost/whatsapp_notifier_test";
process.env.API_KEY ||= "local-test-api-key";

const { default: CreatePairingLinkUseCase } = await import(
  "../src/application/use-cases/create-pairing-link-use-case.js"
);
const { default: ResolvePairingLinkUseCase } = await import(
  "../src/application/use-cases/resolve-pairing-link-use-case.js"
);
const { hashPairingToken } = await import("../src/shared/utils/pairing-token.js");

const sender = {
  id: 12,
  displayName: "Hotel Central",
  phoneNumber: "+570000000012",
  normalizedPhoneNumber: "570000000012",
  status: "disconnected",
};

test("crea una URL temporal sin almacenar el token en texto plano", async () => {
  let stored;
  const useCase = new CreatePairingLinkUseCase(
    { async findById() { return sender; } },
    { async create(value) { stored = value; } },
    { getStatus() { return { status: "disconnected" }; } },
    { pairingLinkTtlMinutes: 30, pairingFrontendBaseUrl: "https://panel.example.com/vincular/" },
  );

  const result = await useCase.execute(12);
  const token = result.url.split("/").at(-1);
  assert.match(token, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(stored.tokenHash, hashPairingToken(token));
  assert.equal(JSON.stringify(stored).includes(token), false);
  assert.equal(result.url.startsWith("https://panel.example.com/vincular/"), true);
  assert.equal(result.sender.displayName, "Hotel Central");
});

test("no crea enlace para una sesión ya conectada", async () => {
  const useCase = new CreatePairingLinkUseCase(
    { async findById() { return sender; } },
    { async create() { throw new Error("must not create"); } },
    { getStatus() { return { status: "connected" }; } },
    { pairingLinkTtlMinutes: 30, pairingFrontendBaseUrl: "https://panel.example.com/vincular" },
  );
  await assert.rejects(useCase.execute(12), (error) =>
    error.statusCode === 409 && error.details?.code === "SENDER_ALREADY_CONNECTED"
  );
});

test("rechaza enlaces vencidos y los marca como consumidos", async () => {
  const token = "a".repeat(43);
  let consumed;
  const useCase = new ResolvePairingLinkUseCase(
    { async findById() { return sender; } },
    {
      async findByTokenHash(hash) {
        assert.equal(hash, hashPairingToken(token));
        return { id: 8, senderId: 12, expiresAt: new Date(Date.now() - 1000), usedAt: null };
      },
      async consumeById(id, reason) { consumed = { id, reason }; },
    },
  );
  await assert.rejects(useCase.execute(token), (error) =>
    error.statusCode === 410 && error.details?.code === "PAIRING_LINK_EXPIRED"
  );
  assert.deepEqual(consumed, { id: 8, reason: "expired" });
});

test("un enlace consumido al conectar informa finalización", async () => {
  const useCase = new ResolvePairingLinkUseCase(
    { async findById() { return sender; } },
    {
      async findByTokenHash() {
        return {
          id: 8,
          senderId: 12,
          expiresAt: new Date(Date.now() + 60_000),
          usedAt: new Date(),
          usedReason: "connected",
        };
      },
    },
  );
  await assert.rejects(useCase.execute("b".repeat(43)), (error) =>
    error.statusCode === 410 && error.details?.code === "PAIRING_COMPLETED"
  );
});
