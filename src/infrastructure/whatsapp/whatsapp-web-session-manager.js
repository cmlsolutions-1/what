import fs from "fs";
import path from "path";

import pino from "pino";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";

const { Client, LocalAuth } = pkg;

import env from "../../config/env.js";
import AppError from "../../shared/errors/app-error.js";
import { normalizePhoneNumber } from "../../shared/utils/phone-utils.js";
import WhatsappSenderRepository from "../repositories/whatsapp-sender.repository.js";

function clearChromiumLocks(sessionPath) {
  const lockFiles = [
    "SingletonLock",
    "SingletonSocket",
    "SingletonCookie",
    "DevToolsActivePort",
    "LOCK",
  ];

  for (const file of lockFiles) {
    const fullPath = path.join(sessionPath, file);

    if (fs.existsSync(fullPath)) {
      try {
        fs.rmSync(fullPath, { force: true });
      } catch {}
    }
  }
}

class WhatsappWebSessionManager {
  constructor({ logger, senderRepository, alertService }) {
    this.logger =
      logger ||
      pino({
        level: "info",
      });

    this.senderRepository = senderRepository ?? new WhatsappSenderRepository();
    this.alertService = alertService;

    this.sessions = new Map();
    this.connectingPromises = new Map();
    this.reconnectAttempts = new Map();
    this.reconnectTimers = new Map();

    fs.mkdirSync(env.wwebjsAuthDir, { recursive: true });
  }

  normalizeSenderId(senderId) {
    const normalized = Number(senderId);

    if (Number.isNaN(normalized)) {
      throw new AppError("Invalid sender id", 400, { senderId });
    }

    return normalized;
  }

  normalizeSender(sender) {
    return {
      ...sender,
      id: this.normalizeSenderId(sender.id),
    };
  }

  async connect(sender) {
    const normalizedSender = this.normalizeSender(sender);
    const senderId = normalizedSender.id;

    if (this.connectingPromises.has(senderId)) {
      return this.connectingPromises.get(senderId);
    }

    const promise = this._connectInternal(normalizedSender).finally(() => {
      this.connectingPromises.delete(senderId);
    });

    this.connectingPromises.set(senderId, promise);
    return promise;
  }

  async _connectInternal(sender) {
    const senderId = this.normalizeSenderId(sender.id);
    const existingSession = this.sessions.get(senderId);

    if (
      existingSession &&
      ["initializing", "qr", "connected"].includes(existingSession.status)
    ) {
      return this.buildStatus(existingSession);
    }

    await this.replaceExistingSession(senderId);

    const authClientId = sender.authFolder || `sender_${senderId}`;

    const sessionPath = path.join(env.wwebjsAuthDir, `session-${authClientId}`);

    const client = this.createClient(authClientId);

    const session = {
      client,
      status: "initializing",
      qr: null,
      lastDisconnectReason: null,
      reconnectTimer: null,
      authClientId,
      senderSnapshot: sender,
      isClosing: false,
    };

    this.sessions.set(senderId, session);

    this.registerClientEvents({ sender, session });

    await this.updateConnectionStatusSafe({
      senderId,
      status: "initializing",
      lastDisconnectReason: null,
    });

    try {
      await client.initialize();

      client.pupPage?.on("console", (msg) => {
        console.log("[PAGE CONSOLE]", msg.type(), msg.text());
      });

      client.pupPage?.on("pageerror", (err) => {
        console.log("[PAGE ERROR]", err.message);
      });

      client.pupPage?.on("error", (err) => {
        console.log("[PAGE CRASH]", err.message);
      });

      client.pupBrowser?.on("disconnected", () => {
        console.log("[BROWSER DISCONNECTED]");
      });
    } catch (error) {
      this.logger.error(
        { error, senderId, stack: error?.stack },
        "Failed to initialize whatsapp-web.js client",
      );

      const msg = String(error?.message || "").toLowerCase();

      const looksLikeLockError =
        msg.includes("profile") ||
        msg.includes("singleton") ||
        msg.includes("in use") ||
        msg.includes("devtoolsactiveport");

      if (looksLikeLockError) {
        try {
          await this.safeDestroyClient(session.client);
          await this.sleep(1000);

          clearChromiumLocks(sessionPath);
          await this.sleep(1500);

          const retryClient = this.createClient(authClientId);
          session.client = retryClient;
          session.status = "initializing";
          session.qr = null;
          session.lastDisconnectReason = null;

          this.registerClientEvents({ sender, session });

          await retryClient.initialize();

          retryClient.pupPage?.on("console", (msg) => {
            console.log("[PAGE CONSOLE]", msg.type(), msg.text());
          });

          retryClient.pupPage?.on("pageerror", (err) => {
            console.log("[PAGE ERROR]", err.message);
          });

          retryClient.pupPage?.on("error", (err) => {
            console.log("[PAGE CRASH]", err.message);
          });

          retryClient.pupBrowser?.on("disconnected", () => {
            console.log("[BROWSER DISCONNECTED]");
          });

          return this.buildStatus(session);
        } catch (retryError) {
          this.logger.error(
            { error: retryError, senderId, stack: retryError?.stack },
            "Failed to initialize whatsapp-web.js client after lock cleanup",
          );

          session.status = "disconnected";
          session.lastDisconnectReason = "initialize_failed";

          await this.updateConnectionStatusSafe({
            senderId,
            status: "disconnected",
            lastDisconnectReason: "initialize_failed",
          });

          await this.sendAlertSafe({
            sender,
            status: "disconnected",
            reason: "initialize_failed",
            message:
              "No fue posible inicializar la sesión de WhatsApp después de limpiar bloqueos de Chromium.",
          });

          this.sessions.delete(senderId);
          throw retryError;
        }
      }

      session.status = "disconnected";
      session.lastDisconnectReason = "initialize_failed";

      await this.updateConnectionStatusSafe({
        senderId,
        status: "disconnected",
        lastDisconnectReason: "initialize_failed",
      });

      await this.sendAlertSafe({
        sender,
        status: "disconnected",
        reason: "initialize_failed",
        message: "No fue posible inicializar la sesión de WhatsApp.",
      });

      this.sessions.delete(senderId);
      throw error;
    }

    return this.buildStatus(session);
  }

