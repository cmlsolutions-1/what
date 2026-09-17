import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";

import AppError from "../src/shared/errors/app-error.js";
import errorHandler from "../src/infrastructure/http/middlewares/error-handler.js";

test("los errores de la API responden JSON con etapa y código", async () => {
  const app = express();
  app.get("/failure", (_req, _res, next) => {
    next(new AppError("WhatsApp could not send the message", 502, {
      code: "WHATSAPP_SEND_FAILED",
      stage: "send_message",
    }));
  });
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/failure`);
    assert.equal(response.status, 502);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.deepEqual(await response.json(), {
      message: "WhatsApp could not send the message",
      details: { code: "WHATSAPP_SEND_FAILED", stage: "send_message" },
    });
  } finally {
    server.close();
  }
});
