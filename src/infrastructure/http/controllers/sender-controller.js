const AppError = require("../../../shared/errors/app-error");

class SenderController {
  constructor({ createSenderUseCase, listSendersUseCase, connectSenderUseCase, getSenderStatusUseCase }) {
    this.createSenderUseCase = createSenderUseCase;
    this.listSendersUseCase = listSendersUseCase;
    this.connectSenderUseCase = connectSenderUseCase;
    this.getSenderStatusUseCase = getSenderStatusUseCase;
  }

  create = async (req, res, next) => {
    try {
      const { displayName, phoneNumber } = req.body;

      if (!phoneNumber) {
        throw new AppError("phoneNumber is required", 400);
      }

      const sender = await this.createSenderUseCase.execute({ displayName, phoneNumber });

      res.status(201).json({
        message: "Sender registered",
        data: sender,
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (_req, res, next) => {
    try {
      const senders = await this.listSendersUseCase.execute();

      res.status(200).json({
        data: senders,
      });
    } catch (error) {
      next(error);
    }
  };

  connect = async (req, res, next) => {
    try {
      const senderId = Number(req.params.senderId);

      if (Number.isNaN(senderId)) {
        throw new AppError("senderId is invalid", 400);
      }

      const result = await this.connectSenderUseCase.execute(senderId);

      res.status(200).json({
        message: "Connection started",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  status = async (req, res, next) => {
    try {
      const senderId = Number(req.params.senderId);

      if (Number.isNaN(senderId)) {
        throw new AppError("senderId is invalid", 400);
      }

      const result = await this.getSenderStatusUseCase.execute(senderId);

      res.status(200).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = SenderController;


