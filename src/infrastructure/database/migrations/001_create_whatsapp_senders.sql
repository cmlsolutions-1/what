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

ALTER TABLE whatsapp_senders
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'disconnected';

ALTER TABLE whatsapp_senders
  ADD COLUMN IF NOT EXISTS last_disconnect_reason VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_whatsapp_senders_normalized_phone
  ON whatsapp_senders(normalized_phone_number);
