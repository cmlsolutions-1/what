const AppError = require("../../../shared/errors/app-error");

class NotificationController {
  constructor({ sendNotificationUseCase }) {
    this.sendNotificationUseCase = sendNotificationUseCase;
  }

  send = async (req, res, next) => {
    try {
      const { fromPhoneNumber, toPhoneNumber, message } = req.body;

      if (!fromPhoneNumber || !toPhoneNumber || !message) {
        throw new AppError("fromPhoneNumber, toPhoneNumber and message are required", 400);
      }

      const result = await this.sendNotificationUseCase.execute({
        fromPhoneNumber,
        toPhoneNumber,
        message,
      });

      res.status(200).json({
        message: "Notification sent",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = NotificationController;


