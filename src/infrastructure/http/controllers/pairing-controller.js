import AppError from "../../../shared/errors/app-error.js";

class PairingController {
  constructor({ createPairingLinkUseCase, getPublicPairingStatusUseCase, connectPublicPairingUseCase }) {
    this.createPairingLinkUseCase = createPairingLinkUseCase;
    this.getPublicPairingStatusUseCase = getPublicPairingStatusUseCase;
    this.connectPublicPairingUseCase = connectPublicPairingUseCase;
  }

  createLink = async (req, res, next) => {
    try {
      const senderId = Number(req.params.senderId);
      if (!Number.isInteger(senderId) || senderId <= 0) {
        throw new AppError("senderId is invalid", 400);
      }
      const result = await this.createPairingLinkUseCase.execute(senderId);
      res.status(201).json({ message: "Pairing link created", data: result });
    } catch (error) {
      next(error);
    }
  };

  status = async (req, res, next) => {
    try {
      const result = await this.getPublicPairingStatusUseCase.execute(req.params.token);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  connect = async (req, res, next) => {
    try {
      const result = await this.connectPublicPairingUseCase.execute(req.params.token);
      res.status(200).json({ message: "Connection started", data: result });
    } catch (error) {
      next(error);
    }
  };
}

export default PairingController;
