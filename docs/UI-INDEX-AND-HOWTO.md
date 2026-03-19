# KitsuneTV UI Index & How-To (Framework-Agnostic)

This document describes the app’s UI structure and how to build equivalent **Movie** and **Series Detail** pages in any framework. It is written so coding agents can implement similar screens without depending on React Native.

---

## 1. App structure (high level)

```
┌─────────────────────────────────────────────────────────────────┐
│  Root                                                            │
│  ┌──────────┬─────────────────────────────────┬──────────────┐  │
│  │ Sidebar  │  Stack (screens)                 │ PlayerColumn │  │
│  │ (nav)    │  Live | Movies | Series | ...    │ (optional)   │  │
│  └──────────┴─────────────────────────────────┴──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

- **Sidebar**: Fixed-width vertical nav (Live, Movies, Series, Settings). Only shown when not in fullscreen player.
- **Stack**: One screen at a time. No header; each screen owns its chrome.
- **PlayerColumn**: Shown when a live channel is selected; hidden or replaced when in Movie/Series player.

**Navigation flow (VOD):**

- **Movies**: List → **Movie Detail** → **Movie Player**
- **Series**: List → **Series Detail** → **Movie Player** (with episode context)

---

## 2. File / screen index

| Area | Path | Purpose |
|------|------|---------|
| **Navigation** | `src/navigation/AppNavigator.tsx` | Stack + Sidebar + PlayerColumn; route names. |
| **Layout** | `src/components/layout/Sidebar.tsx` | Sidebar nav (icon + label per route). |
| **Screens – List** | `src/screens/MoviesScreen.tsx` | Movie list: tabs, search, category filter, rows. |
| | `src/screens/SeriesScreen.tsx` | Series list: same pattern. |
| **Screens – Detail** | `src/screens/MovieDetailScreen.tsx` | Single-movie detail: poster, description, play/favorite. |
| | `src/screens/SeriesDetailScreen.tsx` | Single-series detail: poster, description, seasons, episodes. |
| **Screens – Player** | `src/screens/MoviePlayerScreen.tsx` | VLC playback; used for both movies and series episodes. |
| **Common UI** | `src/components/common/ContentModeTabs.tsx` | Tabs: All | Favorites | Recent. |
| | `src/components/common/EmptyState.tsx` | Empty list state (icon, title, description, optional action). |
| | `src/components/common/DebouncedSearchInput.tsx` | Search field (debounced or submit-on-button). |
| **Player UI** | `src/components/player/FullscreenPlaybackOverlay.tsx` | Fullscreen controls overlay. |
| | `src/components/player/PlayerOptionMenu.tsx` | Audio/subtitle/track menu. |
| **Types** | `src/lib/types/index.ts` | Shared domain types (Movie, SeriesItem, etc.). |

---

## 3. Data contracts (framework-agnostic)

These are the shapes your backend or services should expose. Types below are described in a generic way (no framework).

### 3.1 Movie

```ts
Movie = {
  id: string;
  providerId: string;
  categoryId: string;
  name: string;
  poster?: string;   // URL
  streamUrl?: string; // URL
}
```

### 3.2 Movie “details” (extra info for detail page)

```ts
MovieDetails = {
  description?: string;
}
```

- **Fetch**: By `movieId`. Can be a separate API or combined with the movie entity.

### 3.3 Series (show-level)

```ts
SeriesItem = {
  id: string;
  providerId: string;
  categoryId: string;
  name: string;
  poster?: string;  // URL
  // no streamUrl at show level
}
```

### 3.4 Series seasons and episodes

```ts
SeriesInfo = {
  description?: string;
};

Episode = {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  summary?: string;
  streamUrl?: string;  // URL
  imageUrl?: string;   // URL (still/thumb)
};

Season = {
  seasonNumber: number;
  episodes: Episode[];
};

