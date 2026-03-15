import { providerRepo } from '../db/repositories/providerRepo';
import { categoryRepo } from '../db/repositories/categoryRepo';
import { channelRepo } from '../db/repositories/channelRepo';
import { favoriteRepo } from '../db/repositories/favoriteRepo';
import { recentRepo } from '../db/repositories/recentRepo';
import { setProviderCredentials, deleteProviderCredentials, getProviderCredentials } from '../lib/keychain';
import type { Provider } from '../lib/types';

export const providerService = {
  async list(): Promise<Provider[]> {
    return providerRepo.all();
  },

  async add(provider: {
    name: string;
    type: 'xtream' | 'm3u';
    url: string;
    username?: string;
    password?: string;
  }): Promise<Provider> {
    const id = `prov_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const now = Date.now();
    const p: Provider = {
      id,
      name: provider.name,
      type: provider.type,
      url: provider.url.trim(),
      createdAt: now,
      updatedAt: now,
    };
    await providerRepo.insert(p);
    if (provider.type === 'xtream' && provider.username != null && provider.password != null) {
      await setProviderCredentials(id, provider.username, provider.password);
    }
    return p;
  },

  async remove(providerId: string): Promise<void> {
    await categoryRepo.deleteByProvider(providerId);
    await channelRepo.deleteByProvider(providerId);
    await providerRepo.delete(providerId);
    await deleteProviderCredentials(providerId);
  },

  async getCredentials(providerId: string): Promise<{ username: string; password: string } | null> {
    return getProviderCredentials(providerId);
  },
};
