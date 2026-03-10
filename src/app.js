import express from "express";

import logger from "./config/logger.js";

import pool from "./infrastructure/database/postgres-pool.js";
import PostgresSenderRepository from "./infrastructure/repositories/postgres-sender-repository.js";
import WhatsappWebSessionManager from "./infrastructure/whatsapp/whatsapp-web-session-manager.js";

import CreateSenderUseCase from "./application/use-cases/create-sender-use-case.js";
import DisconnectSenderUseCase from "./application/use-cases/close-sender-use-case.js";
import ListSendersUseCase from "./application/use-cases/list-senders-use-case.js";
import ConnectSenderUseCase from "./application/use-cases/connect-sender-use-case.js";
import GetSenderStatusUseCase from "./application/use-cases/get-sender-status-use-case.js";
import SendNotificationUseCase from "./application/use-cases/send-notification-use-case.js";

import SenderController from "./infrastructure/http/controllers/sender-controller.js";
import NotificationController from "./infrastructure/http/controllers/notification-controller.js";

import buildSenderRoutes from "./infrastructure/http/routes/sender-routes.js";
import buildNotificationRoutes from "./infrastructure/http/routes/notification-routes.js";

import notFoundHandler from "./infrastructure/http/middlewares/not-found-handler.js";
import errorHandler from "./infrastructure/http/middlewares/error-handler.js";
import rateLimit from "express-rate-limit";

function createApp() {



  const senderRepository = new PostgresSenderRepository(pool);
  const sessionManager = new WhatsappWebSessionManager({ logger });

  const createSenderUseCase = new CreateSenderUseCase(senderRepository);
  const listSendersUseCase = new ListSendersUseCase(senderRepository);
  const connectSenderUseCase = new ConnectSenderUseCase(senderRepository, sessionManager);
  const getSenderStatusUseCase = new GetSenderStatusUseCase(senderRepository, sessionManager);
  const sendNotificationUseCase = new SendNotificationUseCase(senderRepository, sessionManager);
  const disconnectSenderUseCase = new DisconnectSenderUseCase(senderRepository, sessionManager)

  const senderController = new SenderController({
    createSenderUseCase,
    listSendersUseCase,
    connectSenderUseCase,
    getSenderStatusUseCase,
    disconnectSenderUseCase
  });

  const notificationController = new NotificationController({
    sendNotificationUseCase,
  });

  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.set("trust proxy", 1);

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60
  });

  app.use(limiter);

  app.use("/api/senders", apiKeyMiddleware, buildSenderRoutes(senderController));
  app.use("/api/notifications", apiKeyMiddleware, buildNotificationRoutes(notificationController));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

function apiKeyMiddleware(req, res, next) {
  const apiKey = req.headers["x-api-key"];

  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
}

export default createApp;