  createClient(authClientId) {
    const puppeteerConfig = {
      headless: env.wwebjsHeadless === true || env.wwebjsHeadless === "true",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
        "--disable-features=site-per-process",
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    };

    if (env.wwebjsExecutablePath) {
      puppeteerConfig.executablePath = env.wwebjsExecutablePath;
    }

    return new Client({
      authStrategy: new LocalAuth({
        clientId: authClientId,
        dataPath: env.wwebjsAuthDir,
      }),
      puppeteer: puppeteerConfig,
      takeoverOnConflict: true,
      takeoverTimeoutMs: 0,
    });
  }

  registerClientEvents({ sender, session }) {
    const senderId = this.normalizeSenderId(sender.id);

    session.client.on("qr", async (qrValue) => {
      if (session.isClosing) return;

      session.status = "qr";
      session.qr = qrValue;
      session.lastDisconnectReason = null;

      if (env.printQrInTerminal) {
        qrcode.generate(qrValue, { small: true });
      }

      await this.updateConnectionStatusSafe({
        senderId,
        status: "qr",
        lastDisconnectReason: null,
      });

      await this.sendAlertSafe({
        sender,
        status: "qr",
        reason: "qr_required",
        message: "La línea requiere escanear un nuevo código QR para quedar operativa.",
      });

      this.logger.info({ senderId }, "QR generated for sender");
    });

    session.client.on("ready", async () => {
      if (session.isClosing) return;

      console.log("Readyy");

      if (session.reconnectTimer) {
        clearTimeout(session.reconnectTimer);
        session.reconnectTimer = null;
      }

      this.clearReconnectTimer(senderId);
      this.reconnectAttempts.delete(senderId);

      session.status = "connected";
      session.qr = null;
      session.lastDisconnectReason = null;

      console.log("Llegue por aqui");
      console.log(session);

      await this.updateConnectionStatusSafe({
        senderId,
        status: "connected",
        lastDisconnectReason: null,
      });

      this.logger.info({ senderId }, "Sender is connected to WhatsApp Web");
    });

    session.client.on("auth_failure", async () => {
      if (session.isClosing) return;
      session.isClosing = true;

      console.log("auth_failure");

      session.status = "needs_reauth";
      session.qr = null;
      session.lastDisconnectReason = "auth_failure";

      await this.updateConnectionStatusSafe({
        senderId,
        status: "needs_reauth",
        lastDisconnectReason: "auth_failure",
      });

      await this.sendAlertSafe({
        sender,
        status: "needs_reauth",
        reason: "auth_failure",
        message:
          "WhatsApp rechazó la autenticación guardada. Es necesario reconectar la línea y escanear QR.",
      });

      await this.clearAuthStateSafe(session.authClientId);
      await this.safeDestroyClient(session.client);
      this.sessions.delete(senderId);

      this.logger.warn({ senderId }, "Auth failure. Re-authentication required");
    });

    session.client.on("disconnected", async (reason) => {
      if (session.isClosing) return;

      const reasonCode = this.mapDisconnectReason(reason);

      session.qr = null;
      session.lastDisconnectReason = reasonCode;

      this.logger.warn(
        {
          senderId,
          reason,
          mappedReason: reasonCode,
        },
        "Sender disconnected from WhatsApp Web",
      );

      if (this.shouldForceReauth(reasonCode)) {
        session.isClosing = true;

        const nextStatus =
          reasonCode === "logged_out" ? "logged_out" : "needs_reauth";

        if (session.reconnectTimer) {
          clearTimeout(session.reconnectTimer);
          session.reconnectTimer = null;
        }

        this.clearReconnectTimer(senderId);
        session.status = nextStatus;

        await this.updateConnectionStatusSafe({
          senderId,
          status: nextStatus,
          lastDisconnectReason: reasonCode,
        });

        await this.sendAlertSafe({
          sender,
          status: nextStatus,
          reason: reasonCode,
          message:
            "WhatsApp cerró o invalidó esta sesión. Es necesario revisar la línea en el panel administrativo.",
        });

        await this.clearAuthStateSafe(session.authClientId);
        await this.safeDestroyClient(session.client);
        this.sessions.delete(senderId);
        return;
      }

      session.status = "reconnecting";

      await this.updateConnectionStatusSafe({
        senderId,
        status: "reconnecting",
        lastDisconnectReason: reasonCode,
      });

      await this.sendAlertSafe({
        sender,
        status: "reconnecting",
        reason: reasonCode,
        message:
          "La línea se desconectó. El backend intentará reconectarla automáticamente.",
      });

      this.scheduleReconnect({ sender, session });
    });

    session.client.on("authenticated", () => {
      console.log("AUTHENTICATED");
    });

    session.client.on("loading_screen", (percent, message) => {
      console.log("LOADING:", percent, message);
    });

    session.client.on("change_state", (state) => {
      console.log("STATE:", state);
    });
  }

