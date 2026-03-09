import express from "express";

const { Router } = express;

function buildNotificationRoutes(notificationController) {
  const router = Router();

  router.post("/send", notificationController.send);

  return router;
}

export default buildNotificationRoutes;
