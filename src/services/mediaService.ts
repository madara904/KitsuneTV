import * as Xtream from '../api/xtream/client';
import { getProviderCredentials } from '../lib/keychain';
import { getDb } from '../db/index';
import { providerRepo } from '../db/repositories/providerRepo';
import { movieRepo } from '../db/repositories/movieRepo';
import { seriesRepo } from '../db/repositories/seriesRepo';
import type { Category, Movie, SeriesItem } from '../lib/types';

function movieCategoryInsertTuples(categories: Category[]): Array<[string, unknown[]]> {
  return categories.map((c) => [
    'INSERT OR REPLACE INTO movie_categories (id, provider_id, name) VALUES (?, ?, ?)',
    [c.id, c.providerId, c.name],
  ]);
}

function seriesCategoryInsertTuples(categories: Category[]): Array<[string, unknown[]]> {
  return categories.map((c) => [
    'INSERT OR REPLACE INTO series_categories (id, provider_id, name) VALUES (?, ?, ?)',
    [c.id, c.providerId, c.name],
  ]);
}

export const mediaService = {
  async syncProvider(providerId: string): Promise<void> {
    const provider = await providerRepo.get(providerId);
    if (!provider || provider.type !== 'xtream') return;

    const creds = await getProviderCredentials(providerId);
    if (!creds) throw new Error('Xtream credentials not found');
    const config: Xtream.XtreamConfig = {
      serverUrl: provider.url,
      username: creds.username,
      password: creds.password,
    };

    const [vodCategoriesApi, vodStreamsApi, seriesCategoriesApi, seriesApi] = await Promise.all([
      Xtream.getVodCategories(config),
      Xtream.getVodStreams(config),
      Xtream.getSeriesCategories(config),
      Xtream.getSeries(config),
    ]);

    const defaultMovieCat = `${providerId}_movie_default`;
    const movieCategories: Category[] = [
      { id: defaultMovieCat, providerId, name: 'All Movies' },
      ...vodCategoriesApi.map((c) => ({
        id: `${providerId}_movie_${c.category_id}`,
        providerId,
        name: c.category_name,
      })),
    ];
    const movies: Movie[] = vodStreamsApi.map((m) => {
      const categoryId = m.category_id ? `${providerId}_movie_${m.category_id}` : defaultMovieCat;
      const ext = m.container_extension ? `.${m.container_extension}` : '.mp4';
      const base = provider.url.replace(/\/$/, '');
      return {
        id: `${providerId}_movie_${m.stream_id}`,
        providerId,
        categoryId,
        name: m.name,
        poster: m.stream_icon,
        streamUrl: `${base}/movie/${encodeURIComponent(creds.username)}/${encodeURIComponent(
          creds.password,
        )}/${m.stream_id}${ext}`,
      };
    });

    const defaultSeriesCat = `${providerId}_series_default`;
    const seriesCategories: Category[] = [
      { id: defaultSeriesCat, providerId, name: 'All Series' },
      ...seriesCategoriesApi.map((c) => ({
        id: `${providerId}_series_${c.category_id}`,
        providerId,
        name: c.category_name,
      })),
    ];
    const seriesItems: SeriesItem[] = seriesApi.map((s) => ({
      id: `${providerId}_series_${s.series_id}`,
      providerId,
      categoryId: s.category_id ? `${providerId}_series_${s.category_id}` : defaultSeriesCat,
      name: s.name,
      poster: s.cover,
    }));

    await getDb().executeBatchAsync([
      ['DELETE FROM movies WHERE provider_id = ?', [providerId]],
      ['DELETE FROM movie_categories WHERE provider_id = ?', [providerId]],
      ...movieCategoryInsertTuples(movieCategories),
      ...movieRepo.getInsertTuples(movies),
      ['DELETE FROM series_items WHERE provider_id = ?', [providerId]],
      ['DELETE FROM series_categories WHERE provider_id = ?', [providerId]],
      ...seriesCategoryInsertTuples(seriesCategories),
      ...seriesRepo.getInsertTuples(seriesItems),
    ]);
  },

  async getMovieCategories(providerId: string): Promise<Category[]> {
    const res = await getDb().executeAsync(
      'SELECT id, provider_id, name FROM movie_categories WHERE provider_id = ? ORDER BY name',
      [providerId],
    );
    return (res.rows?._array ?? []).map((r) => ({
      id: String(r.id),
      providerId: String(r.provider_id),
      name: String(r.name),
    }));
  },

  async getMovies(providerId: string, categoryId?: string): Promise<Movie[]> {
    return movieRepo.byProvider(providerId, categoryId);
  },

  async getSeriesCategories(providerId: string): Promise<Category[]> {
    const res = await getDb().executeAsync(
      'SELECT id, provider_id, name FROM series_categories WHERE provider_id = ? ORDER BY name',
      [providerId],
    );
    return (res.rows?._array ?? []).map((r) => ({
      id: String(r.id),
      providerId: String(r.provider_id),
      name: String(r.name),
    }));
  },

  async getSeries(providerId: string, categoryId?: string): Promise<SeriesItem[]> {
    return seriesRepo.byProvider(providerId, categoryId);
  },
};

