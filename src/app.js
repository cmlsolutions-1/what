const fs = require("fs");
const path = require("path");
const express = require("express");

const env = require("./config/env");
const logger = require("./config/logger");

const pool = require("./infrastructure/database/postgres-pool");
const PostgresSenderRepository = require("./infrastructure/repositories/postgres-sender-repository");
const BaileysSessionManager = require("./infrastructure/whatsapp/baileys-session-manager");

const CreateSenderUseCase = require("./application/use-cases/create-sender-use-case");
const ListSendersUseCase = require("./application/use-cases/list-senders-use-case");
const ConnectSenderUseCase = require("./application/use-cases/connect-sender-use-case");
const GetSenderStatusUseCase = require("./application/use-cases/get-sender-status-use-case");
const SendNotificationUseCase = require("./application/use-cases/send-notification-use-case");

const SenderController = require("./infrastructure/http/controllers/sender-controller");
const NotificationController = require("./infrastructure/http/controllers/notification-controller");

const buildSenderRoutes = require("./infrastructure/http/routes/sender-routes");
const buildNotificationRoutes = require("./infrastructure/http/routes/notification-routes");

const notFoundHandler = require("./infrastructure/http/middlewares/not-found-handler");
const errorHandler = require("./infrastructure/http/middlewares/error-handler");

function createApp() {
  fs.mkdirSync(path.resolve(env.authBasePath), { recursive: true });

  const senderRepository = new PostgresSenderRepository(pool);
  const sessionManager = new BaileysSessionManager({
    authBasePath: env.authBasePath,
    logger,
  });

  const createSenderUseCase = new CreateSenderUseCase(senderRepository);
  const listSendersUseCase = new ListSendersUseCase(senderRepository);
  const connectSenderUseCase = new ConnectSenderUseCase(senderRepository, sessionManager);
  const getSenderStatusUseCase = new GetSenderStatusUseCase(senderRepository, sessionManager);
  const sendNotificationUseCase = new SendNotificationUseCase(senderRepository, sessionManager);

  const senderController = new SenderController({
    createSenderUseCase,
    listSendersUseCase,
    connectSenderUseCase,
    getSenderStatusUseCase,
  });

  const notificationController = new NotificationController({
    sendNotificationUseCase,
  });

  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/senders", buildSenderRoutes(senderController));
  app.use("/api/notifications", buildNotificationRoutes(notificationController));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;

