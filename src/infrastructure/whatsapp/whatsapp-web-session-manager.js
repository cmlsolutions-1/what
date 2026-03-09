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
    "SingletonCookie"
  ];

  for (const file of lockFiles) {
    const fullPath = path.join(sessionPath, file);

    if (fs.existsSync(fullPath)) {
      try {
        fs.rmSync(fullPath, { force: true });
      } catch (err) {
        console.warn("Failed removing chromium lock:", fullPath);
      }
    }
  }
}

class WhatsappWebSessionManager {
  constructor({ logger, senderRepository }) {
    this.logger =
      logger ||
      pino({
        level: "info",
      });

    this.senderRepository = senderRepository ?? new WhatsappSenderRepository();

    this.sessions = new Map();
    this.connectingPromises = new Map();

    fs.mkdirSync(env.wwebjsAuthDir, { recursive: true });
  }

  

  async connect(sender) {

    if (this.connectingPromises.has(sender.id)) {
      return this.connectingPromises.get(sender.id);
    }

    const promise = this._connectInternal(sender).finally(() => {
      this.connectingPromises.delete(sender.id);
    });

    this.connectingPromises.set(sender.id, promise);
    return promise;
  }

  async _connectInternal(sender) {
    const existingSession = this.sessions.get(sender.id);

    if (existingSession && ["initializing", "qr", "connected"].includes(existingSession.status)) {
      return this.buildStatus(existingSession);
    }

    await this.replaceExistingSession(sender.id);

    const authClientId = sender.authFolder || `sender_${sender.id}`;

    clearChromiumLocks(sessionPath);

    const client = this.createClient(authClientId);

    const session = {
      client,
      status: "initializing",
      qr: null,
      lastDisconnectReason: null,
      reconnectTimer: null,
      authClientId,
      senderSnapshot: sender,
    };

    this.sessions.set(sender.id, session);

    this.registerClientEvents({ sender, session });

    await this.updateConnectionStatusSafe({
      senderId: sender.id,
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
      this.logger.error({ error, senderId: sender.id, stack: error.stack }, "Failed to initialize whatsapp-web.js client");
      session.status = "disconnected";
      session.lastDisconnectReason = "initialize_failed";

      await this.updateConnectionStatusSafe({
        senderId: sender.id,
        status: "disconnected",
        lastDisconnectReason: "initialize_failed",
      });

      throw error;
    }

    return this.buildStatus(session);
  }

  createClient(authClientId) {
    const puppeteerConfig = {
      headless: env.wwebjsHeadless === true || env.wwebjsHeadless === "true",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
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
      takeoverTimeoutMs: 0
    });
  }

  registerClientEvents({ sender, session }) {
    session.client.on("qr", async (qrValue) => {
      session.status = "qr";
      session.qr = qrValue;
      session.lastDisconnectReason = null;

      if (env.printQrInTerminal) {
        qrcode.generate(qrValue, { small: true });
      }

      await this.updateConnectionStatusSafe({
        senderId: sender.id,
        status: "qr",
        lastDisconnectReason: null,
      });

      this.logger.info({ senderId: sender.id }, "QR generated for sender");
    });

    session.client.on("ready", async () => {

      console.log("Readyy");
      if (session.reconnectTimer) {
        clearTimeout(session.reconnectTimer);
        session.reconnectTimer = null;
      }

      session.status = "connected";
      session.qr = null;
      session.lastDisconnectReason = null;

      console.log("Llegue por aqui");
      console.log(session);
      await this.updateConnectionStatusSafe({
        senderId: sender.id,
        status: "connected",
        lastDisconnectReason: null,
      });

      this.logger.info({ senderId: sender.id }, "Sender is connected to WhatsApp Web");
    });

    session.client.on("auth_failure", async () => {
      console.log("auth_failure");
      session.status = "needs_reauth";
      session.qr = null;
      session.lastDisconnectReason = "auth_failure";

      await this.updateConnectionStatusSafe({
        senderId: sender.id,
        status: "needs_reauth",
        lastDisconnectReason: "auth_failure",
      });

      await this.clearAuthStateSafe(session.authClientId);
      await this.safeDestroyClient(session.client);
      this.sessions.delete(sender.id);

      this.logger.warn({ senderId: sender.id }, "Auth failure. Re-authentication required");
    });

    session.client.on("disconnected", async (reason) => {
      const reasonCode = this.mapDisconnectReason(reason);

      session.qr = null;
      session.lastDisconnectReason = reasonCode;

      this.logger.warn(
        {
          senderId: sender.id,
          reason,
          mappedReason: reasonCode,
        },
        "Sender disconnected from WhatsApp Web",
      );

      if (this.shouldForceReauth(reasonCode)) {
        const nextStatus = reasonCode === "logged_out" ? "logged_out" : "needs_reauth";

        if (session.reconnectTimer) {
          clearTimeout(session.reconnectTimer);
          session.reconnectTimer = null;
        }

        session.status = nextStatus;

        await this.updateConnectionStatusSafe({
          senderId: sender.id,
          status: nextStatus,
          lastDisconnectReason: reasonCode,
        });

        await this.clearAuthStateSafe(session.authClientId);
        await this.safeDestroyClient(session.client);
        this.sessions.delete(sender.id);
        return;
      }

      session.status = "reconnecting";

      await this.updateConnectionStatusSafe({
        senderId: sender.id,
        status: "reconnecting",
        lastDisconnectReason: reasonCode,
      });

      if (session.reconnectTimer) {
        clearTimeout(session.reconnectTimer);
      }

      session.reconnectTimer = setTimeout(() => {
        this.connect(sender).catch((error) => {
          this.logger.error({ error, senderId: sender.id }, "Reconnect failed");
        });
      }, 3000);
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
    const session = this.sessions.get(senderId);

    console.log(session);

    // if (!session || session.status !== "connected") {
    //   throw new AppError("Sender is not connected. Connect the sender first and scan the QR code", 400);
    // }

    const recipientNormalizedPhone = normalizePhoneNumber(recipientPhoneNumber);
    const numberId = await session.client.getNumberId(recipientNormalizedPhone);

    if (!numberId?._serialized) {
      throw new AppError("Recipient phone number is not registered on WhatsApp", 400);
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
        if (!store?.Cmd?.openChatAt || !store?.Chat?.find || !store?.WidFactory?.createWid) {
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
      throw new AppError(
        "Could not open chat before sending message",
        500,
        { chatId, reason: error.message },
      );
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
      this.logger.error({ error, senderId, status }, "Failed to persist connection status");
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
      this.logger.error({ error, authClientId }, "Failed to clear whatsapp-web.js auth state");
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
    const existingSession = this.sessions.get(senderId);

    if (!existingSession) return;

    try {
      if (existingSession.reconnectTimer) {
        clearTimeout(existingSession.reconnectTimer);
      }

      await this.safeDestroyClient(existingSession.client);
    } catch (error) {
      this.logger.warn({ error, senderId }, "Failed while closing previous session");
    } finally {
      this.sessions.delete(senderId);
    }
  }

  getStatus(senderId) {
    const session = this.sessions.get(senderId);

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
        this.logger.error({ error, senderId: sender.id }, "Failed to restore sender session");
      }
    }
  }

  async disconnect(senderId) {
    const session = this.sessions.get(senderId);

    if (session) {
      if (session.reconnectTimer) {
        clearTimeout(session.reconnectTimer);
      }

      await this.safeDestroyClient(session.client);
      this.sessions.delete(senderId);
    }

    await this.updateConnectionStatusSafe({
      senderId,
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
