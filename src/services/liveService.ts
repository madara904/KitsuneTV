import * as Xtream from '../api/xtream/client';
import { parseM3u } from '../api/m3u/parser';
import { getProviderCredentials } from '../lib/keychain';
import { providerRepo } from '../db/repositories/providerRepo';
import { categoryRepo } from '../db/repositories/categoryRepo';
import { channelRepo } from '../db/repositories/channelRepo';
import type { Category, Channel } from '../lib/types';

export const liveService = {
  async syncProvider(providerId: string): Promise<void> {
    const provider = await providerRepo.get(providerId);
    if (!provider) throw new Error('Provider not found');

    await channelRepo.deleteByProvider(providerId);
    await categoryRepo.deleteByProvider(providerId);

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
      await categoryRepo.insert({ id: defaultCatId, providerId, name: 'General' });
      for (const c of apiCategories) {
        const catId = `${providerId}_${c.category_id}`;
        await categoryRepo.insert({
          id: catId,
          providerId,
          name: c.category_name,
        });
      }

      for (const s of apiStreams) {
        const channelId = `${providerId}_${s.stream_id}`;
        const categoryId = s.category_id ? `${providerId}_${s.category_id}` : defaultCatId;
        const streamUrl = Xtream.buildStreamUrl(config, s.stream_id);
        let streamType: Channel['streamType'] = 'ts';
        if (s.stream_type?.toLowerCase().includes('hls')) streamType = 'hls';
        await channelRepo.insert({
          id: channelId,
          providerId,
          categoryId,
          name: s.name,
          logo: s.stream_icon,
          streamUrl,
          streamType,
          epgChannelId: s.epg_channel_id,
        });
      }
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
      const channels = parseM3u(text);
      const defaultCatId = `${providerId}_default`;
      await categoryRepo.insert({
        id: defaultCatId,
        providerId,
        name: 'General',
      });
      const groupToId = new Map<string, string>();
      groupToId.set('', defaultCatId);
      let idx = 0;
      for (const ch of channels) {
        const group = ch.groupTitle ?? '';
        if (!groupToId.has(group)) {
          const id = `${providerId}_cat_${group.replace(/\s+/g, '_').slice(0, 30)}`;
          groupToId.set(group, id);
          await categoryRepo.insert({
            id,
            providerId,
            name: group || 'General',
          });
        }
        const categoryId = groupToId.get(group)!;
        const channelId = `${providerId}_m3u_${idx}`;
        idx++;
        let streamType: Channel['streamType'] = 'unknown';
        if (ch.streamUrl.includes('.m3u8')) streamType = 'hls';
        else if (ch.streamUrl.includes('.ts')) streamType = 'ts';
        await channelRepo.insert({
          id: channelId,
          providerId,
          categoryId,
          name: ch.name,
          logo: ch.tvgLogo,
          streamUrl: ch.streamUrl,
          streamType,
          epgChannelId: ch.tvgId,
        });
      }
    }
  },

  async getCategories(providerId: string): Promise<Category[]> {
    return categoryRepo.byProvider(providerId);
  },

  async getChannels(providerId: string, categoryId?: string, limit?: number): Promise<Channel[]> {
    return channelRepo.byProvider(providerId, categoryId, limit);
  },
};
