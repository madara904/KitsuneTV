import { getDb } from '../index';
import type { Favorite } from '../../lib/types';

const toFavorite = (row: Record<string, unknown>): Favorite => ({
  id: String(row.id),
  channelId: String(row.channel_id),
  createdAt: Number(row.created_at),
});

export const favoriteRepo = {
  async all(): Promise<Favorite[]> {
    const res = await getDb().executeAsync(
      'SELECT id, channel_id, created_at FROM favorites ORDER BY created_at DESC',
      []
    );
    const rows = res.rows?._array ?? [];
    return rows.map(toFavorite);
  },

  async add(channelId: string): Promise<Favorite> {
    const id = `fav_${channelId}_${Date.now()}`;
    const createdAt = Date.now();
    getDb().execute('INSERT OR REPLACE INTO favorites (id, channel_id, created_at) VALUES (?, ?, ?)', [
      id,
      channelId,
      createdAt,
    ]);
    return { id, channelId, createdAt };
  },

  async remove(channelId: string): Promise<void> {
    getDb().execute('DELETE FROM favorites WHERE channel_id = ?', [channelId]);
  },

  async has(channelId: string): Promise<boolean> {
    const res = await getDb().executeAsync('SELECT 1 FROM favorites WHERE channel_id = ? LIMIT 1', [channelId]);
    const rows = res.rows?._array ?? [];
    return rows.length > 0;
  },
};
