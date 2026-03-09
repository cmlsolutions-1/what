import SenderAccount from "../../domain/entities/sender-account.js";

class PostgresSenderRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ displayName, phoneNumber, normalizedPhoneNumber, authFolder }) {
    const query = `
      INSERT INTO whatsapp_senders (display_name, phone_number, normalized_phone_number, auth_folder)
      VALUES ($1, $2, $3, $4)
      RETURNING id, display_name, phone_number, normalized_phone_number, auth_folder, status, last_disconnect_reason, created_at, updated_at
    `;

    const values = [displayName, phoneNumber, normalizedPhoneNumber, authFolder];
    const result = await this.pool.query(query, values);
    return this.mapRow(result.rows[0]);
  }

  async listAll() {
    const query = `
      SELECT id, display_name, phone_number, normalized_phone_number, auth_folder, status, last_disconnect_reason, created_at, updated_at
      FROM whatsapp_senders
      ORDER BY id ASC
    `;

    const result = await this.pool.query(query);
    return result.rows.map((row) => this.mapRow(row));
  }

  async findById(id) {
    const query = `
      SELECT id, display_name, phone_number, normalized_phone_number, auth_folder, status, last_disconnect_reason, created_at, updated_at
      FROM whatsapp_senders
      WHERE id = $1
      LIMIT 1
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByNormalizedPhoneNumber(normalizedPhoneNumber) {
    const query = `
      SELECT id, display_name, phone_number, normalized_phone_number, auth_folder, status, last_disconnect_reason, created_at, updated_at
      FROM whatsapp_senders
      WHERE normalized_phone_number = $1
      LIMIT 1
    `;

    const result = await this.pool.query(query, [normalizedPhoneNumber]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  mapRow(row) {
    return new SenderAccount({
      id: row.id,
      displayName: row.display_name,
      phoneNumber: row.phone_number,
      normalizedPhoneNumber: row.normalized_phone_number,
      authFolder: row.auth_folder,
      status: row.status,
      lastDisconnectReason: row.last_disconnect_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

export default PostgresSenderRepository;
