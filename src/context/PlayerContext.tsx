import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Channel } from '../lib/types';

/** Android TV: node handle of first focusable in player (play button) so channel list can set nextFocusRight */
export type PlayerFocusHandle = number | null;

type PlayerContextValue = {
  currentChannel: Channel | null;
  setCurrentChannel: (ch: Channel | null) => void;
  fullscreen: boolean;
  setFullscreen: (v: boolean) => void;
  /** Set from PlayerColumn so LiveScreen can pass nextFocusRight to channel rows */
  playerFocusNodeHandle: PlayerFocusHandle;
  setPlayerFocusNodeHandle: (h: PlayerFocusHandle) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [playerFocusNodeHandle, setPlayerFocusNodeHandle] = useState<PlayerFocusHandle>(null);
  return (
    <PlayerContext.Provider
      value={{
        currentChannel,
        setCurrentChannel,
        fullscreen,
        setFullscreen,
        playerFocusNodeHandle,
        setPlayerFocusNodeHandle,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}
