import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { providerService } from '../services/providerService';
import { liveService } from '../services/liveService';
import type { Provider } from '../lib/types';

export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const list = await providerService.list();
    setProviders(list);
  }, []);

  const sync = useCallback(async (providerId: string) => {
    setSyncingId(providerId);
    try {
      await liveService.syncProvider(providerId);
      await refresh();
    } catch (e) {
      Alert.alert('Sync failed', String(e));
    } finally {
      setSyncingId(null);
    }
  }, [refresh]);

  const remove = useCallback((p: Provider) => {
    Alert.alert(
      'Remove provider',
      `Remove "${p.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await providerService.remove(p.id);
            await refresh();
          },
        },
      ]
    );
  }, [refresh]);

  return { providers, refresh, syncingId, sync, remove };
}
