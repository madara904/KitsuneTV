import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { providerService } from '../services/providerService';
import { liveService } from '../services/liveService';
import type { Provider } from '../lib/types';

type ProviderType = 'xtream' | 'm3u';

export function SettingsScreen() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'xtream' as ProviderType,
    url: '',
    username: '',
    password: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await providerService.list();
    setProviders(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleAdd = useCallback(async () => {
    if (!form.name.trim() || !form.url.trim()) {
      setError('Name and URL are required.');
      return;
    }
    if (form.type === 'xtream' && (!form.username.trim() || !form.password.trim())) {
      setError('Username and password are required for Xtream.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await providerService.add({
        name: form.name.trim(),
        type: form.type,
        url: form.url.trim(),
        username: form.type === 'xtream' ? form.username.trim() : undefined,
        password: form.type === 'xtream' ? form.password.trim() : undefined,
      });
      setAddModalVisible(false);
      setForm({ name: '', type: 'xtream', url: '', username: '', password: '' });
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [form, load]);

  const handleSync = useCallback(async (providerId: string) => {
    setSyncingId(providerId);
    try {
      await liveService.syncProvider(providerId);
      await load();
    } catch (e) {
      Alert.alert('Sync failed', String(e));
    } finally {
      setSyncingId(null);
    }
  }, [load]);

  const pasteInto = useCallback((field: keyof typeof form) => {
    try {
      const Clipboard = require('@react-native-clipboard/clipboard').default;
      Clipboard.getString().then((text: string) => {
        if (text) setForm((f) => ({ ...f, [field]: text }));
      }).catch(() => {
        Alert.alert('Einfügen', 'Clipboard nicht verfügbar. App neu bauen (npm run android).');
      });
    } catch {
      Alert.alert('Einfügen', 'Clipboard-Modul nicht geladen. App neu bauen (npm run android).');
    }
  }, []);

  const handleRemove = useCallback(
    (p: Provider) => {
      Alert.alert('Remove provider', `Remove "${p.name}"? This will delete its categories and channels.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await providerService.remove(p.id);
            await load();
          },
        },
      ]);
    },
    [load]
  );

  return (
    <View className="flex-1" style={{ backgroundColor: '#0e0e12' }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <Text className="text-white text-xl font-semibold mb-4">Providers</Text>
        <Pressable
          onPress={() => setAddModalVisible(true)}
          onFocus={() => setFocusedKey('add-provider')}
          onBlur={() => setFocusedKey(null)}
          className="flex-row items-center gap-2 py-3 px-4 rounded-xl bg-primary-500 mb-6"
          style={{
            borderWidth: focusedKey === 'add-provider' ? 3 : 0,
            borderColor: '#d8b4fe',
          }}
          focusable
        >
          <MaterialCommunityIcons name="plus" size={24} color="#fff" />
          <Text className="text-white font-medium">Add provider</Text>
        </Pressable>

        {providers.length === 0 ? (
          <Text className="text-zinc-400">No providers. Add an Xtream or M3U URL above.</Text>
        ) : (
          providers.map((p) => (
            <View
              key={p.id}
              className="flex-row items-center justify-between py-4 px-4 rounded-xl border border-surface-700 mb-2"
            >
              <View className="flex-1">
                <Text className="text-white font-medium">{p.name}</Text>
                <Text className="text-zinc-400 text-sm">{p.type === 'xtream' ? 'Xtream' : 'M3U'}</Text>
                <Text className="text-zinc-500 text-xs mt-1" numberOfLines={1}>
                  {p.url}
                </Text>
              </View>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => handleSync(p.id)}
                  onFocus={() => setFocusedKey(`sync-${p.id}`)}
                  onBlur={() => setFocusedKey(null)}
                  disabled={syncingId === p.id}
                  className="w-10 h-10 rounded-lg bg-surface-700 items-center justify-center"
                  style={{
                    borderWidth: focusedKey === `sync-${p.id}` ? 3 : 0,
                    borderColor: '#d8b4fe',
                  }}
                  focusable
                >
                  {syncingId === p.id ? (
                    <ActivityIndicator size="small" color="#8b5cf6" />
                  ) : (
                    <MaterialCommunityIcons name="sync" size={22} color="#d8b4fe" />
                  )}
                </Pressable>
                <Pressable
                  onPress={() => handleRemove(p)}
                  onFocus={() => setFocusedKey(`remove-${p.id}`)}
                  onBlur={() => setFocusedKey(null)}
                  className="w-10 h-10 rounded-lg bg-red-500/20 items-center justify-center"
                  style={{
                    borderWidth: focusedKey === `remove-${p.id}` ? 3 : 0,
                    borderColor: '#f87171',
                  }}
                  focusable
                >
                  <MaterialCommunityIcons name="delete-outline" size={22} color="#f87171" />
                </Pressable>
              </View>
            </View>
          ))
        )}

        <Text className="text-white text-lg font-semibold mt-8 mb-2">Playback</Text>
        <Text className="text-zinc-400">Buffer and retry settings can be added here (saved in Settings table).</Text>
      </ScrollView>

      <Modal visible={addModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }}
        >
          <View className="mx-6 rounded-2xl p-6" style={{ backgroundColor: '#14141a' }}>
            <Text className="text-white text-xl font-semibold mb-4">Add provider</Text>
            {error ? (
              <View className="mb-4 p-3 rounded-lg bg-red-500/20">
                <Text className="text-red-400">{error}</Text>
              </View>
            ) : null}
            <View className="flex-row gap-2 mb-3 items-center">
              <TextInput
                className="flex-1 h-12 px-4 rounded-lg text-white"
                placeholder="Name"
                placeholderTextColor="#6e6e7d"
                value={form.name}
                onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
                onFocus={() => setFocusedKey('form-name')}
                onBlur={() => setFocusedKey(null)}
                style={{
                  borderWidth: focusedKey === 'form-name' ? 3 : 1,
                  borderColor: focusedKey === 'form-name' ? '#d8b4fe' : '#3f3f46',
                }}
              />
              <Pressable
                onPress={() => pasteInto('name')}
                onFocus={() => setFocusedKey('paste-name')}
                onBlur={() => setFocusedKey(null)}
                className="h-12 px-4 rounded-lg bg-surface-700 justify-center"
                style={{
                  borderWidth: focusedKey === 'paste-name' ? 3 : 0,
                  borderColor: '#d8b4fe',
                }}
                focusable
              >
                <Text className="text-zinc-300">Einfügen</Text>
              </Pressable>
            </View>
            <View className="flex-row gap-2 mb-3">
              <Pressable
                onPress={() => setForm((f) => ({ ...f, type: 'xtream' }))}
                onFocus={() => setFocusedKey('type-xtream')}
                onBlur={() => setFocusedKey(null)}
                className="flex-1 py-3 rounded-lg border items-center"
                style={{
                  borderColor: focusedKey === 'type-xtream' ? '#d8b4fe' : form.type === 'xtream' ? '#8b5cf6' : '#3f3f46',
                  borderWidth: focusedKey === 'type-xtream' ? 3 : 1,
                  backgroundColor: form.type === 'xtream' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                }}
                focusable
              >
                <Text className="text-white">Xtream</Text>
              </Pressable>
              <Pressable
                onPress={() => setForm((f) => ({ ...f, type: 'm3u' }))}
                onFocus={() => setFocusedKey('type-m3u')}
                onBlur={() => setFocusedKey(null)}
                className="flex-1 py-3 rounded-lg border items-center"
                style={{
                  borderColor: focusedKey === 'type-m3u' ? '#d8b4fe' : form.type === 'm3u' ? '#8b5cf6' : '#3f3f46',
                  borderWidth: focusedKey === 'type-m3u' ? 3 : 1,
                  backgroundColor: form.type === 'm3u' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                }}
                focusable
              >
                <Text className="text-white">M3U URL</Text>
              </Pressable>
            </View>
            <View className="flex-row gap-2 mb-3 items-center">
              <TextInput
                className="flex-1 h-12 px-4 rounded-lg text-white"
                placeholder={form.type === 'xtream' ? 'Server URL (e.g. http://example.com)' : 'M3U URL'}
                placeholderTextColor="#6e6e7d"
                value={form.url}
                onChangeText={(t) => setForm((f) => ({ ...f, url: t }))}
                onFocus={() => setFocusedKey('form-url')}
                onBlur={() => setFocusedKey(null)}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  borderWidth: focusedKey === 'form-url' ? 3 : 1,
                  borderColor: focusedKey === 'form-url' ? '#d8b4fe' : '#3f3f46',
                }}
              />
              <Pressable
                onPress={() => pasteInto('url')}
                onFocus={() => setFocusedKey('paste-url')}
                onBlur={() => setFocusedKey(null)}
                className="h-12 px-4 rounded-lg bg-surface-700 justify-center"
                style={{
                  borderWidth: focusedKey === 'paste-url' ? 3 : 0,
                  borderColor: '#d8b4fe',
                }}
                focusable
              >
                <Text className="text-zinc-300">Einfügen</Text>
              </Pressable>
            </View>
            {form.type === 'xtream' && (
              <>
                <View className="flex-row gap-2 mb-3 items-center">
                  <TextInput
                    className="flex-1 h-12 px-4 rounded-lg text-white"
                    placeholder="Username"
                    placeholderTextColor="#6e6e7d"
                    value={form.username}
                    onChangeText={(t) => setForm((f) => ({ ...f, username: t }))}
                    onFocus={() => setFocusedKey('form-username')}
                    onBlur={() => setFocusedKey(null)}
                    autoCapitalize="none"
                    style={{
                      borderWidth: focusedKey === 'form-username' ? 3 : 1,
                      borderColor: focusedKey === 'form-username' ? '#d8b4fe' : '#3f3f46',
                    }}
                  />
                  <Pressable
                    onPress={() => pasteInto('username')}
                    onFocus={() => setFocusedKey('paste-username')}
                    onBlur={() => setFocusedKey(null)}
                    className="h-12 px-4 rounded-lg bg-surface-700 justify-center"
                    style={{
                      borderWidth: focusedKey === 'paste-username' ? 3 : 0,
                      borderColor: '#d8b4fe',
                    }}
                    focusable
                  >
                    <Text className="text-zinc-300">Einfügen</Text>
                  </Pressable>
                </View>
                <View className="flex-row gap-2 mb-4 items-center">
                  <TextInput
                    className="flex-1 h-12 px-4 rounded-lg text-white"
                    placeholder="Password"
                    placeholderTextColor="#6e6e7d"
                    value={form.password}
                    onChangeText={(t) => setForm((f) => ({ ...f, password: t }))}
                    onFocus={() => setFocusedKey('form-password')}
                    onBlur={() => setFocusedKey(null)}
                    secureTextEntry
                    style={{
                      borderWidth: focusedKey === 'form-password' ? 3 : 1,
                      borderColor: focusedKey === 'form-password' ? '#d8b4fe' : '#3f3f46',
                    }}
                  />
                  <Pressable
                    onPress={() => pasteInto('password')}
                    onFocus={() => setFocusedKey('paste-password')}
                    onBlur={() => setFocusedKey(null)}
                    className="h-12 px-4 rounded-lg bg-surface-700 justify-center"
                    style={{
                      borderWidth: focusedKey === 'paste-password' ? 3 : 0,
                      borderColor: '#d8b4fe',
                    }}
                    focusable
                  >
                    <Text className="text-zinc-300">Einfügen</Text>
                  </Pressable>
                </View>
              </>
            )}
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setAddModalVisible(false);
                  setError(null);
                  setForm({ name: '', type: 'xtream', url: '', username: '', password: '' });
                }}
                onFocus={() => setFocusedKey('modal-cancel')}
                onBlur={() => setFocusedKey(null)}
                className="flex-1 py-3 rounded-xl bg-surface-700 items-center"
                style={{
                  borderWidth: focusedKey === 'modal-cancel' ? 3 : 0,
                  borderColor: '#d8b4fe',
                }}
                focusable
              >
                <Text className="text-white">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleAdd}
                onFocus={() => setFocusedKey('modal-add')}
                onBlur={() => setFocusedKey(null)}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-primary-500 items-center"
                style={{
                  borderWidth: focusedKey === 'modal-add' ? 3 : 0,
                  borderColor: '#d8b4fe',
                }}
                focusable
              >
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white font-medium">Add</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