  async sendMessage({ senderId, recipientPhoneNumber, message }) {
    const normalizedSenderId = this.normalizeSenderId(senderId);
    const session = this.sessions.get(normalizedSenderId);

    if (!session || session.status !== "connected") {
      throw new AppError(
        "Sender is not connected. Connect the sender first and scan the QR code",
        400,
      );
    }

    const recipientNormalizedPhone =
      normalizePhoneNumber(recipientPhoneNumber);
    const numberId = await session.client.getNumberId(recipientNormalizedPhone);

    if (!numberId?._serialized) {
      throw new AppError(
        "Recipient phone number is not registered on WhatsApp",
        400,
      );
    }

    const chatId = numberId._serialized;
    await this.openChatBeforeSend(session.client, chatId);

    const response = await session.client.sendMessage(chatId, message);

    return {
      recipientPhoneNumber: recipientNormalizedPhone,
      messageId: response?.id?._serialized ?? response?.id?.id ?? null,
      sentAt: new Date().toISOString(),
    };
  }

  async openChatBeforeSend(client, chatId) {
    try {
      if (client.interface?.openChatWindow) {
        await client.interface.openChatWindow(chatId);
        await this.sleep(300);
        return;
      }

      const opened = await client.pupPage?.evaluate(async (targetChatId) => {
        const store = window.Store;
        if (
          !store?.Cmd?.openChatAt ||
          !store?.Chat?.find ||
          !store?.WidFactory?.createWid
        ) {
          return false;
        }

        const wid = store.WidFactory.createWid(targetChatId);
        const chat = await store.Chat.find(wid);

        if (!chat) {
          return false;
        }

        await store.Cmd.openChatAt(chat);
        return true;
      }, chatId);

      if (!opened) {
        throw new Error("open chat action was not available");
      }

      await this.sleep(300);
    } catch (error) {
      throw new AppError("Could not open chat before sending message", 500, {
        chatId,
        reason: error.message,
      });
    }
  }

  async updateConnectionStatusSafe({ senderId, status, lastDisconnectReason }) {
    try {
      await this.senderRepository.updateConnectionStatus({
        senderId,
        status,
        lastDisconnectReason,
      });
    } catch (error) {
      this.logger.error(
        { error, senderId, status },
        "Failed to persist connection status",
      );
    }
  }

  scheduleReconnect({ sender, session }) {
    const senderId = this.normalizeSenderId(sender.id);
    const currentAttempts = this.reconnectAttempts.get(senderId) ?? 0;
    const nextAttempt = currentAttempts + 1;
    const delay = Math.min(
      env.reconnectBaseDelayMs * 2 ** currentAttempts,
      env.reconnectMaxDelayMs,
    );

    this.reconnectAttempts.set(senderId, nextAttempt);

    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
    }

    this.clearReconnectTimer(senderId);

    this.logger.info(
      { senderId, attempt: nextAttempt, delay },
      "Scheduling WhatsApp sender reconnect",
    );

