import nodemailer from "nodemailer";

import env from "../../config/env.js";

class EmailAlertService {
  constructor({ logger }) {
    this.logger = logger;
    this.lastAlertByKey = new Map();

    this.enabled =
      env.alertEmailEnabled &&
      Boolean(env.gmailUser) &&
      Boolean(env.gmailAppPassword) &&
      Boolean(env.alertEmailTo);

    if (!this.enabled) {
      this.logger.warn(
        "Email alerts are disabled. Set ALERT_EMAIL_ENABLED=true, ALERT_EMAIL_TO, GMAIL_USER and GMAIL_APP_PASSWORD to enable them",
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: env.gmailUser,
        pass: env.gmailAppPassword,
      },
    });
  }

  async sendSenderAlert({ sender, status, reason, message }) {
    if (!this.enabled) return;

    const senderId = sender?.id ?? "unknown";
    const alertKey = `${senderId}:${status}:${reason ?? "none"}`;
    const now = Date.now();
    const lastAlertAt = this.lastAlertByKey.get(alertKey) ?? 0;

    if (now - lastAlertAt < env.alertEmailCooldownMs) {
      return;
    }

    this.lastAlertByKey.set(alertKey, now);

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
        from: `"WhatsApp API" <${env.gmailUser}>`,
        to: env.alertEmailTo,
        subject,
        text,
      });

      this.logger.info(
        { senderId, status, reason },
        "WhatsApp sender alert email sent",
      );
    } catch (error) {
      this.logger.error(
        { error, senderId, status, reason },
        "Failed to send WhatsApp sender alert email",
      );
    }
  }
}

export default EmailAlertService;
