import AppError from "../errors/app-error.js";

function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== "string") {
    throw new AppError("phoneNumber is required", 400);
  }

  let normalized = phoneNumber.replace(/\D/g, "");

  if (normalized.startsWith("00")) {
    normalized = normalized.slice(2);
  }

  if (normalized.length < 8 || normalized.length > 15) {
    throw new AppError("phoneNumber is invalid. Use international format", 400);
  }

  return normalized;
}

function toWhatsappJid(normalizedPhoneNumber) {
  return `${normalizedPhoneNumber}@s.whatsapp.net`;
}

export { normalizePhoneNumber, toWhatsappJid };
