class GetPublicPairingStatusUseCase {
  constructor(resolvePairingLinkUseCase, sessionManager) {
    this.resolvePairingLinkUseCase = resolvePairingLinkUseCase;
    this.sessionManager = sessionManager;
  }

  async execute(token) {
    const { link, sender } = await this.resolvePairingLinkUseCase.execute(token);
    const session = this.sessionManager.getStatus(sender.id);
    return {
      sender: {
        displayName: sender.displayName,
        phoneLastFour: sender.normalizedPhoneNumber?.slice(-4) ?? null,
      },
      session,
      expiresAt: new Date(link.expiresAt).toISOString(),
    };
  }
}

export default GetPublicPairingStatusUseCase;
