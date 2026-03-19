import { getDb } from '../index';
import type { MediaContentType } from '../../lib/types';

export const mediaCollectionRepo = {
  async setFavorite(
    contentType: MediaContentType,
    contentId: string,
    enabled: boolean,
  ): Promise<void> {
    if (enabled) {
      const id = `fav_${contentType}_${contentId}`;
      getDb().execute(
        'INSERT OR REPLACE INTO media_collections (id, content_type, content_id, collection_type, updated_at) VALUES (?, ?, ?, ?, ?)',
        [id, contentType, contentId, 'favorite', Date.now()],
      );
      return;
    }
    getDb().execute(
      'DELETE FROM media_collections WHERE content_type = ? AND content_id = ? AND collection_type = ?',
      [contentType, contentId, 'favorite'],
    );
  },

  async markRecent(contentType: MediaContentType, contentId: string): Promise<void> {
    const id = `recent_${contentType}_${contentId}`;
    getDb().execute(
      'INSERT OR REPLACE INTO media_collections (id, content_type, content_id, collection_type, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, contentType, contentId, 'recent', Date.now()],
    );
  },

  async favoriteIds(contentType: MediaContentType): Promise<string[]> {
    const res = await getDb().executeAsync(
      'SELECT content_id FROM media_collections WHERE content_type = ? AND collection_type = ? ORDER BY updated_at DESC',
      [contentType, 'favorite'],
    );
    return (res.rows?._array ?? []).map((r) => String(r.content_id));
  },

  async recentIds(contentType: MediaContentType, limit = 50): Promise<string[]> {
    const res = await getDb().executeAsync(
      'SELECT content_id FROM media_collections WHERE content_type = ? AND collection_type = ? ORDER BY updated_at DESC LIMIT ?',
      [contentType, 'recent', limit],
    );
    return (res.rows?._array ?? []).map((r) => String(r.content_id));
  },

  async hasFavorite(contentType: MediaContentType, contentId: string): Promise<boolean> {
    const res = await getDb().executeAsync(
      'SELECT 1 FROM media_collections WHERE content_type = ? AND content_id = ? AND collection_type = ? LIMIT 1',
      [contentType, contentId, 'favorite'],
    );
    return (res.rows?._array ?? []).length > 0;
  },
};

