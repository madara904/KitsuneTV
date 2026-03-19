import * as Xtream from '../api/xtream/client';
import type { XtreamLiveStream } from '../api/xtream/types';
import { parseM3u } from '../api/m3u/parser';
import { getProviderCredentials } from '../lib/keychain';
import { providerRepo } from '../db/repositories/providerRepo';
import { categoryRepo } from '../db/repositories/categoryRepo';
import { channelRepo } from '../db/repositories/channelRepo';
import { settingsRepo } from '../db/repositories/settingsRepo';
import type { Category, Channel } from '../lib/types';
import { executeBatchInChunks, type SQLBatchTuple } from '../db/batch';

const FAST_INSERT_BATCH_OPTIONS = { chunkSize: 450, yieldEveryChunks: 10 } as const;
const DELTA_SYNC_KEY_PREFIX = 'delta_sync_initialized_live_';

function syncLog(providerId: string, stage: string, details?: string): void {
  const suffix = details ? ` ${details}` : '';
  console.info(`[SYNC][live][${providerId}] ${stage}${suffix}`);
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
  // If most rows belong to other categories, endpoint likely ignored category_id.
  return mismatch / withCategory < 0.35;
}

function toLiveChannel(
  providerId: string,
  config: Xtream.XtreamConfig,
  defaultCatId: string,
  s: XtreamLiveStream,
): Channel {
  const categoryId = s.category_id ? `${providerId}_${s.category_id}` : defaultCatId;
  let streamType: Channel['streamType'] = 'ts';
  if (s.stream_type?.toLowerCase().includes('hls')) streamType = 'hls';
  return {
    id: `${providerId}_${s.stream_id}`,
    providerId,
    categoryId,
    name: s.name,
    logo: s.stream_icon,
    streamUrl: Xtream.buildStreamUrl(config, s.stream_id),
    streamType,
    epgChannelId: s.epg_channel_id,
  };
}

