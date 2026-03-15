# APK bauen (KitsuneTV)

## Kurzüberblick

- **Debug-APK:** Zum Testen (z.B. auf Gerät/Emulator), mit Debug-Signatur.
- **Release-APK:** Zum Verteilen/Installieren auf echten Geräten. Für Play Store später eigenen Keystore verwenden.

Der JavaScript-Bundle wird beim Gradle-Build automatisch erzeugt (du musst Metro nicht manuell starten).

---

## 1. Debug-APK (zum Testen)

Einfachste Variante: APK bauen und optional auf verbundenes Gerät installieren.

### Nur APK erstellen (ohne Installation)

```bash
cd KitsuneTV
cd android
gradlew.bat assembleDebug
```

Die APK liegt danach hier:
`android\app\build\outputs\apk\debug\app-debug.apk`

### Mit gleicher Umgebung wie `npm run android` (JAVA_HOME etc.)

Aus dem Projektroot:

```bash
npm run build:apk:debug
```

(Das Skript setzt JAVA_HOME/ANDROID_HOME und ruft `gradlew.bat assembleDebug` auf.)

---

## 2. Release-APK (zum Verteilen)

Release-Build erzeugt eine optimierte APK. Aktuell ist im Projekt noch der **Debug-Keystore** für Release eingetragen – für echte Veröffentlichung solltest du einen eigenen Keystore anlegen und in `android/app/build.gradle` unter `signingConfigs` eintragen.

### APK bauen

```bash
cd KitsuneTV
cd android
gradlew.bat assembleRelease
```

Oder mit Umgebung:

```bash
npm run build:apk:release
```

Die APK liegt hier:
`android\app\build\outputs\apk\release\app-release.apk`

### Eigenen Keystore für Release (z.B. Play Store)

1. Keystore erzeugen (einmalig):

   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```

2. In `android/app/build.gradle` eine eigene `release`-Signatur anlegen und `buildTypes.release.signingConfig` darauf zeigen (Passwörter nicht ins Repo committen; z.B. über Umgebungsvariablen oder `keystore.properties`).
3. Offizielle Doku: [Signed APK Android (React Native)](https://reactnative.dev/docs/signed-apk-android).

---

## 3. Wo liegen die APKs?

| Build   | Pfad |
|--------|------|
| Debug  | `android\app\build\outputs\apk\debug\app-debug.apk` |
| Release| `android\app\build\outputs\apk\release\app-release.apk` |

---

## 4. Häufige Probleme

- **"JAVA_HOME is not set" / "gradlew nicht gefunden"**  
  Die npm-Skripte `build:apk:debug` und `build:apk:release` setzen JAVA_HOME und ANDROID_HOME wie `npm run android`. Im Zweifel aus `KitsuneTV` diese Skripte nutzen.

- **Metro läuft nicht**  
  Für `assembleDebug`/`assembleRelease` muss Metro **nicht** laufen; Gradle erzeugt den JS-Bundle beim Build.

- **Release will Signatur**  
  Wenn du keinen eigenen Keystore eingerichtet hast, nutzt das Projekt den Debug-Keystore auch für Release – dann funktioniert `assembleRelease` out of the box, ist aber für Play-Store-Veröffentlichung nicht geeignet.
