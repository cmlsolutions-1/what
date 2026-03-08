-- CREATE TABLE IF NOT EXISTS whatsapp_senders (
--   id SERIAL PRIMARY KEY,
--   display_name VARCHAR(120) NOT NULL,
--   phone_number VARCHAR(30) NOT NULL UNIQUE,
--   normalized_phone_number VARCHAR(20) NOT NULL UNIQUE,
--   auth_folder VARCHAR(120) NOT NULL UNIQUE,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- CREATE INDEX IF NOT EXISTS idx_whatsapp_senders_normalized_phone
--   ON whatsapp_senders(normalized_phone_number);


CREATE TABLE IF NOT EXISTS whatsapp_senders (
  id SERIAL PRIMARY KEY,
  display_name VARCHAR(120) NOT NULL,
  phone_number VARCHAR(30) NOT NULL UNIQUE,
  normalized_phone_number VARCHAR(20) NOT NULL UNIQUE,
  auth_folder VARCHAR(120) NOT NULL UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'disconnected',
  last_disconnect_reason VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_senders_normalized_phone
  ON whatsapp_senders(normalized_phone_number);

CREATE TABLE IF NOT EXISTS whatsapp_auth_credentials (
  sender_id INTEGER PRIMARY KEY REFERENCES whatsapp_senders(id) ON DELETE CASCADE,
  creds JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_auth_keys (
  id BIGSERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES whatsapp_senders(id) ON DELETE CASCADE,
  key_type VARCHAR(100) NOT NULL,
  key_id VARCHAR(255) NOT NULL,
  key_value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sender_id, key_type, key_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_auth_keys_sender_type
  ON whatsapp_auth_keys(sender_id, key_type);