    session.reconnectTimer = setTimeout(() => {
      this.reconnectTimers.delete(senderId);
      this.connect(sender).catch(async (error) => {
        this.logger.error(
          { error, senderId, attempt: nextAttempt },
          "Reconnect failed",
        );

        await this.updateConnectionStatusSafe({
          senderId,
          status: "reconnecting",
          lastDisconnectReason: "reconnect_failed",
        });

        await this.sendAlertSafe({
          sender,
          status: "reconnecting",
          reason: "reconnect_failed",
          message:
            "Falló un intento automático de reconexión. El backend seguirá intentando con mayor intervalo.",
        });

        const latestSession =
          this.sessions.get(senderId) ?? {
            isClosing: false,
            reconnectTimer: null,
          };

        if (!latestSession.isClosing) {
          this.scheduleReconnect({ sender, session: latestSession });
        }
      });
    }, delay);

    this.reconnectTimers.set(senderId, session.reconnectTimer);
  }

  clearReconnectTimer(senderId) {
    const normalizedSenderId = this.normalizeSenderId(senderId);
    const timer = this.reconnectTimers.get(normalizedSenderId);

    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(normalizedSenderId);
    }
  }

  async sendAlertSafe({ sender, status, reason, message }) {
    try {
      await this.alertService?.sendSenderAlert({
        sender,
        status,
        reason,
        message,
      });
    } catch (error) {
      this.logger.error(
        { error, senderId: sender?.id, status, reason },
        "Failed while sending sender alert",
      );
    }
  }

  shouldForceReauth(reasonCode) {
    return reasonCode === "logged_out" || reasonCode === "auth_failure";
  }

  mapDisconnectReason(reason) {
    const normalized = String(reason ?? "unknown").toLowerCase();

    if (normalized.includes("logout")) {
      return "logged_out";
    }

    if (normalized.includes("auth")) {
      return "auth_failure";
    }

    if (normalized.includes("conflict")) {
      return "session_conflict";
    }

    if (normalized.includes("navigation")) {
      return "navigation";
    }

    return normalized.replace(/\s+/g, "_");
  }

  async clearAuthStateSafe(authClientId) {
    const folderName = `session-${authClientId}`;
    const folderPath = path.join(env.wwebjsAuthDir, folderName);

    try {
      if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
      }
    } catch (error) {
      this.logger.error(
        { error, authClientId },
        "Failed to clear whatsapp-web.js auth state",
      );
    }
  }

  async safeDestroyClient(client) {
    try {
      await client.destroy();
    } catch (_error) {
      // ignore cleanup error
    }
  }

  async replaceExistingSession(senderId) {
    const normalizedSenderId = this.normalizeSenderId(senderId);
    const existingSession = this.sessions.get(normalizedSenderId);

    if (!existingSession) return;

    try {
      existingSession.isClosing = true;

      if (existingSession.reconnectTimer) {
        clearTimeout(existingSession.reconnectTimer);
        existingSession.reconnectTimer = null;
      }

      this.clearReconnectTimer(normalizedSenderId);
      await this.safeDestroyClient(existingSession.client);
      await this.sleep(1000);
    } catch (error) {
      this.logger.warn(
        { error, senderId: normalizedSenderId },
        "Failed while closing previous session",
      );
    } finally {
      this.sessions.delete(normalizedSenderId);
    }
  }

  getStatus(senderId) {
    const normalizedSenderId = this.normalizeSenderId(senderId);
    const session = this.sessions.get(normalizedSenderId);

    if (!session) {
      return {
        status: "disconnected",
        qr: null,
        lastDisconnectReason: null,
      };
    }

    return this.buildStatus(session);
  }

  async restore(senders) {
    for (const sender of senders) {
      try {
        await this.connect(sender);
      } catch (error) {
        this.logger.error(
          { error, senderId: sender.id },
          "Failed to restore sender session",
        );
      }
    }
  }

  async disconnect(senderId) {
    const normalizedSenderId = this.normalizeSenderId(senderId);
    const session = this.sessions.get(normalizedSenderId);

    if (session) {
      session.isClosing = true;

      if (session.reconnectTimer) {
        clearTimeout(session.reconnectTimer);
        session.reconnectTimer = null;
      }

      this.clearReconnectTimer(normalizedSenderId);
      await this.safeDestroyClient(session.client);
      this.sessions.delete(normalizedSenderId);
    }

    await this.updateConnectionStatusSafe({
      senderId: normalizedSenderId,
      status: "disconnected",
      lastDisconnectReason: null,
    });

    return {
      status: "disconnected",
      qr: null,
      lastDisconnectReason: null,
    };
  }

  buildStatus(session) {
    return {
      status: session.status,
      qr: session.qr,
      lastDisconnectReason: session.lastDisconnectReason,
    };
  }

  sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

export default WhatsappWebSessionManager;
