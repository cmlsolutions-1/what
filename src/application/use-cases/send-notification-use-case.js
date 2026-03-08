const AppError = require("../../shared/errors/app-error");
const { normalizePhoneNumber } = require("../../shared/utils/phone-utils");

class SendNotificationUseCase {
  constructor(senderRepository, sessionManager) {
    this.senderRepository = senderRepository;
    this.sessionManager = sessionManager;
  }

  async execute({ fromPhoneNumber, toPhoneNumber, message }) {
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      throw new AppError("message is required", 400);
    }

    const senderNormalizedPhone = normalizePhoneNumber(fromPhoneNumber);
    const sender = await this.senderRepository.findByNormalizedPhoneNumber(senderNormalizedPhone);

    if (!sender) {
      throw new AppError("The sender phone number is not registered", 404);
    }

    const messageResult = await this.sessionManager.sendMessage({
      senderId: sender.id,
      recipientPhoneNumber: toPhoneNumber,
      message: message.trim(),
    });

    return {
      sender,
      ...messageResult,
    };
  }
}

module.exports = SendNotificationUseCase;

