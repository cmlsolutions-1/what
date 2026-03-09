import AppError from "../../shared/errors/app-error.js";
import { normalizePhoneNumber } from "../../shared/utils/phone-utils.js";

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
    console.log(senderNormalizedPhone);
    const sender = await this.senderRepository.findByNormalizedPhoneNumber(senderNormalizedPhone);

    console.log(sender);

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

export default SendNotificationUseCase;
