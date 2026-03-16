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

CREATE TABLE IF NOT EXISTS movie_categories (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS movies (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  poster TEXT,
  stream_url TEXT,
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES movie_categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS series_categories (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS series_items (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  poster TEXT,
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES series_categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media_collections (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'series')),
  content_id TEXT NOT NULL,
  collection_type TEXT NOT NULL CHECK (collection_type IN ('favorite', 'recent')),
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_collections_unique
ON media_collections(content_type, content_id, collection_type);

CREATE INDEX IF NOT EXISTS idx_channels_provider ON channels(provider_id);
CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_provider ON categories(provider_id);
CREATE INDEX IF NOT EXISTS idx_recent_watched ON recent_channels(watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_movies_provider ON movies(provider_id);
CREATE INDEX IF NOT EXISTS idx_movies_category ON movies(category_id);
CREATE INDEX IF NOT EXISTS idx_series_provider ON series_items(provider_id);
CREATE INDEX IF NOT EXISTS idx_series_category ON series_items(category_id);
`;
