import * as Xtream from '../api/xtream/client';
import { getProviderCredentials } from '../lib/keychain';
import { providerRepo } from '../db/repositories/providerRepo';
import { movieRepo } from '../db/repositories/movieRepo';
import { seriesRepo } from '../db/repositories/seriesRepo';
import { settingsRepo } from '../db/repositories/settingsRepo';
import type { Category, Movie, SeriesItem } from '../lib/types';
import { executeBatchInChunks, type SQLBatchTuple } from '../db/batch';
import { getDb } from '../db/index';

const FAST_INSERT_BATCH_OPTIONS = { chunkSize: 450, yieldEveryChunks: 10 } as const;
const DELTA_SYNC_KEY_PREFIX = 'delta_sync_initialized_media_';
const MAX_MOVIES_PER_SYNC = 30000;
const MAX_SERIES_PER_SYNC = 15000;

function syncLog(providerId: string, stage: string, details?: string): void {
  const suffix = details ? ` ${details}` : '';
  console.info(`[SYNC][media][${providerId}] ${stage}${suffix}`);
}

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

function isLikelyCategoryFiltered(
  requestedCategoryId: string,
  rows: Array<{ category_id?: string }>,
): boolean {
  let withCategory = 0;
  let mismatch = 0;
  for (const row of rows) {
    if (row.category_id == null || row.category_id === '') continue;
    withCategory++;
    if (String(row.category_id) !== requestedCategoryId) mismatch++;
  }
  if (withCategory === 0) return true;
  return mismatch / withCategory < 0.35;
}

