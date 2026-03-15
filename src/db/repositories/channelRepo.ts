import { getDb } from '../index';
import type { Channel } from '../../lib/types';

const toChannel = (row: Record<string, unknown>): Channel => ({
  id: String(row.id),
  providerId: String(row.provider_id),
  categoryId: String(row.category_id),
  name: String(row.name),
  logo: row.logo != null ? String(row.logo) : undefined,
  streamUrl: String(row.stream_url),
  streamType: row.stream_type != null ? String(row.stream_type) as Channel['streamType'] : undefined,
  epgChannelId: row.epg_channel_id != null ? String(row.epg_channel_id) : undefined,
});

const CHANNEL_INSERT_SQL =
  'INSERT OR REPLACE INTO channels (id, provider_id, category_id, name, logo, stream_url, stream_type, epg_channel_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

export type SQLBatchTuple = [string] | [string, unknown[]];

/** When loading "All" categories we limit to avoid 14k+ rows in memory (use search or pick a category for more). */
export const ALL_CHANNELS_LIMIT = 500;

export const channelRepo = {
  /** Build one batch tuple per channel for executeBatchAsync (same query, one params array per row). */
  getInsertTuples(channels: Channel[]): SQLBatchTuple[] {
    return channels.map((ch) => [
      CHANNEL_INSERT_SQL,
      [ch.id, ch.providerId, ch.categoryId, ch.name, ch.logo ?? null, ch.streamUrl, ch.streamType ?? null, ch.epgChannelId ?? null],
    ]);
  },

  async byProvider(providerId: string, categoryId?: string, limit?: number): Promise<Channel[]> {
    if (categoryId) {
      const res = await getDb().executeAsync(
        'SELECT id, provider_id, category_id, name, logo, stream_url, stream_type, epg_channel_id FROM channels WHERE provider_id = ? AND category_id = ? ORDER BY name',
        [providerId, categoryId]
      );
      const rows = res.rows?._array ?? [];
      return rows.map(toChannel);
    }
    const effectiveLimit = limit ?? ALL_CHANNELS_LIMIT;
    const res = await getDb().executeAsync(
      'SELECT id, provider_id, category_id, name, logo, stream_url, stream_type, epg_channel_id FROM channels WHERE provider_id = ? ORDER BY name LIMIT ?',
      [providerId, effectiveLimit]
    );
    const rows = res.rows?._array ?? [];
    return rows.map(toChannel);
  },

  async insert(ch: Channel): Promise<void> {
    getDb().execute(
      'INSERT OR REPLACE INTO channels (id, provider_id, category_id, name, logo, stream_url, stream_type, epg_channel_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [ch.id, ch.providerId, ch.categoryId, ch.name, ch.logo ?? null, ch.streamUrl, ch.streamType ?? null, ch.epgChannelId ?? null]
    );
  },

  async deleteByProvider(providerId: string): Promise<void> {
    getDb().execute('DELETE FROM channels WHERE provider_id = ?', [providerId]);
  },

  async search(providerId: string, query: string, limit: number): Promise<Channel[]> {
    const q = `%${query}%`;
    const res = await getDb().executeAsync(
      'SELECT id, provider_id, category_id, name, logo, stream_url, stream_type, epg_channel_id FROM channels WHERE provider_id = ? AND name LIKE ? ORDER BY name LIMIT ?',
      [providerId, q, limit]
    );
    const rows = res.rows?._array ?? [];
    return rows.map(toChannel);
  },

  async get(id: string): Promise<Channel | null> {
    const res = await getDb().executeAsync(
      'SELECT id, provider_id, category_id, name, logo, stream_url, stream_type, epg_channel_id FROM channels WHERE id = ?',
      [id]
    );
    const rows = res.rows?._array ?? [];
    return rows.length ? toChannel(rows[0]) : null;
  },
};
