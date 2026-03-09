import AppError from "../../shared/errors/app-error.js";

class GetSenderStatusUseCase {
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
      session: this.sessionManager.getStatus(sender.id),
    };
  }
}

export default GetSenderStatusUseCase;
