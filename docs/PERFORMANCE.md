# Performance – Analyse & Maßnahmen

## Warum wir schlechte Performance haben können

### 1. **Sync auf dem Live-Screen (behoben)**
- **Problem:** Sync-Button auf Live hat `liveService.syncProvider()` auf dem JS-Thread ausgeführt → viele API-Calls, DB-Inserts, Re-Renders. Die UI friert ein.
- **Lösung:** Sync nur noch in Settings (pro Provider). Live bleibt schlank.

### 2. **Video/Audio ruckelt**
- **Ursachen:** Zu kleiner Puffer (ExoPlayer), JS-Thread blockiert beim Start, zu viele Progress-Updates über die Bridge.
- **Maßnahmen (umgesetzt):**
  - **bufferConfig:** Größerer Puffer (min 8s, max 25s, Start nach 2.5s) → weniger Stalls bei Netz/Latenz.
  - **progressUpdateInterval={1000}:** Progress nur 1× pro Sekunde → weniger Bridge-Traffic.
  - **recentRepo.add** um 500 ms verzögert → blockiert nicht die gleiche Frame wie der Video-Start.

### 3. **JS-Thread / Bridge**
- Schwere Arbeit (DB, Netz) läuft auf dem JS-Thread. Wenn der blockiert, wirkt alles ruckelig (inkl. Player-Updates).
- **Bereits umgesetzt:** Suche mit Debounce, virtualisierte Listen (FlatList für Kanäle + Kategorien), DB-Suche mit `setTimeout(0)` entkoppelt.

### 4. **SQLite**
- `executeAsync` ist asynchron, aber viele kleine Writes (z. B. recentRepo.add bei jedem Kanalwechsel) können sich stauen.
- **Bereits umgesetzt:** recentRepo.add verzögert, damit der Player-Start nicht blockiert.

### 5. **Emulator / Netz**
- Android-Emulator hat oft schwache CPU und virtuelles Netz → Streams brechen leichter ab, Puffer reicht nicht.
- **Tipp:** Auf echtem Gerät und stabilem WLAN testen; dann wirkt der größere Puffer am meisten.

### 6. **Re-Renders**
- Weniger State-Updates auf Live = weniger Re-Renders. Sync weg, Suche in eigener Komponente, Listen virtualisiert → schon umgesetzt.

---

## Kurz: Was wir geändert haben

| Bereich        | Änderung |
|----------------|----------|
| Live           | Sync-Button entfernt → Sync nur in Settings |
| Player         | Größerer Puffer (bufferConfig), progressUpdateInterval 1s, recentRepo.add 500 ms verzögert |
| Performance-Docs | Diese Datei |

---

## Wenn es weiter ruckelt

- **Release-Build** testen (`./gradlew assembleRelease`), Debug ist langsamer.
- **Echtes Gerät** statt Emulator.
- **Stream-Qualität:** Niedrigere Bitrate/Qualität vom Provider entlastet Decoder und Netz.
- **react-native-video:** Prüfen ob `useTextureView={true}` auf Android hilft (manchmal flüssiger).
- **ExoPlayer-Logs:** `adb logcat` nach Buffer-/Decoder-Warnungen durchsuchen.
