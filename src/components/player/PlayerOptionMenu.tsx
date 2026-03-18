import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export type PlayerOptionMenuItem = {
  id: string;
  label: string;
  selected?: boolean;
  disabled?: boolean;
};

type PlayerOptionMenuProps = {
  title: string;
  icon?: string;
  triggerLabel?: string;
  items: PlayerOptionMenuItem[];
  disabled?: boolean;
  onSelect: (id: string) => void;
  onOpenChange?: (open: boolean) => void;
  onInteract?: () => void;
};

export function PlayerOptionMenu({
  title,
  icon,
  triggerLabel,
  items,
  disabled = false,
  onSelect,
  onOpenChange,
  onInteract,
}: PlayerOptionMenuProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const triggerRef = useRef<React.ElementRef<typeof Pressable>>(null);
  const optionRefs = useRef<Array<React.ElementRef<typeof Pressable> | null>>([]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [onOpenChange, open]);

  useEffect(
    () => () => {
      onOpenChange?.(false);
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      const selectedIndex = items.findIndex((item) => item.selected && !item.disabled);
      const fallbackIndex = items.findIndex((item) => !item.disabled);
      const nextIndex = selectedIndex >= 0 ? selectedIndex : fallbackIndex;
      if (nextIndex >= 0) {
        optionRefs.current[nextIndex]?.focus?.();
      }
    }, 60);
    return () => clearTimeout(id);
  }, [items, open]);

  const closeMenu = () => {
    setOpen(false);
    setFocusedIndex(null);
    setTimeout(() => {
      triggerRef.current?.focus?.();
    }, 40);
  };

  return (
    <View className="relative items-end">
      {open && (
        <View className="absolute bottom-16 right-0 min-w-[240px] rounded-3xl border border-slate-200/10 bg-slate-950/95 px-3 py-3">
          <Text className="px-2 pb-2 text-xs uppercase tracking-[2px] text-slate-400">
            {title}
          </Text>
          {items.map((item, index) => (
            <Pressable
              key={item.id}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              onPress={() => {
                if (item.disabled) return;
                onInteract?.();
                onSelect(item.id);
                closeMenu();
              }}
              onFocus={() => {
                setFocusedIndex(index);
                onInteract?.();
              }}
              onBlur={() => setFocusedIndex((current) => (current === index ? null : current))}
              focusable={!item.disabled}
              className={`mb-2 flex-row items-center justify-between rounded-2xl border px-3 py-3 ${
                item.disabled
                  ? 'border-slate-800 bg-slate-900/40 opacity-60'
                  : focusedIndex === index
                    ? 'border-cyan-300 bg-cyan-300/15'
                    : item.selected
                      ? 'border-slate-400/40 bg-slate-200/10'
                      : 'border-slate-800 bg-slate-900/70'
              }`}
            >
              <Text className="mr-3 flex-1 text-sm text-slate-100">{item.label}</Text>
              {item.selected && (
                <MaterialCommunityIcons name="check" size={18} color="#67e8f9" />
              )}
            </Pressable>
          ))}
        </View>
      )}

      <Pressable
        ref={triggerRef}
        onPress={() => {
          if (disabled) return;
          onInteract?.();
          setOpen((current) => !current);
        }}
        onFocus={() => onInteract?.()}
        focusable
        className={`h-14 w-14 items-center justify-center rounded-full border ${
          disabled
            ? 'border-slate-800 bg-slate-950/40 opacity-50'
            : open
              ? 'border-cyan-300 bg-cyan-300/20'
              : 'border-slate-500/40 bg-slate-950/65'
        }`}
      >
        {triggerLabel ? (
          <Text className="text-sm font-semibold tracking-[1px] text-slate-100">
            {triggerLabel}
          </Text>
        ) : icon ? (
          <MaterialCommunityIcons name={icon} size={22} color="#e2e8f0" />
        ) : null}
      </Pressable>
    </View>
  );
}
