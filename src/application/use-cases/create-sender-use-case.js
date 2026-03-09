import AppError from "../../shared/errors/app-error.js";
import { normalizePhoneNumber } from "../../shared/utils/phone-utils.js";

class CreateSenderUseCase {
  constructor(senderRepository) {
    this.senderRepository = senderRepository;
  }

  async execute({ displayName, phoneNumber }) {
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    const existing = await this.senderRepository.findByNormalizedPhoneNumber(normalizedPhoneNumber);

    if (existing) {
      throw new AppError("The sender phone number is already registered", 409);
    }

    const safeDisplayName =
      typeof displayName === "string" && displayName.trim().length > 0
        ? displayName.trim()
        : `Sender ${normalizedPhoneNumber}`;

    return this.senderRepository.create({
      displayName: safeDisplayName,
      phoneNumber,
      normalizedPhoneNumber,
      authFolder: `sender_${normalizedPhoneNumber}`,
    });
  }
}

export default CreateSenderUseCase;
