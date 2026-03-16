import * as Xtream from '../api/xtream/client';
import { parseM3u } from '../api/m3u/parser';
import { getProviderCredentials } from '../lib/keychain';
import { getDb } from '../db/index';
import { providerRepo } from '../db/repositories/providerRepo';
import { categoryRepo } from '../db/repositories/categoryRepo';
import { channelRepo } from '../db/repositories/channelRepo';
import type { Category, Channel } from '../lib/types';

type SQLBatchTuple = [string] | [string, unknown[]];

function runSyncBatch(providerId: string, categories: Category[], channels: Channel[]): Promise<void> {
  const batch: SQLBatchTuple[] = [
    ['DELETE FROM channels WHERE provider_id = ?', [providerId]],
    ['DELETE FROM categories WHERE provider_id = ?', [providerId]],
    ...categoryRepo.getInsertTuples(categories),
    ...channelRepo.getInsertTuples(channels),
  ];
  return getDb().executeBatchAsync(batch).then((r) => {
    const res = r as { status?: number; message?: string };
    if (res.status === 1) throw new Error(res.message ?? 'Batch sync failed');
  });
}

export const liveService = {
  async syncProvider(providerId: string): Promise<void> {
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
      const [apiCategories, apiStreams] = await Promise.all([
        Xtream.getLiveCategories(config),
        Xtream.getLiveStreams(config),
      ]);

      const defaultCatId = `${providerId}_default`;
      const categories: Category[] = [
        { id: defaultCatId, providerId, name: 'General' },
        ...apiCategories.map((c) => ({
          id: `${providerId}_${c.category_id}`,
          providerId,
          name: c.category_name,
        })),
      ];
      const channels: Channel[] = apiStreams.map((s) => {
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
      });
      await runSyncBatch(providerId, categories, channels);
      return;
    }

    if (provider.type === 'm3u') {
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
      const categories: Category[] = [{ id: defaultCatId, providerId, name: 'General' }];
      const channels: Channel[] = [];
      let idx = 0;
      for (const ch of parsed) {
        const group = ch.groupTitle ?? '';
        if (!groupToId.has(group)) {
          // Use a short hash over the original group title to avoid ID collisions
          const normalized = group || 'general';
          let hash = 0;
          for (let i = 0; i < normalized.length; i++) {
            hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
          }
          const id = `${providerId}_cat_${hash.toString(16)}`;
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
      await runSyncBatch(providerId, categories, channels);
    }
  },

  async getCategories(providerId: string): Promise<Category[]> {
    return categoryRepo.byProvider(providerId);
  },

  async getChannels(providerId: string, categoryId?: string, limit?: number): Promise<Channel[]> {
    return channelRepo.byProvider(providerId, categoryId, limit);
  },
};
