import { getDb } from '../index';
import type { Movie } from '../../lib/types';

const toMovie = (row: Record<string, unknown>): Movie => ({
  id: String(row.id),
  providerId: String(row.provider_id),
  categoryId: String(row.category_id),
  name: String(row.name),
  poster: row.poster != null ? String(row.poster) : undefined,
  streamUrl: row.stream_url != null ? String(row.stream_url) : undefined,
});

export const movieRepo = {
  getInsertTuples(items: Movie[]): Array<[string, unknown[]]> {
    return items.map((m) => [
      'INSERT OR REPLACE INTO movies (id, provider_id, category_id, name, poster, stream_url) VALUES (?, ?, ?, ?, ?, ?)',
      [m.id, m.providerId, m.categoryId, m.name, m.poster ?? null, m.streamUrl ?? null],
    ]);
  },

  async byProvider(providerId: string, categoryId?: string): Promise<Movie[]> {
    const res = categoryId
      ? await getDb().executeAsync(
          'SELECT id, provider_id, category_id, name, poster, stream_url FROM movies WHERE provider_id = ? AND category_id = ? ORDER BY name',
          [providerId, categoryId],
        )
      : await getDb().executeAsync(
          'SELECT id, provider_id, category_id, name, poster, stream_url FROM movies WHERE provider_id = ? ORDER BY name',
          [providerId],
        );
    return (res.rows?._array ?? []).map(toMovie);
  },

  async getMany(ids: string[]): Promise<Movie[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const res = await getDb().executeAsync(
      `SELECT id, provider_id, category_id, name, poster, stream_url FROM movies WHERE id IN (${placeholders})`,
      ids,
    );
    const rows = res.rows?._array ?? [];
    const mapped = new Map(rows.map((r) => [String(r.id), toMovie(r)]));
    return ids.map((id) => mapped.get(id)).filter((v): v is Movie => !!v);
  },

  async clearByProvider(providerId: string): Promise<void> {
    getDb().execute('DELETE FROM movies WHERE provider_id = ?', [providerId]);
  },
};

