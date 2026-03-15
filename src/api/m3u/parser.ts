/**
 * M3U parser - #EXTM3U, #EXTINF, tvg-id, tvg-logo, group-title, stream URL.
 */
export interface M3uChannel {
  name: string;
  streamUrl: string;
  tvgId?: string;
  tvgLogo?: string;
  groupTitle?: string;
}

const EXTINF = '#EXTINF:';
const TAG_TVG_ID = 'tvg-id="';
const TAG_TVG_LOGO = 'tvg-logo="';
const TAG_GROUP = 'group-title="';

function parseExtinf(line: string): { name: string; tvgId?: string; tvgLogo?: string; groupTitle?: string } {
  const rest = line.slice(EXTINF.length).trim();
  let name = '';
  let tvgId: string | undefined;
  let tvgLogo: string | undefined;
  let groupTitle: string | undefined;

  const idx = rest.indexOf(',');
  if (idx >= 0) {
    const attrs = rest.slice(0, idx).trim();
    name = rest.slice(idx + 1).trim();
    let i = 0;
    while (i < attrs.length) {
      if (attrs.slice(i).startsWith(TAG_TVG_ID)) {
        i += TAG_TVG_ID.length;
        const end = attrs.indexOf('"', i);
        if (end >= 0) {
          tvgId = attrs.slice(i, end);
          i = end + 1;
        }
      } else if (attrs.slice(i).startsWith(TAG_TVG_LOGO)) {
        i += TAG_TVG_LOGO.length;
        const end = attrs.indexOf('"', i);
        if (end >= 0) {
          tvgLogo = attrs.slice(i, end);
          i = end + 1;
        }
      } else if (attrs.slice(i).startsWith(TAG_GROUP)) {
        i += TAG_GROUP.length;
        const end = attrs.indexOf('"', i);
        if (end >= 0) {
          groupTitle = attrs.slice(i, end);
          i = end + 1;
        }
      } else {
        i++;
      }
    }
  } else {
    name = rest;
  }
  return { name, tvgId, tvgLogo, groupTitle };
}

export function parseM3u(content: string): M3uChannel[] {
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  const result: M3uChannel[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith(EXTINF)) {
      const meta = parseExtinf(line);
      i++;
      const urlLine = lines[i];
      if (urlLine && !urlLine.startsWith('#')) {
        result.push({
          name: meta.name,
          streamUrl: urlLine,
          tvgId: meta.tvgId,
          tvgLogo: meta.tvgLogo,
          groupTitle: meta.groupTitle,
        });
      }
    }
    i++;
  }
  return result;
}
