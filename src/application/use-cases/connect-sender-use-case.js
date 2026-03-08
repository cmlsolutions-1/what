const AppError = require("../../shared/errors/app-error");

class ConnectSenderUseCase {
  constructor(senderRepository, sessionManager) {
    this.senderRepository = senderRepository;
    this.sessionManager = sessionManager;
  }

  async execute(senderId) {
    const sender = await this.senderRepository.findById(senderId);

    if (!sender) {
      throw new AppError("Sender was not found", 404);
    }

    const session = await this.sessionManager.connect(sender);

    return {
      sender,
      session,
    };
  }
}

module.exports = ConnectSenderUseCase;

