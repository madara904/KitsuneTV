import { getDb } from '../index';
import type { SeriesItem } from '../../lib/types';

const toSeries = (row: Record<string, unknown>): SeriesItem => ({
  id: String(row.id),
  providerId: String(row.provider_id),
  categoryId: String(row.category_id),
  name: String(row.name),
  poster: row.poster != null ? String(row.poster) : undefined,
});

export const seriesRepo = {
  getInsertTuples(items: SeriesItem[]): Array<[string, unknown[]]> {
    return items.map((s) => [
      'INSERT OR REPLACE INTO series_items (id, provider_id, category_id, name, poster) VALUES (?, ?, ?, ?, ?)',
      [s.id, s.providerId, s.categoryId, s.name, s.poster ?? null],
    ]);
  },

  async byProvider(
    providerId: string,
    categoryId?: string,
    limit = 120,
    offset = 0,
  ): Promise<SeriesItem[]> {
    const res = categoryId
      ? await getDb().executeAsync(
          'SELECT id, provider_id, category_id, name, poster FROM series_items WHERE provider_id = ? AND category_id = ? ORDER BY name LIMIT ? OFFSET ?',
          [providerId, categoryId, limit, offset],
        )
      : await getDb().executeAsync(
          'SELECT id, provider_id, category_id, name, poster FROM series_items WHERE provider_id = ? ORDER BY name LIMIT ? OFFSET ?',
          [providerId, limit, offset],
        );
    return (res.rows?._array ?? []).map(toSeries);
  },

  async search(
    providerId: string,
    query: string,
    limit = 120,
    offset = 0,
    categoryId?: string,
  ): Promise<SeriesItem[]> {
    const q = `%${query}%`;
    const res = categoryId
      ? await getDb().executeAsync(
          'SELECT id, provider_id, category_id, name, poster FROM series_items WHERE provider_id = ? AND category_id = ? AND name LIKE ? ORDER BY name LIMIT ? OFFSET ?',
          [providerId, categoryId, q, limit, offset],
        )
      : await getDb().executeAsync(
          'SELECT id, provider_id, category_id, name, poster FROM series_items WHERE provider_id = ? AND name LIKE ? ORDER BY name LIMIT ? OFFSET ?',
          [providerId, q, limit, offset],
        );
    return (res.rows?._array ?? []).map(toSeries);
  },

  async getMany(ids: string[]): Promise<SeriesItem[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const res = await getDb().executeAsync(
      `SELECT id, provider_id, category_id, name, poster FROM series_items WHERE id IN (${placeholders})`,
      ids,
    );
    const rows = res.rows?._array ?? [];
    const mapped = new Map(rows.map((r) => [String(r.id), toSeries(r)]));
    return ids.map((id) => mapped.get(id)).filter((v): v is SeriesItem => !!v);
  },

  async clearByProvider(providerId: string): Promise<void> {
    getDb().execute('DELETE FROM series_items WHERE provider_id = ?', [providerId]);
  },
};
