# Native app builds

This repository keeps the Netlify PWA as the source of truth and adds native packaging as an additive layer. The native mobile shells load the deployed PWA at `https://nsk-warrior.netlify.app`, so Netlify static hosting, the service worker, and the `/api/serve-game/*` Netlify Edge Function continue to deliver game assets the same way they do for the web app.

## Why hosted mode?

The game ROM and BIOS assets are intentionally not committed to this repository. They are served by Netlify Blobs through `netlify/edge-functions/serve-game.js`. Loading the hosted PWA from the native shells means Android and iOS builds can use the existing asset route without duplicating private assets into native projects or changing the deployed web app.

The Capacitor fallback page in `native-web/index.html` exists only so Capacitor has a valid `webDir`. At runtime, `capacitor.config.json` points the native WebView to the hosted Netlify app with `server.url`.

## Repository layout

- `capacitor.config.json` defines the Android/iOS app id, display name, fallback web directory, and hosted Netlify URL.
- `native-web/index.html` is a minimal fallback page for Capacitor tooling.
- `native/pwabuilder-windows.json` stores the Windows PWABuilder package request metadata.
- `.github/workflows/android.yml` builds an unsigned Android debug APK artifact.
- `.github/workflows/ios.yml` builds an unsigned iOS simulator artifact.
- `.github/workflows/windows.yml` validates packaging inputs and uploads the PWABuilder request metadata for Windows/MSIX packaging.

## Local setup

Install dependencies:

```sh
npm install
```

Validate the native shell inputs:

```sh
npm run build:web
```

Generate local native projects when you want to open them in Android Studio or Xcode:

```sh
npm run android:add
npm run ios:add
```

Sync generated projects after changing `capacitor.config.json` or web metadata:

```sh
npm run android:sync
npm run ios:sync
```

Build locally:

```sh
npm run android:build
npm run ios:build
```

## GitHub Actions

### Android

The Android workflow runs on pushes to `main`, pull requests that touch native build files, and manual `workflow_dispatch` runs. It installs dependencies, generates the Capacitor Android project, syncs it, builds a debug APK, and uploads the APK artifact.

For Play Store releases, add signing secrets and a release/bundle job later. Recommended secrets are:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

### iOS

The iOS workflow runs on `macos-latest`, generates the Capacitor iOS project, syncs it, builds an unsigned simulator app, and uploads the simulator artifact.

For TestFlight/App Store releases, add Apple signing and export steps later. Recommended secrets are:

- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_API_ISSUER_ID`
- `APP_STORE_CONNECT_API_KEY_BASE64`
- `IOS_CERTIFICATE_BASE64`
- `IOS_CERTIFICATE_PASSWORD`
- `IOS_PROVISIONING_PROFILE_BASE64`
- `APPLE_TEAM_ID`

### Windows

Windows Store packaging for a hosted PWA is handled through PWABuilder/Microsoft Store tooling. The workflow validates the local packaging inputs and uploads `native/pwabuilder-windows.json` as an artifact so the package request is versioned with the repo.

Use the artifact values with PWABuilder to generate MSIX/MSIXBUNDLE packages. If PWABuilder exposes a stable headless packaging API for this account in the future, the Windows workflow can be extended to submit `native/pwabuilder-windows.json` automatically and upload the returned MSIX artifacts.

## Do these changes affect Netlify?

No. The existing static app files remain at the repository root, and `netlify.toml` still maps the `serve-game` Edge Function. The native build files are additive and do not change Netlify routing or the PWA manifest/service worker used by the deployed web app.

## Do we need separate repositories?

No. Keep the web app, native wrapper configuration, and CI workflows in this repository. Once merged, the main branch can continue to deploy the web PWA to Netlify while GitHub Actions produces Android, iOS, and Windows packaging artifacts from the same source revision.
