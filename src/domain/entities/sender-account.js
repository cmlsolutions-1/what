class SenderAccount {
  constructor({
    id,
    displayName,
    phoneNumber,
    normalizedPhoneNumber,
    authFolder,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.displayName = displayName;
    this.phoneNumber = phoneNumber;
    this.normalizedPhoneNumber = normalizedPhoneNumber;
    this.authFolder = authFolder;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = SenderAccount;

