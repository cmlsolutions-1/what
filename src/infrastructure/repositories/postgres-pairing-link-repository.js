class PostgresPairingLinkRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ senderId, tokenHash, expiresAt }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE whatsapp_pairing_links
         SET used_at = NOW(), used_reason = 'replaced'
         WHERE sender_id = $1 AND used_at IS NULL`,
        [senderId],
      );
      const result = await client.query(
        `INSERT INTO whatsapp_pairing_links (sender_id, token_hash, expires_at)
         VALUES ($1, $2, $3)
         RETURNING id, sender_id, expires_at, created_at`,
        [senderId, tokenHash, expiresAt],
      );
      await client.query("COMMIT");
      return this.mapRow(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findByTokenHash(tokenHash) {
    const result = await this.pool.query(
      `SELECT id, sender_id, expires_at, used_at, used_reason, created_at
       FROM whatsapp_pairing_links
       WHERE token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async consumeById(id, reason) {
    await this.pool.query(
      `UPDATE whatsapp_pairing_links
       SET used_at = COALESCE(used_at, NOW()),
           used_reason = COALESCE(used_reason, $2)
       WHERE id = $1`,
      [id, reason],
    );
  }

  async consumeActiveForSender(senderId, reason = "connected") {
    await this.pool.query(
      `UPDATE whatsapp_pairing_links
       SET used_at = NOW(), used_reason = $2
       WHERE sender_id = $1 AND used_at IS NULL`,
      [senderId, reason],
    );
  }

  mapRow(row) {
    return {
      id: Number(row.id),
      senderId: Number(row.sender_id),
      expiresAt: row.expires_at,
      usedAt: row.used_at,
      usedReason: row.used_reason,
      createdAt: row.created_at,
    };
  }
}

export default PostgresPairingLinkRepository;
