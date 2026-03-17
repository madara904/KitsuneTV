import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { providerService } from '../services/providerService';
import { liveService } from '../services/liveService';
import { mediaService } from '../services/mediaService';
import type { Provider } from '../lib/types';

export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const syncInProgressRef = useRef(false);

  const refresh = useCallback(async () => {
    const list = await providerService.list();
    setProviders(list);
  }, []);

  const sync = useCallback(async (providerId: string) => {
    if (syncInProgressRef.current) return;
    syncInProgressRef.current = true;
    setSyncingId(providerId);
    try {
      await liveService.syncProvider(providerId);
      await mediaService.syncProvider(providerId);
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      Alert.alert('Sync failed', message);
    } finally {
      syncInProgressRef.current = false;
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
            try {
              await providerService.remove(p.id);
              await refresh();
            } catch (e) {
              Alert.alert('Remove failed', String(e));
            }
          },
        },
      ]
    );
  }, [refresh]);

  return { providers, refresh, syncingId, sync, remove };
}
