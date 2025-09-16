-- Migration: Add Home Assistant configuration table
-- Description: Stores user Home Assistant credentials for IoT monitoring

CREATE TABLE IF NOT EXISTS user_ha_config (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    ha_url VARCHAR(255) NOT NULL,
    encrypted_token TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_connected TIMESTAMP
);

-- Add index for faster lookups
CREATE INDEX idx_user_ha_config_user_id ON user_ha_config(user_id);
CREATE INDEX idx_user_ha_config_is_active ON user_ha_config(is_active);