export const mediaService = {
  async syncProvider(providerId: string): Promise<void> {
    const start = Date.now();
    try {
      const provider = await providerRepo.get(providerId);
      if (!provider || provider.type !== 'xtream') return;

      const creds = await getProviderCredentials(providerId);
      if (!creds) throw new Error('Xtream credentials not found');
      const config: Xtream.XtreamConfig = {
        serverUrl: provider.url,
        username: creds.username,
        password: creds.password,
      };

      const defaultMovieCat = `${providerId}_movie_default`;
      const vodCategoriesApi = await Xtream.getVodCategories(config);
      const movieCategories: Category[] = [
        { id: defaultMovieCat, providerId, name: 'All Movies' },
        ...vodCategoriesApi.map((c) => ({
          id: `${providerId}_movie_${c.category_id}`,
          providerId,
          name: c.category_name,
        })),
      ];

      const deltaKey = `${DELTA_SYNC_KEY_PREFIX}${providerId}`;
      const initialized = (await settingsRepo.get(deltaKey)) === '1';

      const movieBootstrapBatch: SQLBatchTuple[] = [
        ...(initialized
          ? []
          : [
              ['DELETE FROM movies WHERE provider_id = ?', [providerId]] as SQLBatchTuple,
              ['DELETE FROM movie_categories WHERE provider_id = ?', [providerId]] as SQLBatchTuple,
            ]),
        ...movieCategoryInsertTuples(movieCategories),
      ];
      await executeBatchInChunks(movieBootstrapBatch);
      syncLog(providerId, 'movies:categories-loaded', `count=${movieCategories.length}`);

      let totalMovies = 0;
      if (vodCategoriesApi.length === 0) {
        const vodStreams = await Xtream.getVodStreams(config);
        const movies = vodStreams.map((m) => {
          const ext = m.container_extension ? `.${m.container_extension}` : '.mp4';
          const base = provider.url.replace(/\/$/, '');
          return {
            id: `${providerId}_movie_${m.stream_id}`,
            providerId,
            categoryId: defaultMovieCat,
            name: m.name,
            poster: m.stream_icon,
            streamUrl: `${base}/movie/${encodeURIComponent(creds.username)}/${encodeURIComponent(
              creds.password,
            )}/${m.stream_id}${ext}`,
          } as Movie;
        });
        await executeBatchInChunks(movieRepo.getInsertTuples(movies), FAST_INSERT_BATCH_OPTIONS);
        totalMovies = movies.length;
        if (totalMovies >= MAX_MOVIES_PER_SYNC) {
          syncLog(providerId, 'movies:cap-reached', `cap=${MAX_MOVIES_PER_SYNC}`);
        }
      } else {
        for (const c of vodCategoriesApi) {
          const phaseStart = Date.now();
          const streams = await Xtream.getVodStreams(config, c.category_id);
          const movies = streams.map((m) => {
            const ext = m.container_extension ? `.${m.container_extension}` : '.mp4';
            const base = provider.url.replace(/\/$/, '');
            return {
              id: `${providerId}_movie_${m.stream_id}`,
              providerId,
              categoryId: m.category_id ? `${providerId}_movie_${m.category_id}` : defaultMovieCat,
              name: m.name,
              poster: m.stream_icon,
              streamUrl: `${base}/movie/${encodeURIComponent(creds.username)}/${encodeURIComponent(
                creds.password,
              )}/${m.stream_id}${ext}`,
            } as Movie;
          });
          await executeBatchInChunks(movieRepo.getInsertTuples(movies), FAST_INSERT_BATCH_OPTIONS);
          totalMovies += movies.length;
          if (totalMovies >= MAX_MOVIES_PER_SYNC) {
            syncLog(providerId, 'movies:cap-reached', `cap=${MAX_MOVIES_PER_SYNC}`);
            break;
          }
          syncLog(
            providerId,
            'movies:category-synced',
            `category=${c.category_id} items=${movies.length} elapsedMs=${Date.now() - phaseStart}`,
          );

          if (!isLikelyCategoryFiltered(c.category_id, streams)) {
            syncLog(
              providerId,
              'movies:category-filter-ignored',
              `category=${c.category_id} detected=true -> stopping per-category loop early`,
            );
            break;
          }
        }
      }

      const defaultSeriesCat = `${providerId}_series_default`;
      const seriesCategoriesApi = await Xtream.getSeriesCategories(config);
      const seriesCategories: Category[] = [
        { id: defaultSeriesCat, providerId, name: 'All Series' },
        ...seriesCategoriesApi.map((c) => ({
          id: `${providerId}_series_${c.category_id}`,
          providerId,
          name: c.category_name,
        })),
      ];

      const seriesBootstrapBatch: SQLBatchTuple[] = [
        ...(initialized
          ? []
          : [
              ['DELETE FROM series_items WHERE provider_id = ?', [providerId]] as SQLBatchTuple,
              ['DELETE FROM series_categories WHERE provider_id = ?', [providerId]] as SQLBatchTuple,
            ]),
        ...seriesCategoryInsertTuples(seriesCategories),
      ];
      await executeBatchInChunks(seriesBootstrapBatch);
      if (!initialized) await settingsRepo.set(deltaKey, '1');
      syncLog(providerId, 'series:categories-loaded', `count=${seriesCategories.length}`);

      let totalSeries = 0;
      if (seriesCategoriesApi.length === 0) {
        const allSeries = await Xtream.getSeries(config);
        const seriesItems: SeriesItem[] = allSeries.map((s) => ({
          id: `${providerId}_series_${s.series_id}`,
          providerId,
          categoryId: s.category_id ? `${providerId}_series_${s.category_id}` : defaultSeriesCat,
          name: s.name,
          poster: s.cover,
        }));
        await executeBatchInChunks(seriesRepo.getInsertTuples(seriesItems), FAST_INSERT_BATCH_OPTIONS);
        totalSeries = seriesItems.length;
        if (totalSeries >= MAX_SERIES_PER_SYNC) {
          syncLog(providerId, 'series:cap-reached', `cap=${MAX_SERIES_PER_SYNC}`);
        }
      } else {
        for (const c of seriesCategoriesApi) {
          const phaseStart = Date.now();
          const rows = await Xtream.getSeries(config, c.category_id);
          const seriesItems: SeriesItem[] = rows.map((s) => ({
            id: `${providerId}_series_${s.series_id}`,
            providerId,
            categoryId: s.category_id ? `${providerId}_series_${s.category_id}` : defaultSeriesCat,
            name: s.name,
            poster: s.cover,
          }));
          await executeBatchInChunks(seriesRepo.getInsertTuples(seriesItems), FAST_INSERT_BATCH_OPTIONS);
          totalSeries += seriesItems.length;
          if (totalSeries >= MAX_SERIES_PER_SYNC) {
            syncLog(providerId, 'series:cap-reached', `cap=${MAX_SERIES_PER_SYNC}`);
            break;
          }
          syncLog(
            providerId,
            'series:category-synced',
            `category=${c.category_id} items=${seriesItems.length} elapsedMs=${Date.now() - phaseStart}`,
          );

          if (!isLikelyCategoryFiltered(c.category_id, rows)) {
            syncLog(
              providerId,
              'series:category-filter-ignored',
              `category=${c.category_id} detected=true -> stopping per-category loop early`,
            );
            break;
          }
        }
      }

      syncLog(
        providerId,
        'done',
        `movies=${totalMovies} series=${totalSeries} totalMs=${Date.now() - start}`,
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Media sync failed: ${message}`);
    }
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

  async getMovies(
    providerId: string,
    categoryId?: string,
    limit?: number,
    offset?: number,
  ): Promise<Movie[]> {
    return movieRepo.byProvider(providerId, categoryId, limit ?? 120, offset ?? 0);
  },

  async searchMovies(
    providerId: string,
    query: string,
    limit?: number,
    offset?: number,
    categoryId?: string,
  ): Promise<Movie[]> {
    return movieRepo.search(providerId, query, limit ?? 120, offset ?? 0, categoryId);
  },

  async getMoviesByIds(ids: string[]): Promise<Movie[]> {
    return movieRepo.getMany(ids);
  },

  async getMovieDetails(movieId: string): Promise<{ description?: string }> {
    const [movie] = await movieRepo.getMany([movieId]);
    if (!movie) return {};
    const provider = await providerRepo.get(movie.providerId);
    if (!provider || provider.type !== 'xtream') return {};
    const creds = await getProviderCredentials(movie.providerId);
    if (!creds) return {};
    const match = movie.id.match(/_movie_(\d+)$/);
    const numericVodId = match ? Number(match[1]) : NaN;
    if (!Number.isFinite(numericVodId)) return {};
    const config: Xtream.XtreamConfig = {
      serverUrl: provider.url,
      username: creds.username,
      password: creds.password,
    };
    const info = await Xtream.getVodInfo(config, numericVodId);
    const description =
      (typeof info?.info?.plot === 'string' && info.info.plot.trim()) || undefined;
    return description ? { description } : {};
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

  async getSeries(
    providerId: string,
    categoryId?: string,
    limit?: number,
    offset?: number,
  ): Promise<SeriesItem[]> {
    return seriesRepo.byProvider(providerId, categoryId, limit ?? 120, offset ?? 0);
  },

  async searchSeries(
    providerId: string,
    query: string,
    limit?: number,
    offset?: number,
    categoryId?: string,
  ): Promise<SeriesItem[]> {
    return seriesRepo.search(providerId, query, limit ?? 120, offset ?? 0, categoryId);
  },

  async getSeriesByIds(ids: string[]): Promise<SeriesItem[]> {
    return seriesRepo.getMany(ids);
  },

  async getSeriesSeasonsAndEpisodes(seriesId: string): Promise<{
    seriesInfo?: { description?: string };
    seasons: Array<{
      seasonNumber: number;
      episodes: Array<{
        id: string;
        seasonNumber: number;
        episodeNumber: number;
        title: string;
        summary?: string;
        streamUrl?: string;
        imageUrl?: string;
      }>;
    }>;
  }> {
    const seriesRows = await seriesRepo.getMany([seriesId]);
    const series = seriesRows[0];
    if (!series) {
      return { seriesInfo: undefined, seasons: [] };
    }

    const provider = await providerRepo.get(series.providerId);
    if (!provider || provider.type !== 'xtream') {
      return { seriesInfo: undefined, seasons: [] };
    }
    const creds = await getProviderCredentials(series.providerId);
    if (!creds) return { seriesInfo: undefined, seasons: [] };

    const config: Xtream.XtreamConfig = {
      serverUrl: provider.url,
      username: creds.username,
      password: creds.password,
    };

    const numericIdMatch = series.id.match(/_series_(\d+)$/);
    const numericSeriesId = numericIdMatch ? Number(numericIdMatch[1]) : NaN;
    if (!Number.isFinite(numericSeriesId)) {
      return { seriesInfo: undefined, seasons: [] };
    }

    const info = await Xtream.getSeriesInfo(config, numericSeriesId);
    if (!info || !info.episodes) {
      return { seriesInfo: undefined, seasons: [] };
    }

    const seriesDescription =
      (typeof info.info?.plot === 'string' && info.info.plot.trim()) || undefined;

    const seasons: Array<{
      seasonNumber: number;
      episodes: Array<{
        id: string;
        seasonNumber: number;
        episodeNumber: number;
        title: string;
        summary?: string;
        streamUrl?: string;
        imageUrl?: string;
      }>;
    }> = [];

    for (const [seasonKey, eps] of Object.entries(info.episodes)) {
      const seasonNumber = Number(seasonKey);
      if (!Number.isFinite(seasonNumber)) continue;
      const mappedEpisodes = eps.map((ep) => {
        const ext = ep.container_extension ? ep.container_extension : 'ts';
        const base = provider.url.replace(/\/$/, '');
        const streamUrl = `${base}/series/${encodeURIComponent(creds.username)}/${encodeURIComponent(
          creds.password,
        )}/${ep.id}.${ext}`;
        const imageUrl =
          (typeof (ep.info?.movie_image ?? ep.movie_image) === 'string' &&
            (ep.info?.movie_image ?? ep.movie_image)?.trim()) ||
          undefined;
        console.info(
          '[seriesEpisodeUrl]',
          JSON.stringify({
            seriesId,
            seasonNumber,
            episodeNum: ep.episode_num,
            ext,
            streamUrl,
          }),
        );
        return {
          id: `${seriesId}_s${seasonNumber}_e${ep.episode_num}`,
          seasonNumber,
          episodeNumber: ep.episode_num,
          title: ep.title || `Episode ${ep.episode_num}`,
          summary: ep.info?.plot,
          streamUrl,
          imageUrl: imageUrl || undefined,
        };
      });
      seasons.push({
        seasonNumber,
        episodes: mappedEpisodes,
      });
    }

    seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
    seasons.forEach((s) =>
      s.episodes.sort((a, b) => a.episodeNumber - b.episodeNumber),
    );

    return {
      seriesInfo: seriesDescription ? { description: seriesDescription } : undefined,
      seasons,
    };
  },
};
