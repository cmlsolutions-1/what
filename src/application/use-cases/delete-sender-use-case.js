import AppError from "../../shared/errors/app-error.js";

class DeleteSenderUseCase {
  constructor(senderRepository, sessionManager) {
    this.senderRepository = senderRepository;
    this.sessionManager = sessionManager;
  }

  async execute(senderId) {
    const sender = await this.senderRepository.findById(senderId);
    if (!sender) {
      throw new AppError("Sender was not found", 404);
    }

    const session = await this.sessionManager.resetAuth(sender);
    const deleted = await this.senderRepository.deleteById(senderId);
    if (!deleted) {
      throw new AppError("Sender was not found", 404);
    }

    return { sender, session };
  }
}

export default DeleteSenderUseCase;
