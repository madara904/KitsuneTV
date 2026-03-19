import React, { useRef, useEffect, useState } from 'react';
import { findNodeHandle, Pressable, Text, View } from 'react-native';

type ResumePromptModalProps = {
  visible: boolean;
  positionLabel: string;
  onStartOver: () => void;
  onResume: () => void;
  onResumeHandleChange?: (handle: number | null) => void;
};

export function ResumePromptModal({
  visible,
  positionLabel,
  onStartOver,
  onResume,
  onResumeHandleChange,
}: ResumePromptModalProps) {
  const resumeRef = useRef<React.ElementRef<typeof Pressable>>(null);
  const [focusedBtn, setFocusedBtn] = useState<'start' | 'resume' | null>(null);
  const resumeHandleRef = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      const handle = findNodeHandle(resumeRef.current);
      if (handle) {
        resumeHandleRef.current = handle;
      }
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => {
      (resumeRef.current as unknown as { focus?: () => void })?.focus?.();
    }, 50);
    return () => clearTimeout(id);
  }, [visible]);

  useEffect(() => {
    if (!onResumeHandleChange) return;
    if (!visible) {
      onResumeHandleChange(null);
      return;
    }
    const handle = findNodeHandle(resumeRef.current);
    onResumeHandleChange(handle ?? null);
  }, [visible, onResumeHandleChange]);

  if (!visible) return null;

  return (
    <View
      className="absolute inset-0 items-center justify-center bg-black/60"
      pointerEvents="auto"
    >
      <View className="px-6 py-4 rounded-2xl bg-slate-950 border border-gray-600 min-w-[320px]">
        <Text className="text-gray-200 text-base mb-3 text-center">
          Weiter schauen ab {positionLabel}?
        </Text>

        <View className="flex-row justify-between mt-2">
          {/* ── Von Anfang ── */}
          <Pressable
            onPress={onStartOver}
            focusable
            onFocus={() => setFocusedBtn('start')}
            onBlur={() => setFocusedBtn(null)}
            className={`flex-1 py-3 rounded-full mr-2 items-center border-2 border-solid active:opacity-70 ${
              focusedBtn === 'start'
                ? 'bg-blue-700 border-blue-400'
                : 'bg-gray-900 border-gray-600'
            }`}
          >
            <Text
              className={`text-gray-200 ${
                focusedBtn === 'start' ? 'font-bold' : 'font-medium'
              }`}
            >
              Von Anfang
            </Text>
          </Pressable>

          {/* ── Weiter schauen ── */}
          <Pressable
            ref={resumeRef}
            onPress={onResume}
            focusable
            onFocus={() => setFocusedBtn('resume')}
            onBlur={() => setFocusedBtn(null)}
            className={`flex-1 py-3 rounded-full ml-2 items-center border-2 border-solid active:opacity-70 ${
              focusedBtn === 'resume'
                ? 'bg-blue-700 border-blue-400'
                : 'bg-gray-900 border-gray-600'
            }`}
          >
            <Text
              className={`text-gray-200 ${
                focusedBtn === 'resume' ? 'font-extrabold' : 'font-semibold'
              }`}
            >
              Weiter schauen
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}