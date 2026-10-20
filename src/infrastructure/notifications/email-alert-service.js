import nodemailer from "nodemailer";

import env from "../../config/env.js";

class EmailAlertService {
  constructor({ logger, transporter, createTransport = nodemailer.createTransport, config = env }) {
    this.logger = logger;
    this.config = config;
    this.lastAlertByKey = new Map();

    this.enabled =
      config.alertEmailEnabled &&
      Boolean(config.gmailUser) &&
      Boolean(config.gmailAppPassword);

    if (!this.enabled) {
      this.logger.warn(
        "Email alerts are disabled. Set ALERT_EMAIL_ENABLED=true, GMAIL_USER and GMAIL_APP_PASSWORD to enable them",
      );
      return;
    }

    this.recipient = config.alertEmailTo || config.gmailUser;
    this.transporter = transporter ?? createTransport({
      service: "gmail",
      auth: {
        user: config.gmailUser,
        pass: config.gmailAppPassword,
      },
    });
  }

  async sendSenderAlert({ sender, status, reason, message }) {
    if (!this.enabled) return false;

    const senderId = sender?.id ?? "unknown";
    const alertKey = `${senderId}:${status}:${reason ?? "none"}`;
    const now = Date.now();
    const lastAlertAt = this.lastAlertByKey.get(alertKey) ?? 0;

    if (now - lastAlertAt < this.config.alertEmailCooldownMs) {
      return false;
    }

    const displayName = sender?.displayName ?? `Sender ${senderId}`;
    const phoneNumber = sender?.phoneNumber ?? sender?.normalizedPhoneNumber ?? "N/A";
    const subject = `[WhatsApp API] Novedad en ${displayName}: ${status}`;
    const text = [
      "Se detectó una novedad en una línea de WhatsApp.",
      "",
      `Línea: ${displayName}`,
      `Teléfono: ${phoneNumber}`,
      `Estado: ${status}`,
      `Razón: ${reason || "N/A"}`,
      `Fecha: ${new Date().toISOString()}`,
      "",
      message,
      "",
      "Revisa el panel administrativo para reconectar o escanear QR si aplica.",
    ].join("\n");

    try {
      await this.transporter.sendMail({
        from: `"WhatsApp API" <${this.config.gmailUser}>`,
        to: this.recipient,
        subject,
        text,
      });

      this.lastAlertByKey.set(alertKey, now);

      this.logger.info(
        { senderId, status, reason },
        "WhatsApp sender alert email sent",
      );
      return true;
    } catch (error) {
      this.logger.error(
        {
          senderId,
          status,
          reason,
          message: error instanceof Error ? error.message : String(error),
          code: error?.code,
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Failed to send WhatsApp sender alert email",
      );
      return false;
    }
  }
}

export default EmailAlertService;
