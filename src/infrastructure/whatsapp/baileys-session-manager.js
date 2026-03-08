const pino = require("pino");
const qrcode = require("qrcode-terminal");
const {
  default: makeWASocket,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

const AppError = require("../../shared/errors/app-error");
const {
  normalizePhoneNumber,
  toWhatsappJid,
} = require("../../shared/utils/phone-utils");

const createPostgresAuthState = require("./baileys-auth-state");
const WhatsappAuthRepository = require("../repositories/whatsapp-auth.repository");
const WhatsappSenderRepository = require("../repositories/whatsapp-sender.repository");

class BaileysSessionManager {
  constructor({ logger }) {
    this.logger = logger;
    this.sessions = new Map();
    this.connectingPromises = new Map();
    this.baileysLogger = pino({ level: "silent" });

    this.authRepository = new WhatsappAuthRepository();
    this.senderRepository = new WhatsappSenderRepository();
  }

  async connect(sender) {
    if (this.connectingPromises.has(sender.id)) {
      return this.connectingPromises.get(sender.id);
    }

    const promise = this._connectInternal(sender)
      .finally(() => {
        this.connectingPromises.delete(sender.id);
      });

    this.connectingPromises.set(sender.id, promise);
    return promise;
  }

  async _connectInternal(sender) {
    const existingSession = this.sessions.get(sender.id);

    if (existingSession && ["connecting", "qr", "connected", "reconnecting"].includes(existingSession.status)) {
      return this.buildStatus(existingSession);
    }

    await this.replaceExistingSession(sender.id);

    const { state, saveCreds } = await createPostgresAuthState({
      senderId: sender.id,
      authRepository: this.authRepository,
      logger: this.baileysLogger,
    });

    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: this.baileysLogger,
      browser: ["Notifier API", "Desktop", "1.0.0"],
    });

    const session = {
      socket,
      status: "connecting",
      qr: null,
      lastDisconnectReason: null,
      reconnectTimer: null,
      senderSnapshot: sender,
    };

    this.sessions.set(sender.id, session);

    await this.senderRepository.updateConnectionStatus({
      senderId: sender.id,
      status: "connecting",
      lastDisconnectReason: null,
    });

    socket.ev.on("creds.update", async () => {
      try {
        await saveCreds();
      } catch (error) {
        this.logger.error(
          { error, senderId: sender.id },
          "Failed to persist Baileys creds",
        );
      }
    });

    socket.ev.on("connection.update", async (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        session.status = "qr";
        session.qr = qr;

        if (process.env.PRINT_QR_IN_TERMINAL !== "false") {
          qrcode.generate(qr, { small: true });
        }

        await this.senderRepository.updateConnectionStatus({
          senderId: sender.id,
          status: "qr",
          lastDisconnectReason: null,
        });

        this.logger.info({ senderId: sender.id }, "QR generated for sender");
      }

      if (connection === "open") {
        if (session.reconnectTimer) {
          clearTimeout(session.reconnectTimer);
          session.reconnectTimer = null;
        }

        session.status = "connected";
        session.qr = null;
        session.lastDisconnectReason = null;

        await this.senderRepository.updateConnectionStatus({
          senderId: sender.id,
          status: "connected",
          lastDisconnectReason: null,
        });

        this.logger.info(
          { senderId: sender.id },
          "Sender is connected to WhatsApp",
        );
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        session.qr = null;
        session.lastDisconnectReason = this.mapDisconnectReason(statusCode);

        this.logger.warn(
          {
            senderId: sender.id,
            statusCode,
            reason: session.lastDisconnectReason,
          },
          "Sender disconnected from WhatsApp",
        );

        if (isLoggedOut) {
          session.status = "logged_out";

          await this.senderRepository.updateConnectionStatus({
            senderId: sender.id,
            status: "logged_out",
            lastDisconnectReason: session.lastDisconnectReason,
          });

          this.sessions.delete(sender.id);
          return;
        }

        session.status = "reconnecting";

        await this.senderRepository.updateConnectionStatus({
          senderId: sender.id,
          status: "reconnecting",
          lastDisconnectReason: session.lastDisconnectReason,
        });

        if (session.reconnectTimer) {
          clearTimeout(session.reconnectTimer);
        }

        session.reconnectTimer = setTimeout(() => {
          this.connect(sender).catch((error) => {
            this.logger.error(
              { error, senderId: sender.id },
              "Reconnect failed",
            );
          });
        }, 3000);
      }
    });

    return this.buildStatus(session);
  }

  async replaceExistingSession(senderId) {
    const existingSession = this.sessions.get(senderId);

    if (!existingSession) return;

    try {
      if (existingSession.reconnectTimer) {
        clearTimeout(existingSession.reconnectTimer);
      }

      if (existingSession.socket?.end) {
        existingSession.socket.end(new Error("Replacing old session"));
      }
    } catch (error) {
      this.logger.warn(
        { error, senderId },
        "Failed while closing previous session",
      );
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
        this.logger.error(
          { error, senderId: sender.id },
          "Failed to restore sender session",
        );
      }
    }
  }

  async disconnect(senderId) {
    await this.replaceExistingSession(senderId);

    await this.senderRepository.updateConnectionStatus({
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

  async sendMessage({ senderId, recipientPhoneNumber, message }) {
    const session = this.sessions.get(senderId);

    if (!session || session.status !== "connected") {
      throw new AppError(
        "Sender is not connected. Connect the sender first and scan the QR code",
        400,
      );
    }

    const recipientNormalizedPhone = normalizePhoneNumber(recipientPhoneNumber);
    const jid = toWhatsappJid(recipientNormalizedPhone);
    const response = await session.socket.sendMessage(jid, { text: message });

    return {
      recipientPhoneNumber: recipientNormalizedPhone,
      messageId: response?.key?.id ?? null,
      sentAt: new Date().toISOString(),
    };
  }

  buildStatus(session) {
    return {
      status: session.status,
      qr: session.qr,
      lastDisconnectReason: session.lastDisconnectReason,
    };
  }

  mapDisconnectReason(statusCode) {
    switch (statusCode) {
      case DisconnectReason.loggedOut:
        return "logged_out";
      case DisconnectReason.connectionClosed:
        return "connection_closed";
      case DisconnectReason.connectionLost:
        return "connection_lost";
      case DisconnectReason.connectionReplaced:
        return "connection_replaced";
      case DisconnectReason.restartRequired:
        return "restart_required";
      case DisconnectReason.timedOut:
        return "timed_out";
      case DisconnectReason.badSession:
        return "bad_session";
      case DisconnectReason.multideviceMismatch:
        return "multidevice_mismatch";
      case DisconnectReason.forbidden:
        return "forbidden";
      case DisconnectReason.unavailableService:
        return "unavailable_service";
      default:
        return "unknown";
    }
  }
}

module.exports = BaileysSessionManager;