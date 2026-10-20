import express from "express";

const { Router } = express;

function buildSenderRoutes(senderController, pairingController) {
  const router = Router();

  router.post("/", senderController.create);
  router.get("/", senderController.list);
  router.post("/:senderId/connect", senderController.connect);
  router.post("/:senderId/pairing-link", pairingController.createLink);
  router.get("/:senderId/status", senderController.status);
  router.get("/:senderId/disconnect", senderController.disconnect)
  router.post("/:senderId/reset-auth", senderController.resetAuth);
  router.delete("/:senderId", senderController.remove);

  return router;
}

export default buildSenderRoutes;
