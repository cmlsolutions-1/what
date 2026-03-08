const pool = require("../../../shared/database/postgres");

class WhatsappAuthRepository {
    async getCredsBySenderId(senderId) {
        const query = `
      SELECT creds
      FROM whatsapp_auth_credentials
      WHERE sender_id = $1
      LIMIT 1
    `;
        const { rows } = await pool.query(query, [senderId]);
        return rows[0]?.creds ?? null;
    }

    async upsertCreds(senderId, creds) {
        const query = `
      INSERT INTO whatsapp_auth_credentials (sender_id, creds, created_at, updated_at)
      VALUES ($1, $2::jsonb, NOW(), NOW())
      ON CONFLICT (sender_id)
      DO UPDATE SET
        creds = EXCLUDED.creds,
        updated_at = NOW()
    `;
        await pool.query(query, [senderId, JSON.stringify(creds)]);
    }

    async getKeys(senderId, type, ids) {
        if (!ids.length) return {};

        const query = `
      SELECT key_id, key_value
      FROM whatsapp_auth_keys
      WHERE sender_id = $1
        AND key_type = $2
        AND key_id = ANY($3::text[])
    `;

        const { rows } = await pool.query(query, [senderId, type, ids]);

        const result = {};
        for (const row of rows) {
            result[row.key_id] = row.key_value;
        }

        return result;
    }

    async setKeys(senderId, data) {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            for (const [type, entries] of Object.entries(data)) {
                for (const [id, value] of Object.entries(entries || {})) {
                    if (value === null) {
                        await client.query(
                            `
              DELETE FROM whatsapp_auth_keys
              WHERE sender_id = $1
                AND key_type = $2
                AND key_id = $3
              `,
                            [senderId, type, id],
                        );
                        continue;
                    }

                    await client.query(
                        `
            INSERT INTO whatsapp_auth_keys (
              sender_id,
              key_type,
              key_id,
              key_value,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW())
            ON CONFLICT (sender_id, key_type, key_id)
            DO UPDATE SET
              key_value = EXCLUDED.key_value,
              updated_at = NOW()
            `,
                        [senderId, type, id, JSON.stringify(value)],
                    );
                }
            }

            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    async deleteAuthBySenderId(senderId) {
        await pool.query(
            `DELETE FROM whatsapp_auth_credentials WHERE sender_id = $1`,
            [senderId],
        );
        await pool.query(
            `DELETE FROM whatsapp_auth_keys WHERE sender_id = $1`,
            [senderId],
        );
    }

    async updateConnectionStatus({ senderId, status, lastDisconnectReason = null }) {
        const query = `
      UPDATE whatsapp_senders
      SET status = $2,
          last_disconnect_reason = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

        const { rows } = await pool.query(query, [
            senderId,
            status,
            lastDisconnectReason,
        ]);

        return rows[0] ?? null;
    }
}

module.exports = WhatsappAuthRepository;