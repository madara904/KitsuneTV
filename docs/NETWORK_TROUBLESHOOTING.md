# Network request failed (Android / Fire TV)

## What we did

- **Manifest:** `android:usesCleartextTraffic="true"` and `android:networkSecurityConfig="@xml/network_security_config"`.
- **Network config:** `res/xml/network_security_config.xml` with:
  - `base-config cleartextTrafficPermitted="true"` (allow HTTP to any domain, per [Android docs](https://developer.android.com/privacy-and-security/security-config#CleartextTrafficOptIn)).
  - `domain-config` for `localhost`, `127.0.0.1`, `10.0.2.2`, `10.0.3.2`, `10.0.1.1` so Metro/packager works when debugging.
- **Permission:** `ACCESS_NETWORK_STATE` added for devices that rely on it for network access.

## If it still fails

### 1. Try without `networkSecurityConfig`

On some devices the config file can make things worse. In `AndroidManifest.xml` remove only this line:

```xml
android:networkSecurityConfig="@xml/network_security_config"
```

Keep `android:usesCleartextTraffic="true"`. Rebuild and test. (See e.g. [this Stack Overflow](https://stackoverflow.com/questions/61680615) answer.)

### 2. Check device network / DNS

- **Emulator:** Often the emulator has no or bad DNS. In AVD settings set DNS to `8.8.8.8` or your router; or use a WiFi image that has internet.
- **Fire TV:** Ensure the stick is on the same network and can reach the IPTV server (e.g. open a browser or another app that uses the same URL).

### 3. Inspect the real error (logcat)

`TypeError: Network request failed` is generic. The underlying cause is in Android logs:

```bash
adb logcat | findstr -i "cleartext\|ssl\|tls\|OkHttp\|ReactNative"
```

Look for `CleartextTrafficPermitted`, certificate errors, or connection refused. That tells you if it’s cleartext policy, TLS, or connectivity.

### 4. Release vs debug

HTTP is more likely to work in **debug** (cleartext is often more permissive). If it works in debug but not in **release**, keep:

- `usesCleartextTraffic="true"`
- `network_security_config.xml` with `base-config cleartextTrafficPermitted="true"`

and do a **clean release build** (e.g. delete `android/app/build`, then build again).

### 5. FormData / Content-Type (for future POSTs)

If you send **FormData**, do **not** set `Content-Type` yourself. Let the client set `multipart/form-data` with boundary. Manually setting it can trigger “Network request failed” on Android.

## References

- [Android Network Security Configuration](https://developer.android.com/privacy-and-security/security-config)
- [React Native issue #32931](https://github.com/facebook/react-native/issues/32931) (resolved – config + localhost domains)
- [Stack Overflow: network request failed with usesCleartextTraffic](https://stackoverflow.com/questions/61680615/network-request-failed-with-react-native-even-with-androidusescleartexttraf) (emulator DNS)
- [Release build HTTP fails](https://stackoverflow.com/questions/77120832/react-natives-fetch-method-fails-for-http-request-in-release-build) (manifest + config)
