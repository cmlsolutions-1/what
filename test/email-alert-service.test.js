import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ||= "postgresql://localhost/whatsapp_notifier_test";
process.env.API_KEY ||= "local-test-api-key";

const { default: EmailAlertService } = await import(
  "../src/infrastructure/notifications/email-alert-service.js"
);

function buildConfig(overrides = {}) {
  return {
    alertEmailEnabled: true,
    alertEmailTo: undefined,
    gmailUser: "sender@example.com",
    gmailAppPassword: "secret-used-only-in-test",
    alertEmailCooldownMs: 60_000,
    ...overrides,
  };
}

function buildLogger() {
  return {
    infoCalls: [],
    warnCalls: [],
    errorCalls: [],
    info(...args) { this.infoCalls.push(args); },
    warn(...args) { this.warnCalls.push(args); },
    error(...args) { this.errorCalls.push(args); },
  };
}

test("Nodemailer usa GMAIL_USER y GMAIL_APP_PASSWORD y el destinatario cae en GMAIL_USER", async () => {
  const logger = buildLogger();
  let transportOptions;
  let mail;
  const transporter = {
    async sendMail(value) { mail = value; },
  };
  const service = new EmailAlertService({
    logger,
    config: buildConfig(),
    createTransport(options) {
      transportOptions = options;
      return transporter;
    },
  });

  const sent = await service.sendSenderAlert({
    sender: { id: 7, displayName: "Hotel Central", phoneNumber: "+570000000000" },
    status: "logged_out",
    reason: "logged_out",
    message: "La sesión fue cerrada.",
  });

  assert.equal(sent, true);
  assert.deepEqual(transportOptions.auth, {
    user: "sender@example.com",
    pass: "secret-used-only-in-test",
  });
  assert.equal(mail.to, "sender@example.com");
  assert.match(mail.text, /Línea: Hotel Central/);
  assert.match(mail.text, /Teléfono: \+570000000000/);
  assert.match(mail.text, /Razón: logged_out/);
  assert.match(mail.text, /Fecha: \d{4}-\d{2}-\d{2}T/);
});

test("ALERT_EMAIL_TO tiene prioridad sobre GMAIL_USER", async () => {
  let mail;
  const service = new EmailAlertService({
    logger: buildLogger(),
    config: buildConfig({ alertEmailTo: "alerts@example.com" }),
    transporter: { async sendMail(value) { mail = value; } },
  });
  await service.sendSenderAlert({ sender: { id: 1 }, status: "disconnected", reason: "navigation", message: "Prueba" });
  assert.equal(mail.to, "alerts@example.com");
});

test("un fallo de Gmail registra campos seguros y permite reintentar", async () => {
  const logger = buildLogger();
  const error = new Error("Invalid login");
  error.code = "EAUTH";
  let attempts = 0;
  const service = new EmailAlertService({
    logger,
    config: buildConfig(),
    transporter: { async sendMail() { attempts++; throw error; } },
  });
  const alert = { sender: { id: 3 }, status: "needs_reauth", reason: "auth_failure", message: "Prueba" };

  assert.equal(await service.sendSenderAlert(alert), false);
  assert.equal(await service.sendSenderAlert(alert), false);
  assert.equal(attempts, 2);
  const fields = logger.errorCalls[0][0];
  assert.equal(fields.message, "Invalid login");
  assert.equal(fields.code, "EAUTH");
  assert.match(fields.stack, /Invalid login/);
  assert.equal("error" in fields, false);
  assert.doesNotMatch(JSON.stringify(logger.errorCalls), /secret-used-only-in-test/);
});
