import { providerRepo } from '../db/repositories/providerRepo';
import { categoryRepo } from '../db/repositories/categoryRepo';
import { channelRepo } from '../db/repositories/channelRepo';
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

  async update(
    providerId: string,
    data: { name: string; type: 'xtream' | 'm3u'; url: string; username?: string; password?: string }
  ): Promise<void> {
    const existing = await providerRepo.get(providerId);
    if (!existing) throw new Error('Provider not found');
    const updated: Provider = {
      ...existing,
      name: data.name.trim(),
      type: data.type,
      url: data.url.trim(),
      updatedAt: Date.now(),
    };
    await providerRepo.update(updated);
    if (data.type === 'xtream' && data.username != null && data.password != null) {
      await setProviderCredentials(providerId, data.username, data.password);
    }
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
