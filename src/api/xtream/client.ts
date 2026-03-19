/**
 * Xtream API client - fetch() for React Native.
 * Endpoints: get_live_categories, get_live_streams, get_short_epg, get_vod_categories, get_vod_streams, get_series_categories, get_series.
 */
import type {
  XtreamCategory,
  XtreamLiveStream,
  XtreamSeriesItem,
  XtreamSeriesInfoResponse,
  XtreamShortEpgResponse,
  XtreamVodInfoResponse,
  XtreamVodStream,
} from './types';

const FETCH_TIMEOUT_MS = 25000;

async function fetchArray<T>(url: string, endpointName: string): Promise<T[]> {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`${endpointName}: ${res.status}`);
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as T[]) : [];
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Network timeout. Check internet (e.g. emulator WiFi).');
    }
    if (e instanceof SyntaxError) {
      throw new Error(`${endpointName}: invalid JSON response`);
    }
    throw e;
  }
}

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
  extension = 'ts',
): string {
  const base = config.serverUrl.replace(/\/$/, '');
  return `${base}/live/${encodeURIComponent(config.username)}/${encodeURIComponent(
    config.password,
  )}/${streamId}.${extension}`;
}

export async function getLiveCategories(config: XtreamConfig): Promise<XtreamCategory[]> {
  const url = `${baseUrl(config)}&action=get_live_categories`;
  return fetchArray<XtreamCategory>(url, 'Xtream get_live_categories');
}

export async function getLiveStreams(
  config: XtreamConfig,
  categoryId?: string,
): Promise<XtreamLiveStream[]> {
  const categoryPart = categoryId != null ? `&category_id=${encodeURIComponent(categoryId)}` : '';
  const url = `${baseUrl(config)}&action=get_live_streams${categoryPart}`;
  return fetchArray<XtreamLiveStream>(url, 'Xtream get_live_streams');
}

export async function getShortEpg(
  config: XtreamConfig,
  streamId: number | string,
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

export async function getVodCategories(config: XtreamConfig): Promise<XtreamCategory[]> {
  const url = `${baseUrl(config)}&action=get_vod_categories`;
  return fetchArray<XtreamCategory>(url, 'Xtream get_vod_categories');
}

export async function getVodStreams(
  config: XtreamConfig,
  categoryId?: string,
): Promise<XtreamVodStream[]> {
  const categoryPart = categoryId != null ? `&category_id=${encodeURIComponent(categoryId)}` : '';
  const url = `${baseUrl(config)}&action=get_vod_streams${categoryPart}`;
  return fetchArray<XtreamVodStream>(url, 'Xtream get_vod_streams');
}

export async function getVodInfo(
  config: XtreamConfig,
  vodId: number | string,
): Promise<XtreamVodInfoResponse | null> {
  const url = `${baseUrl(config)}&action=get_vod_info&vod_id=${encodeURIComponent(vodId)}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return (data ?? null) as XtreamVodInfoResponse | null;
  } catch {
    return null;
  }
}

export async function getSeriesCategories(config: XtreamConfig): Promise<XtreamCategory[]> {
  const url = `${baseUrl(config)}&action=get_series_categories`;
  return fetchArray<XtreamCategory>(url, 'Xtream get_series_categories');
}

export async function getSeries(
  config: XtreamConfig,
  categoryId?: string,
): Promise<XtreamSeriesItem[]> {
  const categoryPart = categoryId != null ? `&category_id=${encodeURIComponent(categoryId)}` : '';
  const url = `${baseUrl(config)}&action=get_series${categoryPart}`;
  return fetchArray<XtreamSeriesItem>(url, 'Xtream get_series');
}

export async function getSeriesInfo(
  config: XtreamConfig,
  seriesId: number | string,
): Promise<XtreamSeriesInfoResponse | null> {
  const url = `${baseUrl(config)}&action=get_series_info&series_id=${encodeURIComponent(seriesId)}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return (data ?? null) as XtreamSeriesInfoResponse | null;
  } catch {
    return null;
  }
}
