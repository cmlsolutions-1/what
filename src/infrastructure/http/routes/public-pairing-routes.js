import express from "express";

const { Router } = express;

function buildPublicPairingRoutes(pairingController) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    next();
  });
  router.get("/:token", pairingController.status);
  router.post("/:token/connect", pairingController.connect);
  return router;
}

export default buildPublicPairingRoutes;
