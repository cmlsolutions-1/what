import pool from "../database/postgres-pool.js";

class WhatsappSenderRepository {
  async updateConnectionStatus({ senderId, status, lastDisconnectReason = null }) {
    const query = `
      UPDATE whatsapp_senders
      SET status = $2,
          last_disconnect_reason = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `;

    await pool.query(query, [senderId, status, lastDisconnectReason]);
  }
}

export default WhatsappSenderRepository;
