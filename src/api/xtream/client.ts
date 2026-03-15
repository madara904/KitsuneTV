/**
 * Xtream API client - fetch() for React Native.
 * Endpoints: get_live_categories, get_live_streams, get_short_epg.
 */
import type { XtreamCategory, XtreamLiveStream, XtreamShortEpgResponse } from './types';

const FETCH_TIMEOUT_MS = 25000;

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(t));
}

export interface XtreamConfig {
  serverUrl: string;
  username: string;
  password: string;
}

function baseUrl(config: XtreamConfig): string {
  const base = config.serverUrl.replace(/\/$/, '');
  const u = encodeURIComponent(config.username);
  const p = encodeURIComponent(config.password);
  return `${base}/player_api.php?username=${u}&password=${p}`;
}

export function buildStreamUrl(
  config: XtreamConfig,
  streamId: number | string,
  extension = 'ts'
): string {
  const base = config.serverUrl.replace(/\/$/, '');
  return `${base}/live/${encodeURIComponent(config.username)}/${encodeURIComponent(config.password)}/${streamId}.${extension}`;
}

export async function getLiveCategories(config: XtreamConfig): Promise<XtreamCategory[]> {
  const url = `${baseUrl(config)}&action=get_live_categories`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`Xtream get_live_categories: ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Network timeout. Check internet (e.g. emulator WiFi).');
    }
    throw e;
  }
}

export async function getLiveStreams(config: XtreamConfig): Promise<XtreamLiveStream[]> {
  const url = `${baseUrl(config)}&action=get_live_streams`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`Xtream get_live_streams: ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Network timeout. Check internet (e.g. emulator WiFi).');
    }
    throw e;
  }
}

export async function getShortEpg(
  config: XtreamConfig,
  streamId: number | string
): Promise<XtreamShortEpgResponse['epg_listings']> {
  const url = `${baseUrl(config)}&action=get_short_epg&stream_id=${streamId}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data?.epg_listings ?? [];
  } catch {
    return [];
  }
}
