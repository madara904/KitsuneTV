import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { providerService } from '../../services/providerService';
import type { Provider } from '../../lib/types';

/** Set to false to hide paste buttons in Add/Edit provider form. */
const SHOW_PASTE_BUTTONS = true;

type FormState = {
  name: string;
  type: 'xtream' | 'm3u';
  url: string;
  username: string;
  password: string;
};

const initialForm: FormState = {
  name: '',
  type: 'xtream',
  url: '',
  username: '',
  password: '',
};

type Props = {
  visible: boolean;
  editingProvider: Provider | null;
  onClose: () => void;
  onSaved: () => void;
};

function FormFieldRow({
  field,
  value,
  onChange,
  placeholder,
  inputRef,
  returnKeyType,
  blurOnSubmit,
  onSubmitEditing,
  focusedKey,
  onFocusKey,
  onBlurKey,
  onPaste,
  secureTextEntry,
  autoCapitalize,
}: {
  field: keyof FormState;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inputRef: React.RefObject<TextInput | null>;
  returnKeyType: 'next' | 'done';
  blurOnSubmit: boolean;
  onSubmitEditing: () => void;
  focusedKey: string | null;
  onFocusKey: (k: string) => void;
  onBlurKey: () => void;
  onPaste: () => void;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
}) {
  const focusKey = `form-${field}`;
  const pasteKey = `paste-${field}`;
  return (
    <View className="flex-row gap-2 mb-3 items-center">
      <TextInput
        ref={inputRef}
        placeholder={placeholder}
        placeholderTextColor="#6e6e7d"
        value={value}
        onChangeText={onChange}
        returnKeyType={returnKeyType}
        blurOnSubmit={blurOnSubmit}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => onFocusKey(focusKey)}
        onBlur={onBlurKey}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={{
          flex: 1,
          height: 48,
          paddingHorizontal: 16,
          borderRadius: 8,
          color: '#fff',
          borderWidth: focusedKey === focusKey ? 3 : 1,
          borderColor: focusedKey === focusKey ? '#d8b4fe' : '#3f3f46',
        }}
      />
      {SHOW_PASTE_BUTTONS && (
        <Pressable
          onPress={onPaste}
          onFocus={() => onFocusKey(pasteKey)}
          onBlur={onBlurKey}
          focusable
          className="h-12 px-4 rounded-lg bg-surface-700 justify-center"
          style={{
            borderWidth: focusedKey === pasteKey ? 3 : 0,
            borderColor: '#d8b4fe',
          }}
        >
          <Text className="text-zinc-300">Einfügen</Text>
        </Pressable>
      )}
    </View>
  );
}

