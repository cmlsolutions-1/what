import AppError from "../../../shared/errors/app-error.js";

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

      const confirmed = result.confirmationStatus === "confirmed";
      res.status(confirmed ? 200 : 202).json({
        message: confirmed
          ? "Notification sent"
          : "Message submission was not confirmed; check the recipient before retrying",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default NotificationController;
