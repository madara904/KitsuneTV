# Kitsune TV

React Native IPTV player for **Android TV**. Same features and data model as the Tauri app; see [WORKING_DOC_RN.md](../WORKING_DOC_RN.md) and [WORKING_DOC.md](../WORKING_DOC.md).

## Stack

- React Native (bare, TypeScript)
- NativeWind (Tailwind CSS)
- React Navigation (native stack)
- Android TV (leanback launcher)

## Setup

### 1. Einmalig: Java (JDK) und Umgebungsvariablen (Windows)

**Java:** Du brauchst ein **JDK (Java SE Development Kit)**. Entweder:
- **Option A:** Android Studio nutzt einen mitgelieferten JDK-Ordner → `JAVA_HOME` auf `C:\Program Files\Android\Android Studio\jbr` setzen (nur wenn dieser Ordner existiert).
- **Option B:** JDK separat installieren (z. B. [Eclipse Temurin 17](https://adoptium.net/) oder Oracle JDK 17), dann **JAVA_HOME** auf den Installationsordner setzen (z. B. `C:\Program Files\Eclipse Adoptium\jdk-17` oder `C:\Program Files\Java\jdk-17`). Ohne JDK-Installation schlägt der Android-Build mit „JAVA_HOME is not set“ fehl.

**Umgebungsvariablen:**

1. **Win + R** → `sysdm.cpl` → Enter → Tab **Erweitert** → **Umgebungsvariablen**.
2. Unter **Benutzervariablen** **Neu**:
   - **JAVA_HOME** = Pfad zu deinem JDK (z. B. `C:\Program Files\Android\Android Studio\jbr` oder nach Option B der JDK-Installationsordner)
   - **ANDROID_HOME** = `C:\Users\beray\AppData\Local\Android\Sdk`
3. Variable **Path** bearbeiten → **Neu** hinzufügen:
   - `%JAVA_HOME%\bin`
   - `%ANDROID_HOME%\platform-tools`
   - `%ANDROID_HOME%\emulator`
4. **OK** → **OK**. Alle geöffneten Terminals/Fenster schließen und neu öffnen.

### 2. Abhängigkeiten

```bash
cd KitsuneTV
npm install
```

## Run (jedes Mal so)

1. **Emulator starten:** Android Studio → Device Manager → dein Gerät (z. B. Television 4K) → Play.
2. **Terminal 1** (im Ordner KitsuneTV):
   ```bash
   npm start
   ```
   Laufen lassen, bis „Metro is ready“ o. ä. erscheint. Bei Port-Konflikt: `npm start -- --port 8082`.
3. **Terminal 2** (neu öffnen, wieder in KitsuneTV):
   ```bash
   cd C:\Users\beray\OneDrive\Desktop\kitsune\KitsuneTV
   npm run android
   ```
   Wenn Metro auf 8082 läuft: `npx react-native run-android --port 8082`.

For Android TV: use an Android TV emulator or a physical device with USB debugging. The app appears in the TV launcher (LEANBACK_LAUNCHER).

## Project layout

- `src/api` – Xtream client, M3U parser
- `src/components` – Sidebar, (future) ChannelList, VideoPlayer
- `src/db` – SQLite schema and init (expo-sqlite / quick-sqlite to be wired)
- `src/lib` – types, keychain wrapper
- `src/navigation` – App navigator (sidebar + stack)
- `src/screens` – Live, Favorites, Recent, Settings
- `src/services` – liveService, providerService (stubs)
- `src/stores` – (future) Zustand/Context

## Next steps

1. Wire SQLite (expo-sqlite or react-native-quick-sqlite) and run schema.
2. Add react-native-keychain for provider credentials.
3. Implement Xtream client and M3U parser (port from kitsune).
4. Build channel list, search, categories, player (react-native-video).
