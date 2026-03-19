/**
 * Xtream API types - to be ported from kitsune repo
 */
export interface XtreamAuthResponse {
  user_info?: { auth: number; [key: string]: unknown };
  [key: string]: unknown;
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
}

export interface XtreamLiveStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon?: string;
  epg_channel_id?: string;
  category_id?: string;
  [key: string]: unknown;
}

export interface XtreamShortEpgResponse {
  epg_listings?: Array<{
    id: string;
    epg_id: string;
    title: string;
    start: string;
    end: string;
    description?: string;
  }>;
}

export interface XtreamVodStream {
  stream_id: number;
  name: string;
  category_id?: string;
  stream_icon?: string;
  container_extension?: string;
}

export interface XtreamVodInfoResponse {
  info?: {
    name?: string;
    plot?: string;
    stream_icon?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface XtreamSeriesItem {
  series_id: number;
  name: string;
  category_id?: string;
  cover?: string;
}

export interface XtreamSeriesEpisode {
  id: number;
  title: string;
  episode_num: number;
  season: number;
  container_extension?: string;
  info?: {
    plot?: string;
    movie_image?: string;
    [key: string]: unknown;
  };
  movie_image?: string;
}

export interface XtreamSeriesInfoResponse {
  seasons?: Array<{
    season_number: number;
  }>;
  episodes?: {
    [seasonNumber: string]: XtreamSeriesEpisode[];
  };
  info?: {
    name?: string;
    cover?: string;
    plot?: string;
    [key: string]: unknown;
  };
}
