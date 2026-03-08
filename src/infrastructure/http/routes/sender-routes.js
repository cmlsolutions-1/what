const { Router } = require("express");

function buildSenderRoutes(senderController) {
  const router = Router();

  router.post("/", senderController.create);
  router.get("/", senderController.list);
  router.post("/:senderId/connect", senderController.connect);
  router.get("/:senderId/status", senderController.status);

  return router;
}

module.exports = buildSenderRoutes;

