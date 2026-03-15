import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useProviders } from '../hooks/useProviders';
import { ProviderListItem } from '../components/settings/ProviderListItem';
import { AddEditProviderModal } from '../components/settings/AddEditProviderModal';
import type { Provider } from '../lib/types';

export function SettingsScreen() {
  const { providers, refresh, syncingId, sync, remove } = useProviders();
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const openAdd = useCallback(() => {
    setEditingProvider(null);
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((p: Provider) => {
    setEditingProvider(p);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingProvider(null);
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: '#0e0e12' }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text className="text-white text-xl font-semibold mb-4">Providers</Text>

        <Pressable
          onPress={openAdd}
          onFocus={() => setFocusedKey('add-provider')}
          onBlur={() => setFocusedKey(null)}
          focusable
          className="flex-row items-center gap-2 py-3 px-4 rounded-xl bg-primary-500 mb-6"
          style={{
            borderWidth: focusedKey === 'add-provider' ? 3 : 0,
            borderColor: '#d8b4fe',
          }}
        >
          <MaterialCommunityIcons name="plus" size={24} color="#fff" />
          <Text className="text-white font-medium">Add provider</Text>
        </Pressable>

        {providers.map((p) => (
          <ProviderListItem
            key={p.id}
            provider={p}
            isSyncing={syncingId === p.id}
            focusedKey={focusedKey}
            onEdit={() => openEdit(p)}
            onSync={() => sync(p.id)}
            onRemove={() => remove(p)}
            onFocus={setFocusedKey}
            onBlur={() => setFocusedKey(null)}
          />
        ))}
      </ScrollView>

      <AddEditProviderModal
        visible={modalVisible}
        editingProvider={editingProvider}
        onClose={closeModal}
        onSaved={refresh}
      />
    </View>
  );
}
