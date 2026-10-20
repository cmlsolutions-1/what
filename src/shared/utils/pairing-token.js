import { createHash, randomBytes } from "node:crypto";

export function createPairingToken() {
  return randomBytes(32).toString("base64url");
}

export function hashPairingToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}
