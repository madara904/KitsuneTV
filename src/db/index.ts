/**
 * Database init - react-native-quick-sqlite.
 */
import { open, type QuickSQLiteConnection } from 'react-native-quick-sqlite';
import { SCHEMA_SQL } from './schema';

const DB_NAME = 'kitsune';

let db: QuickSQLiteConnection | null = null;

function getStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((s) => s.replace(/--[^\n]*/g, '').trim())
    .filter(Boolean);
}

export async function initDatabase(): Promise<void> {
  if (db) return;
  db = open({ name: DB_NAME });
  const statements = getStatements(SCHEMA_SQL);
  for (const stmt of statements) {
    db.execute(stmt);
  }
}

export function getDb(): QuickSQLiteConnection {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export { SCHEMA_SQL } from './schema';