export const liveService = {
  async syncProvider(providerId: string): Promise<void> {
    const start = Date.now();
    try {
      const provider = await providerRepo.get(providerId);
      if (!provider) throw new Error('Provider not found');

      if (provider.type === 'xtream') {
        const creds = await getProviderCredentials(providerId);
        if (!creds) throw new Error('Xtream credentials not found');
        const config: Xtream.XtreamConfig = {
          serverUrl: provider.url,
          username: creds.username,
          password: creds.password,
        };

        syncLog(providerId, 'xtream:start');
        const apiCategories = await Xtream.getLiveCategories(config);
        syncLog(providerId, 'xtream:categories-loaded', `count=${apiCategories.length}`);

        const defaultCatId = `${providerId}_default`;
        const categories: Category[] = [
          { id: defaultCatId, providerId, name: 'General' },
          ...apiCategories.map((c) => ({
            id: `${providerId}_${c.category_id}`,
            providerId,
            name: c.category_name,
          })),
        ];

        const deltaKey = `${DELTA_SYNC_KEY_PREFIX}${providerId}`;
        const initialized = (await settingsRepo.get(deltaKey)) === '1';
        const bootstrapBatch: SQLBatchTuple[] = [
          ...(initialized
            ? []
            : [
                ['DELETE FROM channels WHERE provider_id = ?', [providerId]] as SQLBatchTuple,
                ['DELETE FROM categories WHERE provider_id = ?', [providerId]] as SQLBatchTuple,
              ]),
          ...categoryRepo.getInsertTuples(categories),
        ];
        await executeBatchInChunks(bootstrapBatch);
        if (!initialized) await settingsRepo.set(deltaKey, '1');

        let totalChannels = 0;
        for (const c of apiCategories) {
          const categoryStart = Date.now();
          const streams = await Xtream.getLiveStreams(config, c.category_id);
          const channels = streams.map((s) => toLiveChannel(providerId, config, defaultCatId, s));
          await executeBatchInChunks(channelRepo.getInsertTuples(channels), FAST_INSERT_BATCH_OPTIONS);
          totalChannels += channels.length;
          syncLog(
            providerId,
            'xtream:category-synced',
            `category=${c.category_id} channels=${channels.length} elapsedMs=${Date.now() - categoryStart}`,
          );

          if (!isLikelyCategoryFiltered(c.category_id, streams)) {
            syncLog(
              providerId,
              'xtream:category-filter-ignored',
              `category=${c.category_id} detected=true -> stopping per-category loop early`,
            );
            break;
          }
        }

        syncLog(
          providerId,
          'xtream:done',
          `categories=${categories.length} channels=${totalChannels} totalMs=${Date.now() - start}`,
        );
        return;
      }

      if (provider.type === 'm3u') {
        syncLog(providerId, 'm3u:start');
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 25000);
        let res: Response;
        try {
          res = await fetch(provider.url, { signal: controller.signal });
        } catch (e: unknown) {
          clearTimeout(t);
          if (e instanceof Error && e.name === 'AbortError') {
            throw new Error('Network timeout. Check internet (e.g. emulator WiFi).');
          }
          throw e;
        }
        clearTimeout(t);
        if (!res.ok) throw new Error(`M3U fetch: ${res.status}`);
        const text = await res.text();
        const parsed = parseM3u(text);
        const defaultCatId = `${providerId}_default`;
        const groupToId = new Map<string, string>();
        groupToId.set('', defaultCatId);
        const usedCategoryIds = new Set<string>([defaultCatId]);
        const categories: Category[] = [{ id: defaultCatId, providerId, name: 'General' }];
        const channels: Channel[] = [];
        let idx = 0;
        for (const ch of parsed) {
          const group = ch.groupTitle ?? '';
          if (!groupToId.has(group)) {
            const normalized = group || 'general';
            let hash = 0;
            for (let i = 0; i < normalized.length; i++) {
              hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
            }
            let id = `${providerId}_cat_${hash.toString(16)}`;
            let suffix = 1;
            while (usedCategoryIds.has(id)) {
              id = `${providerId}_cat_${hash.toString(16)}_${suffix}`;
              suffix++;
            }
            usedCategoryIds.add(id);
            groupToId.set(group, id);
            categories.push({ id, providerId, name: group || 'General' });
          }
          const categoryId = groupToId.get(group)!;
          let streamType: Channel['streamType'] = 'unknown';
          if (ch.streamUrl.includes('.m3u8')) streamType = 'hls';
          else if (ch.streamUrl.includes('.ts')) streamType = 'ts';
          channels.push({
            id: `${providerId}_m3u_${idx}`,
            providerId,
            categoryId,
            name: ch.name,
            logo: ch.tvgLogo,
            streamUrl: ch.streamUrl,
            streamType,
            epgChannelId: ch.tvgId,
          });
          idx++;
        }

        const deltaKey = `${DELTA_SYNC_KEY_PREFIX}${providerId}`;
        const initialized = (await settingsRepo.get(deltaKey)) === '1';
        const batch: SQLBatchTuple[] = [
          ...(initialized
            ? []
            : [
                ['DELETE FROM channels WHERE provider_id = ?', [providerId]] as SQLBatchTuple,
                ['DELETE FROM categories WHERE provider_id = ?', [providerId]] as SQLBatchTuple,
              ]),
          ...categoryRepo.getInsertTuples(categories),
          ...channelRepo.getInsertTuples(channels),
        ];
        await executeBatchInChunks(batch);
        if (!initialized) await settingsRepo.set(deltaKey, '1');
        syncLog(
          providerId,
          'm3u:done',
          `categories=${categories.length} channels=${channels.length} totalMs=${Date.now() - start}`,
        );
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Live sync failed: ${message}`);
    }
  },

  async getCategories(providerId: string): Promise<Category[]> {
    return categoryRepo.byProvider(providerId);
  },

  async getChannels(providerId: string, categoryId?: string, limit?: number): Promise<Channel[]> {
    return channelRepo.byProvider(providerId, categoryId, limit);
  },
};
