class ListSendersUseCase {
  constructor(senderRepository) {
    this.senderRepository = senderRepository;
  }

  async execute() {
    return this.senderRepository.listAll();
  }
}

export default ListSendersUseCase;
