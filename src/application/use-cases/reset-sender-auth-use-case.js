import AppError from "../../shared/errors/app-error.js";

class ResetSenderAuthUseCase {
  constructor(senderRepository, sessionManager) {
    this.senderRepository = senderRepository;
    this.sessionManager = sessionManager;
  }

  async execute(senderId) {
    const sender = await this.senderRepository.findById(senderId);
    if (!sender) {
      throw new AppError("Sender was not found", 404);
    }

    return {
      sender,
      session: await this.sessionManager.resetAuth(sender),
    };
  }
}

export default ResetSenderAuthUseCase;