SeriesSeasonsResponse = {
  seriesInfo?: SeriesInfo;
  seasons: Season[];
};
```

### 3.5 Favorites and recents (collections)

- **Favorites**: List of content IDs by type (`movie` | `series`). Operations: add, remove, list IDs.
- **Recents**: List of content IDs by type, ordered by last opened; optional limit.

### 3.6 Watch progress (series only for detail page)

```ts
WatchProgress = {
  contentType: 'movie' | 'series';
  contentId: string;   // seriesId for series
  episodeId: string;
  positionSec: number;
  durationSec?: number;
  updatedAt: number;   // timestamp
}
```

- **Usage**: For each episode, show a progress bar; optionally mark “last watched” episode (e.g. by max `updatedAt`).

---

## 4. How to build a Movie Detail page

### 4.1 Purpose

- Show one movie: poster, title, description, and actions (Play, Favorite).
- Navigate to the player when the user chooses Play.

### 4.2 Route / entry

- **Route param**: `movieId` (string).
- **Entry**: From the movie list when user selects a movie.

### 4.3 Data to load

1. **Movie**: Fetch by `movieId` (e.g. `getMoviesByIds([movieId])` → take first element).
2. **Favorite state**: Is this `movieId` in the favorites list for `movie`?
3. **Details**: Fetch movie details by `movieId` (e.g. `getMovieDetails(movieId)` → `description`).

All can be requested in parallel; use a single “loading” state until the movie is resolved.

### 4.4 Layout (structure only)

```
┌─────────────────────────────────────────────────────────────────┐
│  [← Back]                                                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   Title (movie.name)                            │
│  │             │   Description (details.description or fallback)│
│  │   Poster    │   [▶ Play]  [♡ Favorite / In Favoriten]         │
│  │   (260×360) │   Badge: "Film" (or category)                   │
│  └─────────────┘                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- **Back**: Navigate back (e.g. to movie list).
- **Poster**: Use `movie.poster` URL; if missing, show a placeholder (e.g. icon).
- **Title**: `movie.name`, 1–2 lines.
- **Description**: `details.description` if present; else a short fallback text.
- **Play**: Only enabled if `movie.streamUrl` is present. On press:
  - Optionally mark movie as “recent”.
  - Navigate to player with `movieId` (and any stream URL/title overrides your player expects).
- **Favorite**: Toggle favorite for this `movieId`; update local state from collection service.
- **Badge**: Optional; e.g. “Film” or category name.

### 4.5 States

- **Loading**: Show a single full-screen loading indicator until movie is loaded.
- **Not found**: If no movie for `movieId`, show a short message and a Back button.
- **Ready**: Show layout above with poster, title, description, actions, badge.

### 4.6 TV / focus (optional)

- If your stack supports focus management (e.g. TV): Back, Play, and Favorite should be focusable; optional `nextFocusUp` from primary actions to Back for better D-pad navigation.

---

## 5. How to build a Series Detail page

### 5.1 Purpose

- Show one series: poster, title, description, and actions (Play first episode, Favorite).
- List episodes for the selected season; each episode can be played.
- Show per-episode watch progress and optionally “last watched” episode.

### 5.2 Route / entry

- **Route param**: `seriesId` (string).
- **Entry**: From the series list when user selects a series.

### 5.3 Data to load

1. **Series**: Fetch by `seriesId` (e.g. `getSeriesByIds([seriesId])` → first element).
2. **Favorite state**: Is `seriesId` in the favorites list for `series`?
3. **Seasons and episodes**: Fetch `getSeriesSeasonsAndEpisodes(seriesId)` → `seriesInfo` + `seasons`.
4. **Watch progress**: For this series, list all episode progress (e.g. `listByContent('series', seriesId)`).

- Set **selected season** to the first season (e.g. `seasons[0].seasonNumber`) when data arrives.
- When the screen gains focus again (e.g. returning from player), refresh watch progress.

### 5.4 Layout (structure only)

