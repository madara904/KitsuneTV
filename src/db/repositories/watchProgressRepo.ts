import { getDb } from '../index';

export type WatchProgress = {
  contentType: 'movie' | 'series';
  contentId: string;
  episodeId: string;
  positionSec: number;
  durationSec?: number;
  updatedAt: number;
};

const episodeKey = (episodeId: string | undefined) => episodeId ?? '';

export const watchProgressRepo = {
  async get(
    contentType: 'movie' | 'series',
    contentId: string,
    episodeId?: string,
  ): Promise<WatchProgress | null> {
    const key = episodeKey(episodeId);
    const res = await getDb().executeAsync(
      `SELECT content_type, content_id, episode_id, position_sec, duration_sec, updated_at
       FROM watch_progress WHERE content_type = ? AND content_id = ? AND episode_id = ?`,
      [contentType, contentId, key],
    );
    const row = (res.rows?._array ?? [])[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    const dbContentType = String(row.content_type);
    const contentTypeSafe = dbContentType === 'series' ? 'series' : 'movie';
    return {
      contentType: contentTypeSafe,
      contentId: String(row.content_id),
      episodeId: String(row.episode_id),
      positionSec: Number(row.position_sec),
      durationSec: row.duration_sec != null ? Number(row.duration_sec) : undefined,
      updatedAt: Number(row.updated_at),
    };
  },

  async listByContent(
    contentType: 'movie' | 'series',
    contentId: string,
  ): Promise<WatchProgress[]> {
    const res = await getDb().executeAsync(
      `SELECT content_type, content_id, episode_id, position_sec, duration_sec, updated_at
       FROM watch_progress
       WHERE content_type = ? AND content_id = ?
       ORDER BY updated_at DESC`,
      [contentType, contentId],
    );

    const rows = (res.rows?._array ?? []) as Array<Record<string, unknown>>;
    return rows.map((row) => {
      const dbContentType = String(row.content_type);
      const contentTypeSafe = dbContentType === 'series' ? 'series' : 'movie';
      return {
        contentType: contentTypeSafe,
        contentId: String(row.content_id),
        episodeId: String(row.episode_id),
        positionSec: Number(row.position_sec),
        durationSec: row.duration_sec != null ? Number(row.duration_sec) : undefined,
        updatedAt: Number(row.updated_at),
      };
    });
  },

  async save(
    contentType: 'movie' | 'series',
    contentId: string,
    episodeId: string | undefined,
    positionSec: number,
    durationSec?: number,
  ): Promise<void> {
    const key = episodeKey(episodeId);
    const updatedAt = Date.now();
    getDb().execute(
      `INSERT OR REPLACE INTO watch_progress (content_type, content_id, episode_id, position_sec, duration_sec, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [contentType, contentId, key, positionSec, durationSec ?? null, updatedAt],
    );
  },
};
