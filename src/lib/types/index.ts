/**
 * Shared types (align with WORKING_DOC / WORKING_DOC_RN)
 * Stub for now; full types will be ported from kitsune.
 */

export type ProviderType = 'xtream' | 'm3u';

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  url: string;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  providerId: string;
  name: string;
  parentId?: string;
}

export interface Channel {
  id: string;
  providerId: string;
  categoryId: string;
  name: string;
  logo?: string;
  streamUrl: string;
  streamType?: 'hls' | 'ts' | 'mp4' | 'unknown';
  epgChannelId?: string;
}

export interface EpgProgram {
  channelId: string;
  title: string;
  start: number;
  end: number;
  description?: string;
}

export interface Favorite {
  id: string;
  channelId: string;
  createdAt: number;
}

export interface RecentChannel {
  id: string;
  channelId: string;
  watchedAt: number;
}
