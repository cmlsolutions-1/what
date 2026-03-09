class SenderAccount {
  constructor({
    id,
    displayName,
    phoneNumber,
    normalizedPhoneNumber,
    authFolder,
    status,
    lastDisconnectReason,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.displayName = displayName;
    this.phoneNumber = phoneNumber;
    this.normalizedPhoneNumber = normalizedPhoneNumber;
    this.authFolder = authFolder;
    this.status = status;
    this.lastDisconnectReason = lastDisconnectReason;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

export default SenderAccount;