export function AddEditProviderModal({ visible, editingProvider, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameRef = useRef<TextInput>(null);
  const urlRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible || !editingProvider) {
      if (!visible) setForm(initialForm);
      return;
    }
    setForm({
      name: editingProvider.name,
      type: editingProvider.type,
      url: editingProvider.url,
      username: '',
      password: '',
    });
    if (editingProvider.type === 'xtream') {
      providerService.getCredentials(editingProvider.id).then((creds) => {
        if (creds) setForm((f) => ({ ...f, username: creds.username, password: creds.password }));
      });
    }
  }, [visible, editingProvider]);

  const pasteInto = useCallback(async (field: keyof FormState) => {
    try {
      const Clipboard = require('@react-native-clipboard/clipboard').default;
      const text = await Clipboard.getString();
      if (text != null) setForm((f) => ({ ...f, [field]: text }));
    } catch {
      setError('Clipboard nicht verfügbar.');
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim() || !form.url.trim()) {
      setError('Name and URL are required.');
      return;
    }
    if (form.type === 'xtream' && (!form.username.trim() || !form.password.trim())) {
      setError('Username and password are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = {
        name: form.name.trim(),
        type: form.type,
        url: form.url.trim(),
        username: form.type === 'xtream' ? form.username.trim() : undefined,
        password: form.type === 'xtream' ? form.password.trim() : undefined,
      };
      if (editingProvider) {
        await providerService.update(editingProvider.id, data);
      } else {
        await providerService.add(data);
      }
      onClose();
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [form, editingProvider, onClose, onSaved]);

  const close = useCallback(() => {
    setForm(initialForm);
    setError(null);
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-start', paddingTop: 80 }}
      >
        <View style={{ flex: 1, maxHeight: '85%' }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            style={{ flex: 1 }}
          >
            <View className="mx-6 rounded-2xl p-6" style={{ backgroundColor: '#14141a' }}>
              <Text className="text-white text-xl font-semibold mb-4">
                {editingProvider ? 'Edit provider' : 'Add provider'}
              </Text>

              {error && (
                <View className="mb-4 p-3 rounded-lg bg-red-500/20">
                  <Text className="text-red-400">{error}</Text>
                </View>
              )}

              <FormFieldRow
                field="name"
                value={form.name}
                onChange={(t) => setForm((f) => ({ ...f, name: t }))}
                placeholder="Name"
                inputRef={nameRef}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => urlRef.current?.focus()}
                focusedKey={focusedKey}
                onFocusKey={setFocusedKey}
                onBlurKey={() => setFocusedKey(null)}
                onPaste={() => pasteInto('name')}
              />

              <View className="flex-row gap-2 mb-3">
                <Pressable
                  onPress={() => setForm((f) => ({ ...f, type: 'xtream' }))}
                  onFocus={() => setFocusedKey('type-xtream')}
                  onBlur={() => setFocusedKey(null)}
                  focusable
                  className="flex-1 py-3 rounded-lg border items-center"
                  style={{
                    borderColor: focusedKey === 'type-xtream' ? '#d8b4fe' : form.type === 'xtream' ? '#8b5cf6' : '#3f3f46',
                    borderWidth: focusedKey === 'type-xtream' ? 3 : 1,
                    backgroundColor: form.type === 'xtream' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                  }}
                >
                  <Text className="text-white">Xtream</Text>
                </Pressable>
                <Pressable
                  onPress={() => setForm((f) => ({ ...f, type: 'm3u' }))}
                  onFocus={() => setFocusedKey('type-m3u')}
                  onBlur={() => setFocusedKey(null)}
                  focusable
                  className="flex-1 py-3 rounded-lg border items-center"
                  style={{
                    borderColor: focusedKey === 'type-m3u' ? '#d8b4fe' : form.type === 'm3u' ? '#8b5cf6' : '#3f3f46',
                    borderWidth: focusedKey === 'type-m3u' ? 3 : 1,
                    backgroundColor: form.type === 'm3u' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                  }}
                >
                  <Text className="text-white">M3U URL</Text>
                </Pressable>
              </View>

              <FormFieldRow
                field="url"
                value={form.url}
                onChange={(t) => setForm((f) => ({ ...f, url: t }))}
                placeholder={form.type === 'xtream' ? 'Server URL (e.g. http://example.com)' : 'M3U URL'}
                inputRef={urlRef}
                returnKeyType={form.type === 'xtream' ? 'next' : 'done'}
                blurOnSubmit={form.type !== 'xtream'}
                onSubmitEditing={() =>
                  form.type === 'xtream' ? usernameRef.current?.focus() : Keyboard.dismiss()
                }
                focusedKey={focusedKey}
                onFocusKey={setFocusedKey}
                onBlurKey={() => setFocusedKey(null)}
                onPaste={() => pasteInto('url')}
                autoCapitalize="none"
              />

              {form.type === 'xtream' && (
                <>
                  <FormFieldRow
                    field="username"
                    value={form.username}
                    onChange={(t) => setForm((f) => ({ ...f, username: t }))}
                    placeholder="Username"
                    inputRef={usernameRef}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    focusedKey={focusedKey}
                    onFocusKey={setFocusedKey}
                    onBlurKey={() => setFocusedKey(null)}
                    onPaste={() => pasteInto('username')}
                    autoCapitalize="none"
                  />
                  <FormFieldRow
                    field="password"
                    value={form.password}
                    onChange={(t) => setForm((f) => ({ ...f, password: t }))}
                    placeholder="Password"
                    inputRef={passwordRef}
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={() => Keyboard.dismiss()}
                    focusedKey={focusedKey}
                    onFocusKey={setFocusedKey}
                    onBlurKey={() => setFocusedKey(null)}
                    onPaste={() => pasteInto('password')}
                    secureTextEntry
                  />
                </>
              )}

              <View className="flex-row gap-3">
                <Pressable
                  onPress={close}
                  onFocus={() => setFocusedKey('modal-cancel')}
                  onBlur={() => setFocusedKey(null)}
                  focusable
                  className="flex-1 py-3 rounded-xl bg-surface-700 items-center"
                  style={{
                    borderWidth: focusedKey === 'modal-cancel' ? 3 : 0,
                    borderColor: '#d8b4fe',
                  }}
                >
                  <Text className="text-white">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSubmit}
                  onFocus={() => setFocusedKey('modal-add')}
                  onBlur={() => setFocusedKey(null)}
                  focusable
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-primary-500 items-center"
                  style={{
                    borderWidth: focusedKey === 'modal-add' ? 3 : 0,
                    borderColor: '#d8b4fe',
                  }}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white font-medium">{editingProvider ? 'Save' : 'Add'}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
