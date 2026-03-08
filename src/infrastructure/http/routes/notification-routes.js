const { Router } = require("express");

function buildNotificationRoutes(notificationController) {
  const router = Router();

  router.post("/send", notificationController.send);

  return router;
}

module.exports = buildNotificationRoutes;

