import AppError from "../../shared/errors/app-error.js";

class DisconnectSenderUseCase {
  constructor(senderRepository, sessionManager) {
    this.senderRepository = senderRepository;
    this.sessionManager = sessionManager;
  }

  async execute(senderId) {
    const sender = await this.senderRepository.findById(senderId);

    if (!sender) {
      throw new AppError("Sender was not found", 404);
    }

    const result = await this.sessionManager.disconnect(senderId);

    return {
      sender,
      session: result,
    };
  }
}

export default DisconnectSenderUseCase;