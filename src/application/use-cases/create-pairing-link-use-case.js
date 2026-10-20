import AppError from "../../shared/errors/app-error.js";
import { createPairingToken, hashPairingToken } from "../../shared/utils/pairing-token.js";

class CreatePairingLinkUseCase {
  constructor(senderRepository, pairingLinkRepository, sessionManager, config) {
    this.senderRepository = senderRepository;
    this.pairingLinkRepository = pairingLinkRepository;
    this.sessionManager = sessionManager;
    this.config = config;
  }

  async execute(senderId) {
    const sender = await this.senderRepository.findById(senderId);
    if (!sender) throw new AppError("Sender was not found", 404);
    if (
      sender.status === "connected" ||
      this.sessionManager.getStatus(sender.id).status === "connected"
    ) {
      throw new AppError("Sender is already connected", 409, {
        code: "SENDER_ALREADY_CONNECTED",
      });
    }

    const token = createPairingToken();
    const expiresAt = new Date(
      Date.now() + this.config.pairingLinkTtlMinutes * 60 * 1000,
    );
    await this.pairingLinkRepository.create({
      senderId: sender.id,
      tokenHash: hashPairingToken(token),
      expiresAt,
    });

    const baseUrl = this.config.pairingFrontendBaseUrl.replace(/\/+$/, "");
    return {
      url: `${baseUrl}/${encodeURIComponent(token)}`,
      expiresAt: expiresAt.toISOString(),
      sender: {
        id: sender.id,
        displayName: sender.displayName,
        phoneNumber: sender.phoneNumber,
      },
    };
  }
}

export default CreatePairingLinkUseCase;
