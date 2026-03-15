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
