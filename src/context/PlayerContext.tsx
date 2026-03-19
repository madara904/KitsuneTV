import React, { createContext, useContext, useState } from 'react';
import type { Channel, MoviePlayback } from '../lib/types';

/** Android TV: node handle of first focusable in player (play button) so channel list can set nextFocusRight */
export type PlayerFocusHandle = number | null;

type PlayerContextValue = {
  currentChannel: Channel | null;
  setCurrentChannel: (ch: Channel | null) => void;
  /** Currently playing movie (VOD). When set, live channel is cleared. */
  currentVod: MoviePlayback | null;
  setCurrentVod: (v: MoviePlayback | null) => void;
  fullscreen: boolean;
  setFullscreen: (v: boolean) => void;
  playerFocusNodeHandle: PlayerFocusHandle;
  setPlayerFocusNodeHandle: (h: PlayerFocusHandle) => void;
  /** True when one of the 3 player buttons has focus – LiveScreen hides channel focus ring so only one focus is visible */
  playerControlsFocused: boolean;
  setPlayerControlsFocused: (v: boolean) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [currentVod, setCurrentVod] = useState<MoviePlayback | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [playerFocusNodeHandle, setPlayerFocusNodeHandle] = useState<PlayerFocusHandle>(null);
  const [playerControlsFocused, setPlayerControlsFocused] = useState(false);
  return (
    <PlayerContext.Provider
      value={{
        currentChannel,
        setCurrentChannel,
        currentVod,
        setCurrentVod,
        fullscreen,
        setFullscreen,
        playerFocusNodeHandle,
        setPlayerFocusNodeHandle,
        playerControlsFocused,
        setPlayerControlsFocused,
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
