import express from "express";

const { Router } = express;

function buildSenderRoutes(senderController) {
  const router = Router();

  router.post("/", senderController.create);
  router.get("/", senderController.list);
  router.post("/:senderId/connect", senderController.connect);
  router.get("/:senderId/status", senderController.status);
  router.get("/:senderId/disconnect", senderController.disconnect)
  router.post("/:senderId/reset-auth", senderController.resetAuth);
  router.delete("/:senderId", senderController.remove);

  return router;
}

export default buildSenderRoutes;