```
┌─────────────────────────────────────────────────────────────────┐
│  [← Back]                                                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   Title (series.name)                           │
│  │             │   Description (seriesInfo.description or fallback)
│  │   Poster    │   [▶ Play]  [♡ Favorite / In Favoriten]         │
│  │   (260×320) │                                                 │
│  └─────────────┘                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Episoden          [Staffel 1 ▾]  (season selector)              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ [thumb]  S1-E1  Episode title     [progress bar if watched] │ │
│  │          Optional summary                    [Last badge]   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ [thumb]  S1-E2  ...                                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ... (more episode cards)                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 5.5 Components (logical)

- **Header**: Back button only.
- **Hero**: Poster + title + description + Play + Favorite (same idea as movie detail).
- **Season selector**: Label “Episoden” + dropdown/button “Staffel N” that opens a **season modal**.
  - **Season modal**: List of seasons (e.g. “Staffel 1”, “Staffel 2”, …). On select: set selected season, close modal, show that season’s episodes.
- **Episode list**: For the **selected season**, render one **episode card** per episode.

### 5.6 Episode card (structure)

- **Thumbnail**: `episode.imageUrl` or placeholder icon.
- **Label**: e.g. `S{seasonNumber}-E{episodeNumber}`.
- **Title**: `episode.title`.
- **Summary**: `episode.summary` (optional, 1–2 lines).
- **Progress bar**: If there is watch progress for this `episode.id`, show `positionSec / durationSec` as a progress bar; if ≥ ~97%, treat as “complete” (e.g. different color).
- **“Last” badge**: If this episode is the one with the latest `updatedAt` in watch progress for this series, show a “Letzte” (or “Last watched”) badge.
- **Action**: On press/click, **play this episode** (see below).

### 5.7 Play behavior

- **Main “Play” (Abspielen)**: Play the **first episode** of the **current season** (if any).
- **Episode card**: Play that episode.

**When playing an episode:**

1. Ensure series is marked recent (for “Recent” tab).
2. Save/update watch progress for this episode (e.g. position 0, duration undefined) so it appears in progress list.
3. Build an **episode queue**: all episodes (across seasons or for current season, depending on product) that have `streamUrl`, in order.
4. Navigate to the **same player screen** used for movies, with params such as:
   - `movieId`: `seriesId` (reused as content id)
   - `episodeId`: this episode’s `id`
   - `streamUrlOverride`: `episode.streamUrl`
   - `titleOverride`: e.g. `"{series.name} - S{s}e{e}"`
   - `episodeQueue`: list of `{ movieId, episodeId, streamUrlOverride, titleOverride }` for “next episode” / continuous play.

### 5.8 States

- **Loading**: Full-screen loader until series (and seasons) are loaded.
- **Not found**: If no series for `seriesId`, message + Back button.
- **Ready**: Show hero + season selector + episode list. If no episodes, show “Keine Episoden verfügbar” (or equivalent).

### 5.9 Last-watched and progress

- **Last-watched episode**: Among watch progress rows for this `seriesId`, pick the episode with the greatest `updatedAt`; pass a “isLastWatched” flag to that episode card.
- **Progress per episode**: For each episode id, get `positionSec` and `durationSec` from the progress list; compute percent for the bar and “complete” state (e.g. ≥ 0.97).

---

## 6. Shared patterns (any framework)

- **List → Detail → Player**: Same pattern for movies and series; series detail adds seasons/episodes and progress.
- **Favorites**: Stored by content type and content id; detail page reads and toggles.
- **Recents**: Stored by content type and content id; list screens filter by “recent” tab.
- **Watch progress**: Series only (for this app); keyed by `contentType`, `contentId`, `episodeId`; detail page loads all for one series and passes per-episode data into cards.
- **Modals**: Category filter (list screens) and season picker (series detail) are modals/overlays; select then close.
- **Empty states**: Use an icon, title, and short description when list or episodes are empty.
- **Focus**: For TV, primary actions (Back, Play, Favorite, Season) and list items are focusable; keep a simple focus chain (e.g. Back above Play/Favorite).

---

## 7. Quick reference: services used by detail pages

| Screen | Service / API | Purpose |
|--------|----------------|---------|
| Movie Detail | getMoviesByIds([movieId]) | Get movie |
| Movie Detail | getMovieDetails(movieId) | Get description |
| Movie Detail | favoriteIds('movie'), setFavorite('movie', id, bool) | Favorite state |
| Movie Detail | markRecent('movie', movieId) | Before navigate to player |
| Series Detail | getSeriesByIds([seriesId]) | Get series |
| Series Detail | getSeriesSeasonsAndEpisodes(seriesId) | Seasons + episodes + seriesInfo |
| Series Detail | favoriteIds('series'), setFavorite('series', id, bool) | Favorite state |
| Series Detail | listByContent('series', seriesId) | Watch progress per episode |
| Series Detail | markRecent('series', seriesId) | Before navigate to player |
| Series Detail | watchProgress.save('series', seriesId, episodeId, 0, undefined) | When starting an episode |

---

## 8. Summary for agents

- **Movie Detail**: One route param `movieId`. Load movie + details + favorite; render poster, title, description, Play, Favorite, Back. Play uses `movie.streamUrl` and navigates to player with `movieId`.
- **Series Detail**: One route param `seriesId`. Load series + seasons/episodes + favorite + watch progress. Render poster, title, description, Play (first episode of selected season), Favorite, Back, season selector, and episode list. Episode cards show progress and “last watched”; play passes `episodeQueue` and episode context to the same player screen.
- Data contracts (Movie, SeriesItem, Episode, Season, WatchProgress, MovieDetails, SeriesInfo) are defined in §3 and are framework-agnostic.
- List screens use ContentModeTabs (All / Favorites / Recent), search, and category filter; detail screens do not use tabs.

This should be enough to reimplement Movie and Series detail pages in another stack (e.g. React web, Vue, Flutter) with equivalent behavior and data.
