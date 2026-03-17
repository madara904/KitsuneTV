import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

/**
 * Debounced search input with lokalem State.
 * Notifies parent nur über debounced onSearchChange(trimmedValue).
 */
export const DebouncedSearchInput = memo(function DebouncedSearchInput({
  placeholder,
  onSearchChange,
  minLength = 2,
  debounceMs,
  focusable = true,
}: {
  placeholder: string;
  onSearchChange: (query: string) => void;
  minLength?: number;
  debounceMs?: number;
  focusable?: boolean;
}) {
  const [localValue, setLocalValue] = useState('');
  const [focused, setFocused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const t = localValue.trim();
    if (t.length < minLength) {
      onSearchChange('');
      return () => {};
    }
    const id = setTimeout(() => {
      onSearchChange(t);
    }, debounceMs);
    timerRef.current = id;
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [localValue, minLength, debounceMs, onSearchChange]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginHorizontal: 16,
        marginVertical: 10,
        height: 40,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: focused ? 3 : 1,
        borderColor: focused ? '#d8b4fe' : '#3f3f46',
        backgroundColor: '#1c1c24',
      }}
    >
      <MaterialCommunityIcons name="magnify" size={18} color="#6e6e7d" />
      <TextInput
        className="flex-1 text-white text-sm p-0"
        placeholder={placeholder}
        placeholderTextColor="#6e6e7d"
        value={localValue}
        onChangeText={setLocalValue}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        focusable={focusable}
        style={{ paddingVertical: 8, color: '#fff' }}
      />
    </View>
  );
});

/**
 * Search input mit Button: lokale Eingabe, keine Live-Suche.
 * Parent bekommt den Wert nur, wenn der User explizit sucht.
 */
export const SearchInputWithButton = memo(function SearchInputWithButton({
  placeholder,
  onSubmit,
  focusable = true,
}: {
  placeholder: string;
  onSubmit: (query: string) => void;
  focusable?: boolean;
}) {
  const [localValue, setLocalValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [buttonFocused, setButtonFocused] = useState(false);

  const handleSubmit = useCallback(() => {
    const trimmed = localValue.trim();
    onSubmit(trimmed);
  }, [localValue, onSubmit]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginHorizontal: 16,
        marginVertical: 10,
        height: 40,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: focused ? 3 : 1,
        borderColor: focused ? '#d8b4fe' : '#3f3f46',
        backgroundColor: '#1c1c24',
      }}
    >
      <MaterialCommunityIcons name="magnify" size={18} color="#6e6e7d" />
      <TextInput
        className="flex-1 text-white text-sm p-0"
        placeholder={placeholder}
        placeholderTextColor="#6e6e7d"
        value={localValue}
        onChangeText={setLocalValue}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        focusable={focusable}
        style={{ paddingVertical: 8, color: '#fff' }}
      />
      <Pressable
        onPress={handleSubmit}
        onFocus={() => setButtonFocused(true)}
        onBlur={() => setButtonFocused(false)}
        focusable={focusable}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: buttonFocused ? 2 : 1,
          borderColor: buttonFocused ? '#d8b4fe' : '#4b5563',
          backgroundColor: '#111827',
        }}
      >
        <MaterialCommunityIcons name="arrow-right" size={16} color="#e5e7eb" />
      </Pressable>
    </View>
  );
});
