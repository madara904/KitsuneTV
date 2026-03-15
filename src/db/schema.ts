/**
 * SQLite schema - same as WORKING_DOC. Run on DB init.
 */
export const SCHEMA_SQL = `
-- Providers (credentials in Keychain)
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('xtream', 'm3u')),
  url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  logo TEXT,
  stream_url TEXT NOT NULL,
  stream_type TEXT,
  epg_channel_id TEXT,
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recent_channels (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  watched_at INTEGER NOT NULL,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_channels_provider ON channels(provider_id);
CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_provider ON categories(provider_id);
CREATE INDEX IF NOT EXISTS idx_recent_watched ON recent_channels(watched_at DESC);
`;
