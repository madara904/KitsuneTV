import { getDb } from '../index';
import type { Category } from '../../lib/types';

const toCategory = (row: Record<string, unknown>): Category => ({
  id: String(row.id),
  providerId: String(row.provider_id),
  name: String(row.name),
  parentId: row.parent_id != null ? String(row.parent_id) : undefined,
});

const CATEGORY_INSERT_SQL =
  'INSERT OR REPLACE INTO categories (id, provider_id, name, parent_id) VALUES (?, ?, ?, ?)';

export type SQLBatchTuple = [string] | [string, unknown[]];

export const categoryRepo = {
  /** Build one batch tuple per category for executeBatchAsync. */
  getInsertTuples(categories: Category[]): SQLBatchTuple[] {
    return categories.map((c) => [
      CATEGORY_INSERT_SQL,
      [c.id, c.providerId, c.name, c.parentId ?? null],
    ]);
  },

  async byProvider(providerId: string): Promise<Category[]> {
    const res = await getDb().executeAsync(
      'SELECT id, provider_id, name, parent_id FROM categories WHERE provider_id = ? ORDER BY name',
      [providerId]
    );
    const rows = res.rows?._array ?? [];
    return rows.map(toCategory);
  },

  async insert(c: Category): Promise<void> {
    getDb().execute(
      'INSERT OR REPLACE INTO categories (id, provider_id, name, parent_id) VALUES (?, ?, ?, ?)',
      [c.id, c.providerId, c.name, c.parentId ?? null]
    );
  },

  async deleteByProvider(providerId: string): Promise<void> {
    getDb().execute('DELETE FROM categories WHERE provider_id = ?', [providerId]);
  },

  async search(providerId: string, query: string, limit: number): Promise<Category[]> {
    const q = `%${query}%`;
    const res = await getDb().executeAsync(
      'SELECT id, provider_id, name, parent_id FROM categories WHERE provider_id = ? AND name LIKE ? ORDER BY name LIMIT ?',
      [providerId, q, limit]
    );
    const rows = res.rows?._array ?? [];
    return rows.map(toCategory);
  },
};
