import { getDb } from '../index';
import type { RecentChannel } from '../../lib/types';

const toRecent = (row: Record<string, unknown>): RecentChannel => ({
  id: String(row.id),
  channelId: String(row.channel_id),
  watchedAt: Number(row.watched_at),
});

export const recentRepo = {
  async list(limit: number): Promise<RecentChannel[]> {
    const res = await getDb().executeAsync(
      'SELECT id, channel_id, watched_at FROM recent_channels ORDER BY watched_at DESC LIMIT ?',
      [limit]
    );
    const rows = res.rows?._array ?? [];
    return rows.map(toRecent);
  },

  async add(channelId: string): Promise<void> {
    const id = `recent_${channelId}_${Date.now()}`;
    const watchedAt = Date.now();
    getDb().execute('INSERT INTO recent_channels (id, channel_id, watched_at) VALUES (?, ?, ?)', [
      id,
      channelId,
      watchedAt,
    ]);
  },

  async clear(): Promise<void> {
    getDb().execute('DELETE FROM recent_channels', []);
  },
};
