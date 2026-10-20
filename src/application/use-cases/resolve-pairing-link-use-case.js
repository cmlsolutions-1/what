import AppError from "../../shared/errors/app-error.js";
import { hashPairingToken } from "../../shared/utils/pairing-token.js";

class ResolvePairingLinkUseCase {
  constructor(senderRepository, pairingLinkRepository) {
    this.senderRepository = senderRepository;
    this.pairingLinkRepository = pairingLinkRepository;
  }

  async execute(token) {
    if (!token || typeof token !== "string" || token.length < 32) {
      throw new AppError("Pairing link is invalid", 404, { code: "PAIRING_LINK_INVALID" });
    }

    const link = await this.pairingLinkRepository.findByTokenHash(hashPairingToken(token));
    if (!link) {
      throw new AppError("Pairing link is invalid", 404, { code: "PAIRING_LINK_INVALID" });
    }
    if (link.usedAt) {
      const completed = link.usedReason === "connected";
      throw new AppError(
        completed ? "WhatsApp line is already linked" : "Pairing link is no longer available",
        410,
        { code: completed ? "PAIRING_COMPLETED" : "PAIRING_LINK_USED" },
      );
    }
    if (new Date(link.expiresAt).getTime() <= Date.now()) {
      await this.pairingLinkRepository.consumeById(link.id, "expired");
      throw new AppError("Pairing link has expired", 410, { code: "PAIRING_LINK_EXPIRED" });
    }

    const sender = await this.senderRepository.findById(link.senderId);
    if (!sender) {
      await this.pairingLinkRepository.consumeById(link.id, "sender_missing");
      throw new AppError("Pairing link is invalid", 404, { code: "PAIRING_LINK_INVALID" });
    }

    return { link, sender };
  }
}

export default ResolvePairingLinkUseCase;
